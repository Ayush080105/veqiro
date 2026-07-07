import { aiService } from "../../../common/utils/aiService.js";
import { getBrandImagesForGeneration } from "../../brand-images/brand-images.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import { isR2Configured, uploadImageBase64, uploadBuffer } from "../../../common/utils/r2.js";
import * as mayaRepository from "./maya.repository.js";
import * as integrationsService from "../../integrations/integrations.service.js";
import type {
  SendMessageInput,
  AssistantMessagePayload,
  GenerateIdeasInput,
  IdeationResponse,
  DraftContentInput,
  DraftResponse,
  DraftCarouselInput,
  CarouselDraftResponse,
  CarouselSlide,
  GenerateVariantsInput,
  VariantResponse,
  ReviseInput,
  ReviseResponse,
  RegenerateImageInput,
  ImageRegenResponse,
  RegenerateContentInput,
  ContentRegenResponse,
  PublishInput,
  PublishResponse,
  PublishCarouselInput,
  PublishCarouselResponse,
  ScheduleInput,
  ScheduleCarouselInput,
  ScheduleResponse,
  ImageResult,
  VideoResult,
  CampaignInput,
  CampaignResponse,
  CampaignCaption,
  ExpandBriefInput,
  GenerateVideoInput,
  GenerateVideoResponse,
  CampaignVideoInput,
  CampaignVideoResponse,
  CampaignVideoStoryboardInput,
  CampaignVideoStoryboardResponse,
} from "./maya.types.js";
import { prisma } from "../../../config/prisma.js";
import { SocialPlatform, SocialAccount } from "../../../../prisma/generated/prisma/client.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import type { PlatformSlug, SocialProvider } from "../../integrations/integrations.types.js";
import {
  checkAndDeductCredits,
  rollbackCredits,
} from "./maya.usage.service.js";
import { imageCreditsFor, videoCreditsFor } from "./maya.quotas.js";

const platformToEnum: Record<string, SocialPlatform> = {
  twitter: SocialPlatform.TWITTER,
  linkedin: SocialPlatform.LINKEDIN,
  instagram: SocialPlatform.INSTAGRAM,
};

const hostImage = async (
  organizationId: string,
  image: ImageResult | null | undefined
): Promise<ImageResult | null | undefined> => {
  if (!image || !image.image_base64) return image ?? null;
  if (!isR2Configured()) return image;
  try {
    const { url } = await uploadImageBase64({
      organizationId,
      name: "maya",
      base64: image.image_base64,
      contentType: image.content_type,
    });
    return {
      image_url: url,
      content_type: image.content_type,
      prompt_used: image.prompt_used,
    };
  } catch (err) {
    console.error("[maya] R2 upload failed, returning base64", err);
    return image;
  }
};

const hostVideo = async (
  organizationId: string,
  video: VideoResult | null | undefined
): Promise<VideoResult | null | undefined> => {
  if (!video || !video.video_base64) return video ?? null;
  if (!isR2Configured()) return video;
  try {
    const { url } = await uploadBuffer({
      organizationId,
      name: "maya",
      buffer: Buffer.from(video.video_base64, "base64"),
      contentType: video.content_type || "video/mp4",
      extension: "mp4",
      category: "videos",
    });
    return {
      video_url: url,
      content_type: video.content_type,
      prompt_used: video.prompt_used,
    };
  } catch (err) {
    console.error("[maya] R2 video upload failed, returning base64", err);
    return video;
  }
};

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await mayaRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
  const lastImageUrl = history.find(m => m.role === "assistant" && m.imageUrl)?.imageUrl ?? undefined;
  const userMessage = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const responseData = await callAgentWithContext({
    agentApiPath: "/ai/maya/chat",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: input.conversationId ?? userMessage.id,
    userMessage: input.content,
    rawHistory: history,
    extraPayload: lastImageUrl ? { last_image_url: lastImageUrl } : {},
  }) as AssistantMessagePayload;
  if (!responseData) throw new BadRequestError("Failed to get response from AI");

  let imageUrl: string | undefined = responseData.image?.url;
  if (!imageUrl && responseData.image?.image_base64 && isR2Configured()) {
    try {
      const upload = await uploadImageBase64({
        organizationId,
        name: "maya",
        base64: responseData.image.image_base64,
        contentType: responseData.image.content_type,
      });
      imageUrl = upload.url;
    } catch (err) {
      console.error("[maya] chat image upload failed", err);
    }
  }

  // When modify-image fires in-place: update the original draft card's image
  // instead of creating a new image card in the chat stream.
  if (responseData.action_id === "maya:modify-image" && imageUrl) {
    const lastImageMessage = history.find(m => m.role === "assistant" && m.imageUrl);
    if (lastImageMessage?.id) {
      await mayaRepository.updateMessageImage(lastImageMessage.id, imageUrl, {
        image_url: imageUrl,
        content_type: responseData.image?.content_type ?? "image/png",
        prompt_used: responseData.image?.prompt_used ?? "",
      });
    }
    return mayaRepository.createAssistantMessage({
      organizationId,
      userId,
      content: responseData.response,
      tokensUsed: responseData.tokens_used,
      model: responseData.model_used,
      // No actionId — renders as plain text. result carries the patch signal
      // so the frontend can update the original draft card image in-place.
      customInput: lastImageMessage?.id
        ? {
            result: {
              _modifyImagePatch: true,
              patchedMessageId: lastImageMessage.id,
              image: {
                image_url: imageUrl,
                content_type: responseData.image?.content_type ?? "image/png",
                prompt_used: responseData.image?.prompt_used ?? "",
              },
            },
          }
        : undefined,
    });
  }

  // Build customInput for rich card rendering. For content actions inject the
  // hosted image URL so the card renders the image without base64 in the DB.
  let customInput: Record<string, unknown> | undefined;
  if (responseData.action_id && responseData.action_result) {
    const result = { ...responseData.action_result } as Record<string, unknown>;
    // Override with R2 URL when available (replaces base64 from Python side)
    if (
      imageUrl &&
      ["maya:draft-content", "maya:generate-ideas", "maya:generate-variants"].includes(
        responseData.action_id
      )
    ) {
      result.image = {
        image_url: imageUrl,
        content_type: responseData.image?.content_type ?? "image/png",
        prompt_used: responseData.image?.prompt_used ?? "",
      };
    }
    customInput = { actionId: responseData.action_id, input: {}, result };
  }

  // When the AI modified an image via chat (e.g. modify_image tool for logo/mascot
  // changes) it returns the new image at the top level with no action_id/action_result.
  // Package it as maya:regenerate-image so displayMessages can patch the DraftCard
  // in-place instead of just showing an orphaned inline image.
  if (imageUrl && !customInput) {
    customInput = {
      actionId: "maya:regenerate-image",
      input: {},
      result: {
        image: {
          image_url: imageUrl,
          content_type: responseData.image?.content_type ?? "image/png",
          prompt_used: responseData.image?.prompt_used ?? "",
        },
      },
    };
  }

  const assistantMessage = await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  return assistantMessage;
};

export const listMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => mayaRepository.findAllMayaMessages(organizationId, opts);

export const generateIdeas = async (
  userId: string,
  organizationId: string,
  input: GenerateIdeasInput
): Promise<IdeationResponse> => {
  const imageCredits = imageCreditsFor(input.includeImage ? 1 : 0);
  await checkAndDeductCredits(organizationId, imageCredits);

  try {
  const platformEnum = platformToEnum[input.platform];
  const [pastIdeas, history] = await Promise.all([
    mayaRepository.getRecentIdeas(organizationId, platformEnum, 100),
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
  ]);

  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Generate ${input.count} ${input.platform} ideas${input.topicHint ? `: ${input.topicHint}` : ""}`,
    customInput: { actionId: "maya:generate-ideas", input },
  });

  const data = await callAgentWithContext<IdeationResponse>({
    agentApiPath: "/ai/maya/generate-ideas",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Generate ${input.count} ${input.platform} ideas${input.topicHint ? `: ${input.topicHint}` : ""}`,
    rawHistory: history,
    topLevelPayload: {
      platform: input.platform,
      topic_hint: input.topicHint,
      count: input.count,
      include_image: input.includeImage,
      use_logo: input.useLogo,
      use_mascot: input.useMascot,
      use_brandkit: input.useBrandkit,
      past_ideas: pastIdeas,
    },
  });

  const hostedImage = await hostImage(organizationId, data.image);
  const result: IdeationResponse = { ...data, image: hostedImage };

  await mayaRepository.saveIdeas(
    data.ideas.map((idea) => ({
      organizationId,
      platform: platformToEnum[idea.platform] ?? platformEnum,
      title: idea.title,
      hook: idea.hook,
      contentType: idea.content_type,
    }))
  );

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.ideas.length} ideas generated for ${input.platform}`,
    imageUrl: hostedImage?.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:generate-ideas", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, imageCredits);
    throw err;
  }
};

export const draftContent = async (
  userId: string,
  organizationId: string,
  input: DraftContentInput
): Promise<DraftResponse> => {
  const imageCredits = imageCreditsFor(input.includeImage ? 1 : 0);
  await checkAndDeductCredits(organizationId, imageCredits);

  try {
  const [history, brandImagesBase] = await Promise.all([
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    getBrandImagesForGeneration(organizationId, input.brandImageIds ?? []),
  ]);

  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Draft ${input.platform} post: ${input.topic}`,
    customInput: { actionId: "maya:draft-content", input },
  });

  const brandImages = brandImagesBase.map((img) => ({
    url: img.url,
    prompt: input.brandImagePrompts?.[img.id] ?? null,
  }));

  const data = await callAgentWithContext<DraftResponse>({
    agentApiPath: "/ai/maya/draft-content",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Draft ${input.platform} post: ${input.topic}`,
    rawHistory: history,
    topLevelPayload: {
      topic: input.topic,
      platform: input.platform,
      tone_override: input.toneOverride,
      word_count_target: input.wordCountTarget,
      include_image: input.includeImage,
      use_logo: input.useLogo,
      use_mascot: input.useMascot,
      additional_context: input.additionalContext,
      from_rex: input.fromRex ?? false,
      use_reference: (input.inspirationImages?.length ?? 0) > 0,
      reference_images: input.inspirationImages ?? [],
      brand_images: brandImages,
    },
  });

  const hostedImage = await hostImage(organizationId, data.image);
  const result: DraftResponse = { ...data, image: hostedImage };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.draft.platform} draft (${data.draft.word_count} words): ${data.draft.title}`,
    imageUrl: hostedImage?.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:draft-content", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, imageCredits);
    throw err;
  }
};

export const generateVariants = async (
  userId: string,
  organizationId: string,
  input: GenerateVariantsInput
): Promise<VariantResponse> => {
  const imageCount = input.includeImages ? input.targetPlatforms.length : 0;
  const imageCredits = imageCreditsFor(imageCount);
  await checkAndDeductCredits(organizationId, imageCredits);

  try {
  const history = await mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Adapt ${input.originalPlatform} content for ${input.targetPlatforms.join(", ")}`,
    customInput: { actionId: "maya:generate-variants", input },
  });

  const data = await callAgentWithContext<VariantResponse>({
    agentApiPath: "/ai/maya/generate-variants",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Adapt ${input.originalPlatform} content for ${input.targetPlatforms.join(", ")}`,
    rawHistory: history,
    topLevelPayload: {
      original_content: input.originalContent,
      original_platform: input.originalPlatform,
      target_platforms: input.targetPlatforms,
      include_images: input.includeImages,
    },
  });

  const actualImageCount = input.includeImages ? data.variants.filter((v) => v.image).length : 0;
  if (actualImageCount < imageCount) {
    await rollbackCredits(organizationId, imageCreditsFor(imageCount - actualImageCount));
  }

  const hostedVariants = await Promise.all(
    data.variants.map(async (v) => ({
      ...v,
      image: await hostImage(organizationId, v.image),
    }))
  );
  const result: VariantResponse = {
    variants: hostedVariants,
    tokens_used: data.tokens_used,
    model_used: data.model_used,
  };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.variants.length} variants generated`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:generate-variants", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, imageCredits);
    throw err;
  }
};

export const revise = async (
  userId: string,
  organizationId: string,
  input: ReviseInput
): Promise<ReviseResponse> => {
  const history = await mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Revise ${input.platform} post`,
    customInput: { actionId: "maya:revise", input },
  });

  const data = await callAgentWithContext<ReviseResponse>({
    agentApiPath: "/ai/maya/revise",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Revise ${input.platform} post`,
    rawHistory: history,
    topLevelPayload: {
      original_content: input.originalContent,
      platform: input.platform,
      feedback: input.feedback,
      specific_instructions: input.specificInstructions,
    },
  });

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Revision complete: ${data.changes_made.length} changes applied`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:revise", input, result: data },
  });

  return data;
};

export const regenerateImage = async (
  userId: string,
  organizationId: string,
  input: RegenerateImageInput
): Promise<ImageRegenResponse> => {
  await checkAndDeductCredits(organizationId, imageCreditsFor(1));

  try {
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Regenerate image: ${input.prompt}`,
    customInput: { actionId: "maya:regenerate-image", input },
  });

  const { data } = await aiService.post<ImageRegenResponse>("/ai/maya/regenerate-image", {
    user_id: userId,
    organization_id: organizationId,
    image_url: input.imageUrl,
    prompt: input.prompt,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
  });

  const hosted = await hostImage(organizationId, data.image);
  const result: ImageRegenResponse = {
    image: hosted ?? data.image,
    tokens_used: data.tokens_used,
    model_used: data.model_used,
  };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Image regenerated",
    imageUrl: result.image.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:regenerate-image", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, imageCreditsFor(1));
    throw err;
  }
};

export const regenerateContent = async (
  userId: string,
  organizationId: string,
  input: RegenerateContentInput
): Promise<ContentRegenResponse> => {
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Refresh caption: ${input.prompt}`,
    customInput: { actionId: "maya:regenerate-content", input },
  });

  const { data } = await aiService.post<ContentRegenResponse>(
    "/ai/maya/regenerate-content",
    {
      user_id: userId,
      organization_id: organizationId,
      caption: input.caption,
      prompt: input.prompt,
      platform: input.platform,
    }
  );

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Caption refreshed",
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:regenerate-content", input, result: data },
  });

  return data;
};

// Hashtags can arrive from the LLM with or without a leading `#`, with stray
// whitespace, or as empty strings. IG/LinkedIn only render `#token` (no
// spaces) as a tappable tag, so normalise here rather than at every call
// site or trust the model.
const normalizeCaption = (caption: string, hashtags?: string[]): string => {
  const normalizedHashtags = (hashtags ?? [])
    .map((raw) => raw.trim().replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((tag) => tag.length > 0)
    .map((tag) => `#${tag}`);
  return normalizedHashtags.length ? `${caption}\n\n${normalizedHashtags.join(" ")}` : caption;
};

export interface FirablePost {
  id: string;
  organizationId: string;
  userId: string;
  socialAccountId: string | null;
  caption: string;
  imageUrl: string | null;
  videoUrl: string | null;
  postType: string | null;
}

interface ResolvedAccount {
  account: SocialAccount;
  provider: SocialProvider;
  platform: PlatformSlug;
}

// Calls the provider (with one retry on auth-token expiry) and updates the
// PublishedPost row to success/failed. Shared by the synchronous publish path
// (which already has a freshly-resolved account) and the scheduled-post cron
// (which resolves the account itself, since the token may have gone stale
// while the post sat waiting to fire).
export const firePublishedPost = async (
  post: FirablePost,
  resolved?: ResolvedAccount
): Promise<PublishResponse> => {
  if (!post.socialAccountId) throw new BadRequestError("No social account associated with this post");
  let { account: activeAccount, provider, platform } =
    resolved ?? await integrationsService.getUsableSocialAccount(post.organizationId, post.socialAccountId);

  try {
    let platformPostId: string;
    let url: string | undefined;
    try {
      const result = await provider.publish({
        account: activeAccount,
        caption: post.caption,
        imageUrl: post.imageUrl ?? undefined,
        videoUrl: post.videoUrl ?? undefined,
        postType: post.postType as "post" | "reel" | undefined,
      });
      platformPostId = result.platformPostId;
      url = result.url;
    } catch (err) {
      if (!integrationsService.isAuthTokenError(err)) throw err;
      ({ account: activeAccount, provider, platform } =
        await integrationsService.getUsableSocialAccount(post.organizationId, post.socialAccountId, {
          forceRefresh: true,
        }));
      const result = await provider.publish({
        account: activeAccount,
        caption: post.caption,
        imageUrl: post.imageUrl ?? undefined,
        videoUrl: post.videoUrl ?? undefined,
        postType: post.postType as "post" | "reel" | undefined,
      });
      platformPostId = result.platformPostId;
      url = result.url;
    }

    await prisma.publishedPost.update({
      where: { id: post.id },
      data: {
        status: "success",
        platformPostId,
        publishedAt: new Date(),
      },
    });

    await mayaRepository.createAssistantMessage({
      organizationId: post.organizationId,
      userId: post.userId,
      content: `Published to ${platform}${url ? `: ${url}` : ""}`,
      imageUrl: post.imageUrl ?? undefined,
      customInput: {
        actionId: "maya:publish",
        result: { platform, platformPostId, url },
      },
    });

    return {
      platform,
      platformPostId,
      url,
      publishedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.publishedPost.update({
      where: { id: post.id },
      data: { status: "failed", error: message },
    });
    throw err;
  }
};

export const publish = async (
  userId: string,
  organizationId: string,
  input: PublishInput
): Promise<PublishResponse> => {
  let imageUrl = input.imageUrl;
  if (!imageUrl && input.imageBase64) {
    if (!isR2Configured()) {
      throw new BadRequestError(
        "Image hosting is not configured. Set R2_* env vars or pass imageUrl directly."
      );
    }
    const uploaded = await uploadImageBase64({
      organizationId,
      name: "maya-publish",
      base64: input.imageBase64,
    });
    imageUrl = uploaded.url;
  }

  let videoUrl = input.videoUrl;
  if (!videoUrl && input.videoBase64) {
    if (!isR2Configured()) {
      throw new BadRequestError(
        "Video hosting is not configured. Set R2_* env vars or pass videoUrl directly."
      );
    }
    const uploaded = await uploadBuffer({
      organizationId,
      name: "maya-publish",
      buffer: Buffer.from(input.videoBase64, "base64"),
      contentType: "video/mp4",
      extension: "mp4",
      category: "videos",
    });
    videoUrl = uploaded.url;
  }

  const resolved = await integrationsService.getUsableSocialAccount(organizationId, input.socialAccountId);

  // Pre-flight: every platform demands some media to publish
  if (!imageUrl && !videoUrl) {
    throw new BadRequestError("Publishing requires an image or video");
  }

  const caption = normalizeCaption(input.caption, input.hashtags);

  const pending = await prisma.publishedPost.create({
    data: {
      organizationId,
      userId,
      socialAccountId: resolved.account.id,
      platform: resolved.account.platform,
      caption,
      hashtags: input.hashtags ?? [],
      imageUrl,
      videoUrl,
      postType: input.postType ?? null,
      status: "pending",
    },
  });

  try {
    return await firePublishedPost(
      {
        id: pending.id,
        organizationId,
        userId,
        socialAccountId: pending.socialAccountId,
        caption,
        imageUrl: imageUrl ?? null,
        videoUrl: videoUrl ?? null,
        postType: input.postType ?? null,
      },
      resolved
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new BadRequestError(`Publish failed: ${message}`);
  }
};

export const schedulePost = async (
  userId: string,
  organizationId: string,
  input: ScheduleInput
): Promise<ScheduleResponse> => {
  let imageUrl = input.imageUrl;
  if (!imageUrl && input.imageBase64) {
    if (!isR2Configured()) {
      throw new BadRequestError(
        "Image hosting is not configured. Set R2_* env vars or pass imageUrl directly."
      );
    }
    const uploaded = await uploadImageBase64({
      organizationId,
      name: "maya-schedule",
      base64: input.imageBase64,
    });
    imageUrl = uploaded.url;
  }

  let videoUrl = input.videoUrl;
  if (!videoUrl && input.videoBase64) {
    if (!isR2Configured()) {
      throw new BadRequestError(
        "Video hosting is not configured. Set R2_* env vars or pass videoUrl directly."
      );
    }
    const uploaded = await uploadBuffer({
      organizationId,
      name: "maya-schedule",
      buffer: Buffer.from(input.videoBase64, "base64"),
      contentType: "video/mp4",
      extension: "mp4",
      category: "videos",
    });
    videoUrl = uploaded.url;
  }

  if (!imageUrl && !videoUrl) {
    throw new BadRequestError("Scheduling requires an image or video");
  }

  const { account, platform } = await integrationsService.getUsableSocialAccount(
    organizationId,
    input.socialAccountId
  );
  const caption = normalizeCaption(input.caption, input.hashtags);

  const row = await prisma.publishedPost.create({
    data: {
      organizationId,
      userId,
      socialAccountId: account.id,
      platform: account.platform,
      caption,
      hashtags: input.hashtags ?? [],
      imageUrl,
      videoUrl,
      postType: input.postType ?? null,
      status: "scheduled",
      scheduledAt: new Date(input.scheduledAt),
    },
  });

  return { id: row.id, scheduledAt: row.scheduledAt!.toISOString(), platform };
};

export const cancelScheduledPost = async (organizationId: string, id: string) => {
  const post = await mayaRepository.findPublishedPostById(id, organizationId);
  if (!post) throw new NotFoundError("Scheduled post not found");
  if (post.status !== "scheduled") {
    throw new BadRequestError("Only scheduled posts can be cancelled");
  }
  return prisma.publishedPost.update({ where: { id }, data: { status: "cancelled" } });
};

export const draftCarousel = async (
  userId: string,
  organizationId: string,
  input: DraftCarouselInput
): Promise<CarouselDraftResponse> => {
  const imageCount = input.includeImages ? input.carouselCount : 0;
  const imageCredits = imageCreditsFor(imageCount);
  await checkAndDeductCredits(organizationId, imageCredits);

  try {
  const history = await mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Carousel post (${input.carouselCount} slides) on ${input.platform}: ${input.topic}`,
    customInput: { actionId: "maya:draft-carousel", input },
  });

  const data = await callAgentWithContext<CarouselDraftResponse>({
    agentApiPath: "/ai/maya/draft-carousel",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Carousel post (${input.carouselCount} slides) on ${input.platform}: ${input.topic}`,
    rawHistory: history,
    topLevelPayload: {
      topic: input.topic,
      platform: input.platform,
      carousel_count: input.carouselCount,
      tone_override: input.toneOverride,
      include_images: input.includeImages,
      use_logo: input.useLogo,
      use_mascot: input.useMascot,
      additional_context: input.additionalContext,
      image_aspect_ratio: input.imageAspectRatio,
    },
  });

  if (imageCount > 0) {
    const actualImageCount = data.slides.filter((s) => s.image).length;
    if (actualImageCount < imageCount) {
      await rollbackCredits(organizationId, imageCreditsFor(imageCount - actualImageCount));
    }
  }

  const hostedSlides: CarouselSlide[] = await Promise.all(
    data.slides.map(async (slide) => ({
      slide_number: slide.slide_number,
      image: await hostImage(organizationId, slide.image),
    }))
  );

  const result: CarouselDraftResponse = { ...data, slides: hostedSlides };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Carousel: ${data.slides.length} slides for ${data.platform}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:draft-carousel", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, imageCredits);
    throw err;
  }
};

export const listPublishedPosts = async (organizationId: string) => {
  return mayaRepository.findPublishedPosts(organizationId);
};

export const expandBrief = async (
  userId: string,
  organizationId: string,
  input: ExpandBriefInput
): Promise<{ expanded: string }> => {
  const { data } = await aiService.post<{ expanded: string }>("/ai/maya/expand-brief", {
    user_id: userId,
    organization_id: organizationId,
    brief: input.brief,
    platform: input.platform,
    product_image_base64: input.productImageBase64,
    product_image_url: input.productImageUrl,
  });
  return data;
};

export interface FirableCarouselPost {
  id: string;
  organizationId: string;
  userId: string;
  socialAccountId: string | null;
  caption: string;
  imageUrls: string[];
}

// Carousel counterpart to firePublishedPost — see that function's comment.
export const firePublishedCarousel = async (
  post: FirableCarouselPost,
  resolved?: { account: SocialAccount; provider: SocialProvider }
): Promise<PublishCarouselResponse> => {
  if (!post.socialAccountId) throw new BadRequestError("No social account associated with this post");
  let { account, provider } =
    resolved ?? await integrationsService.getUsableSocialAccount(post.organizationId, post.socialAccountId);
  if (!provider.publishCarousel) {
    throw new BadRequestError("Carousel publishing not supported by this provider");
  }

  try {
    let platformPostId: string;
    let url: string | undefined;
    try {
      const result = await provider.publishCarousel({
        account,
        caption: post.caption,
        imageUrls: post.imageUrls,
      });
      platformPostId = result.platformPostId;
      url = result.url;
    } catch (err) {
      if (!integrationsService.isAuthTokenError(err)) throw err;
      const refreshed = await integrationsService.getUsableSocialAccount(
        post.organizationId,
        post.socialAccountId,
        { forceRefresh: true }
      );
      account = refreshed.account;
      provider = refreshed.provider;
      if (!provider.publishCarousel) {
        throw new BadRequestError("Carousel publishing not supported by this provider");
      }
      const result = await provider.publishCarousel({
        account,
        caption: post.caption,
        imageUrls: post.imageUrls,
      });
      platformPostId = result.platformPostId;
      url = result.url;
    }

    await prisma.publishedPost.update({
      where: { id: post.id },
      data: { status: "success", platformPostId, publishedAt: new Date() },
    });

    await mayaRepository.createAssistantMessage({
      organizationId: post.organizationId,
      userId: post.userId,
      content: `Campaign carousel (${post.imageUrls.length} photos) published to Instagram${url ? `: ${url}` : ""}`,
      customInput: { actionId: "maya:publish-carousel", result: { platformPostId, url } },
    });

    return { platform: "instagram", platformPostId, url, publishedAt: new Date().toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.publishedPost.update({
      where: { id: post.id },
      data: { status: "failed", error: message },
    });
    throw err;
  }
};

export const publishCarousel = async (
  userId: string,
  organizationId: string,
  input: PublishCarouselInput
): Promise<PublishCarouselResponse> => {
  const resolved = await integrationsService.getUsableSocialAccount(organizationId, input.socialAccountId);
  if (resolved.account.platform !== SocialPlatform.INSTAGRAM) {
    throw new BadRequestError("Carousel publishing is only supported for Instagram");
  }
  if (!resolved.provider.publishCarousel) {
    throw new BadRequestError("Carousel publishing not supported by this provider");
  }

  const caption = normalizeCaption(input.caption, input.hashtags);

  const pending = await prisma.publishedPost.create({
    data: {
      organizationId,
      userId,
      socialAccountId: resolved.account.id,
      platform: SocialPlatform.INSTAGRAM,
      caption,
      hashtags: input.hashtags ?? [],
      imageUrl: input.imageUrls[0],
      imageUrls: input.imageUrls,
      status: "pending",
    },
  });

  try {
    return await firePublishedCarousel(
      {
        id: pending.id,
        organizationId,
        userId,
        socialAccountId: pending.socialAccountId,
        caption,
        imageUrls: input.imageUrls,
      },
      resolved
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new BadRequestError(`Carousel publish failed: ${message}`);
  }
};

export const scheduleCarousel = async (
  userId: string,
  organizationId: string,
  input: ScheduleCarouselInput
): Promise<ScheduleResponse> => {
  const { account, provider } = await integrationsService.getUsableSocialAccount(
    organizationId,
    input.socialAccountId
  );
  if (account.platform !== SocialPlatform.INSTAGRAM) {
    throw new BadRequestError("Carousel publishing is only supported for Instagram");
  }
  if (!provider.publishCarousel) {
    throw new BadRequestError("Carousel publishing not supported by this provider");
  }

  const caption = normalizeCaption(input.caption ?? "", input.hashtags);

  const row = await prisma.publishedPost.create({
    data: {
      organizationId,
      userId,
      socialAccountId: account.id,
      platform: SocialPlatform.INSTAGRAM,
      caption,
      hashtags: input.hashtags ?? [],
      imageUrl: input.imageUrls[0],
      imageUrls: input.imageUrls,
      status: "scheduled",
      scheduledAt: new Date(input.scheduledAt),
    },
  });

  return { id: row.id, scheduledAt: row.scheduledAt!.toISOString(), platform: "instagram" };
};

export const createCampaign = async (
  userId: string,
  organizationId: string,
  input: CampaignInput
): Promise<CampaignResponse> => {
  const campaignImageCredits = imageCreditsFor(input.photoCount);
  await checkAndDeductCredits(organizationId, campaignImageCredits);

  try {
  const history = await mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Product campaign (${input.photoCount} photos) on ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
    customInput: { actionId: "maya:campaign", input },
  });

  const data = await callAgentWithContext<CampaignResponse>({
    agentApiPath: "/ai/maya/campaign",
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    userId,
    organizationId,
    conversationId: userMsg.id,
    userMessage: `Product campaign (${input.photoCount} photos) on ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
    rawHistory: history,
    topLevelPayload: {
      product_image_urls: input.productImageUrls,
      campaign_brief: input.campaignBrief,
      photo_count: input.photoCount,
      use_logo: input.useLogo,
      use_mascot: input.useMascot,
      platform: input.platform,
    },
  });

  const actualPhotoCount = data.photos.filter((p) => p.image).length;
  if (actualPhotoCount < input.photoCount) {
    await rollbackCredits(organizationId, imageCreditsFor(input.photoCount - actualPhotoCount));
  }

  const [hostedPhotos, caption] = await Promise.all([
    Promise.all(
      data.photos.map(async (photo) => ({
        ...photo,
        image: (await hostImage(organizationId, photo.image)) ?? photo.image,
      }))
    ),
    (async (): Promise<CampaignCaption | null> => {
      try {
        const { data: d } = await aiService.post<DraftResponse>("/ai/maya/draft-content", {
          user_id: userId,
          organization_id: organizationId,
          topic: input.campaignBrief.slice(0, 490),
          platform: input.platform,
          tone_override: null,
          word_count_target: 200,
          include_image: false,
          use_logo: false,
          use_mascot: false,
          additional_context: input.campaignBrief.length > 490 ? input.campaignBrief.slice(0, 1000) : null,
          from_rex: false,
          use_reference: false,
          reference_images: [],
          brand_images: [],
        });
        return { body: d.draft.body, hashtags: d.draft.hashtags, cta: d.draft.cta || undefined };
      } catch {
        return null;
      }
    })(),
  ]);

  const result: CampaignResponse = {
    ...data,
    photos: hostedPhotos,
    caption,
  };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Campaign generated: ${hostedPhotos.length} photos for ${input.platform}`,
    imageUrl: hostedPhotos[0]?.image?.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:campaign", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, campaignImageCredits);
    throw err;
  }
};

const draftVideoCaption = async (
  userId: string,
  organizationId: string,
  topic: string,
  platform: GenerateVideoInput["platform"]
): Promise<CampaignCaption | null> => {
  try {
    const { data: d } = await aiService.post<DraftResponse>("/ai/maya/draft-content", {
      user_id: userId,
      organization_id: organizationId,
      topic: topic.slice(0, 490),
      platform,
      tone_override: null,
      word_count_target: 150,
      include_image: false,
      use_logo: false,
      use_mascot: false,
      additional_context: topic.length > 490 ? topic.slice(0, 1000) : null,
      from_rex: false,
      use_reference: false,
      reference_images: [],
      brand_images: [],
    });
    return { body: d.draft.body, hashtags: d.draft.hashtags, cta: d.draft.cta || undefined };
  } catch {
    return null;
  }
};

export const generateVideo = async (
  userId: string,
  organizationId: string,
  input: GenerateVideoInput
): Promise<GenerateVideoResponse> => {
  const videoCredits = videoCreditsFor(input.durationSeconds);
  await checkAndDeductCredits(organizationId, videoCredits);

  try {
  const history = await mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Generate video on ${input.platform}: ${input.prompt.slice(0, 120)}`,
    customInput: { actionId: "maya:generate-video", input },
  });

  const [data, caption] = await Promise.all([
    callAgentWithContext<GenerateVideoResponse>({
      agentApiPath: "/ai/maya/generate-video",
      agentEnum: Agent.MAYA,
      agentRole: "Maya: Social media content creation assistant",
      userId,
      organizationId,
      conversationId: userMsg.id,
      userMessage: `Generate video on ${input.platform}: ${input.prompt.slice(0, 120)}`,
      rawHistory: history,
      topLevelPayload: {
        prompt: input.prompt,
        platform: input.platform,
        aspect_ratio: input.aspectRatio,
        duration_seconds: input.durationSeconds,
        use_logo: input.useLogo,
      },
    }),
    draftVideoCaption(userId, organizationId, input.prompt, input.platform),
  ]);

  const result: GenerateVideoResponse = {
    ...data,
    video: (await hostVideo(organizationId, data.video)) ?? data.video,
    caption,
  };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Video generated for ${input.platform}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:generate-video", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, videoCredits);
    throw err;
  }
};

export const createCampaignVideoStoryboard = async (
  userId: string,
  organizationId: string,
  input: CampaignVideoStoryboardInput
): Promise<CampaignVideoStoryboardResponse> => {
  await checkAndDeductCredits(organizationId, imageCreditsFor(1));

  try {
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Storyboard for ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
    customInput: { actionId: "maya:campaign-video-storyboard", input },
  });

  const { data } = await aiService.post<{
    storyboard_image_base64: string;
    beats: string[];
    model_used: string;
  }>("/ai/maya/campaign-video/storyboard", {
    user_id: userId,
    organization_id: organizationId,
    product_image_urls: input.productImageUrls,
    campaign_brief: input.campaignBrief,
    platform: input.platform,
    aspect_ratio: input.aspectRatio,
    duration_seconds: input.durationSeconds,
    use_logo: input.useLogo,
  });

  const hosted = await hostImage(organizationId, {
    image_base64: data.storyboard_image_base64,
    content_type: "image/png",
    prompt_used: "",
  });

  const result: CampaignVideoStoryboardResponse = {
    storyboard_image_url: hosted?.image_url,
    storyboard_image_base64: hosted?.image_url ? undefined : hosted?.image_base64,
    beats: data.beats,
    model_used: data.model_used,
  };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Storyboard generated for ${input.platform}`,
    tokensUsed: 0,
    model: result.model_used,
    customInput: { actionId: "maya:campaign-video-storyboard", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, imageCreditsFor(1));
    throw err;
  }
};

export const createCampaignVideo = async (
  userId: string,
  organizationId: string,
  input: CampaignVideoInput
): Promise<CampaignVideoResponse> => {
  const campaignVideoCredits = videoCreditsFor(input.durationSeconds);
  await checkAndDeductCredits(organizationId, campaignVideoCredits);

  try {
  const history = await mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT);
  const userMsg = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Product campaign video on ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
    customInput: { actionId: "maya:campaign-video", input },
  });

  const [data, caption] = await Promise.all([
    callAgentWithContext<CampaignVideoResponse>({
      agentApiPath: "/ai/maya/campaign-video",
      agentEnum: Agent.MAYA,
      agentRole: "Maya: Social media content creation assistant",
      userId,
      organizationId,
      conversationId: userMsg.id,
      userMessage: `Product campaign video on ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
      rawHistory: history,
      topLevelPayload: {
        product_image_urls: input.productImageUrls,
        campaign_brief: input.campaignBrief,
        platform: input.platform,
        aspect_ratio: input.aspectRatio,
        duration_seconds: input.durationSeconds,
        use_logo: input.useLogo,
        storyboard_beats: input.storyboardBeats,
        storyboard_image_url: input.storyboardImageUrl,
      },
    }),
    draftVideoCaption(userId, organizationId, input.campaignBrief, input.platform),
  ]);

  const result: CampaignVideoResponse = {
    ...data,
    video: (await hostVideo(organizationId, data.video)) ?? data.video,
    caption,
    storyboard_image_url: input.storyboardImageUrl,
  };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Campaign video generated for ${input.platform}`,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:campaign-video", input, result },
  });

  return result;
  } catch (err) {
    await rollbackCredits(organizationId, campaignVideoCredits);
    throw err;
  }
};
