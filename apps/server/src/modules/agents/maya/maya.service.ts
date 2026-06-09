import { aiService } from "../../../common/utils/aiService.js";
import { getBrandImagesForGeneration } from "../../brand-images/brand-images.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { CONTEXT_HISTORY_LIMIT } from "../../../config/constants.js";
import { callAgentWithContext, buildMemoryBlock, storeActionTurn } from "../../../common/utils/contextService.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";
import { isR2Configured, uploadImageBase64 } from "../../../common/utils/r2.js";
import * as mayaRepository from "./maya.repository.js";
import * as integrationsRepository from "../../integrations/integrations.repository.js";
import { providers } from "../../integrations/providers/index.js";
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
  ImageResult,
  CampaignInput,
  CampaignResponse,
  CampaignCaption,
  ExpandBriefInput,
} from "./maya.types.js";
import { prisma } from "../../../config/prisma.js";
import { SocialPlatform } from "../../../../prisma/generated/prisma/client.js";

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

export const sendMessage = async (
  userId: string,
  organizationId: string,
  input: SendMessageInput
) => {
  const history = await mayaRepository.findRecentMessages(
    organizationId,
    CONTEXT_HISTORY_LIMIT
  );
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
    conversationId: userMessage.id,
    userMessage: input.content,
    rawHistory: history,
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

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: responseData.response,
    imageUrl,
    tokensUsed: responseData.tokens_used,
    model: responseData.model_used,
    customInput,
  });

  return {
    role: "assistant" as const,
    content: responseData.response,
    imageUrl,
    customInput: customInput ?? null,
    createdAt: userMessage.createdAt,
  };
};

export const listMessages = (organizationId: string) =>
  mayaRepository.findAllMayaMessages(organizationId);

export const generateIdeas = async (
  userId: string,
  organizationId: string,
  input: GenerateIdeasInput
): Promise<IdeationResponse> => {
  const platformEnum = platformToEnum[input.platform];
  const [pastIdeas, history, memBlock] = await Promise.all([
    mayaRepository.getRecentIdeas(organizationId, platformEnum, 100),
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.MAYA),
  ]);

  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Generate ${input.count} ${input.platform} ideas${input.topicHint ? `: ${input.topicHint}` : ""}`,
    customInput: { actionId: "maya:generate-ideas", input },
  });

  const { data } = await aiService.post<IdeationResponse>("/ai/maya/generate-ideas", {
    user_id: userId,
    organization_id: organizationId,
    platform: input.platform,
    topic_hint: input.topicHint,
    count: input.count,
    include_image: input.includeImage,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
    use_brandkit: input.useBrandkit,
    past_ideas: pastIdeas,
    metadata: { memory_context: memBlock ?? "" },
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

  const assistantContent = `${data.ideas.length} ideas generated for ${input.platform}`;
  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    imageUrl: hostedImage?.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:generate-ideas", input, result },
  });

  void storeActionTurn({
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    organizationId,
    userContent: `Generate ${input.count} ${input.platform} ideas${input.topicHint ? `: ${input.topicHint}` : ""}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return result;
};

export const draftContent = async (
  userId: string,
  organizationId: string,
  input: DraftContentInput
): Promise<DraftResponse> => {
  const [history, memBlock, brandImagesBase] = await Promise.all([
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.MAYA),
    getBrandImagesForGeneration(organizationId, input.brandImageIds ?? []),
  ]);

  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Draft ${input.platform} post: ${input.topic}`,
    customInput: { actionId: "maya:draft-content", input },
  });

  const brandImages = brandImagesBase.map((img) => ({
    url: img.url,
    prompt: input.brandImagePrompts?.[img.id] ?? null,
  }));

  const { data } = await aiService.post<DraftResponse>("/ai/maya/draft-content", {
    user_id: userId,
    organization_id: organizationId,
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
    metadata: { memory_context: memBlock ?? "" },
  });

  const hostedImage = await hostImage(organizationId, data.image);
  const result: DraftResponse = { ...data, image: hostedImage };

  const assistantContent = `${data.draft.platform} draft (${data.draft.word_count} words): ${data.draft.title}`;
  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    imageUrl: hostedImage?.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:draft-content", input, result },
  });

  void storeActionTurn({
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    organizationId,
    userContent: `Draft ${input.platform} post: ${input.topic}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return result;
};

export const generateVariants = async (
  userId: string,
  organizationId: string,
  input: GenerateVariantsInput
): Promise<VariantResponse> => {
  const [history, memBlock] = await Promise.all([
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.MAYA),
  ]);

  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Adapt ${input.originalPlatform} content for ${input.targetPlatforms.join(", ")}`,
    customInput: { actionId: "maya:generate-variants", input },
  });

  const { data } = await aiService.post<VariantResponse>("/ai/maya/generate-variants", {
    user_id: userId,
    organization_id: organizationId,
    original_content: input.originalContent,
    original_platform: input.originalPlatform,
    target_platforms: input.targetPlatforms,
    include_images: input.includeImages,
    metadata: { memory_context: memBlock ?? "" },
  });

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

  const assistantContent = `${data.variants.length} variants generated`;
  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:generate-variants", input, result },
  });

  void storeActionTurn({
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    organizationId,
    userContent: `Adapt ${input.originalPlatform} content for ${input.targetPlatforms.join(", ")}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return result;
};

export const revise = async (
  userId: string,
  organizationId: string,
  input: ReviseInput
): Promise<ReviseResponse> => {
  const [history, memBlock] = await Promise.all([
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.MAYA),
  ]);

  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Revise ${input.platform} post`,
    customInput: { actionId: "maya:revise", input },
  });

  const { data } = await aiService.post<ReviseResponse>("/ai/maya/revise", {
    user_id: userId,
    organization_id: organizationId,
    original_content: input.originalContent,
    platform: input.platform,
    feedback: input.feedback,
    specific_instructions: input.specificInstructions,
    metadata: { memory_context: memBlock ?? "" },
  });

  const assistantContent = `Revision complete: ${data.changes_made.length} changes applied`;
  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:revise", input, result: data },
  });

  void storeActionTurn({
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    organizationId,
    userContent: `Revise ${input.platform} post`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return data;
};

export const regenerateImage = async (
  userId: string,
  organizationId: string,
  input: RegenerateImageInput
): Promise<ImageRegenResponse> => {
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
    platform: input.platform,
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

const platformFromEnum = (p: SocialPlatform): "twitter" | "linkedin" | "instagram" => {
  if (p === SocialPlatform.TWITTER) return "twitter";
  if (p === SocialPlatform.LINKEDIN) return "linkedin";
  return "instagram";
};

export const publish = async (
  userId: string,
  organizationId: string,
  input: PublishInput
): Promise<PublishResponse> => {
  const account = await integrationsRepository.findById(input.socialAccountId);
  if (!account || account.organizationId !== organizationId) {
    throw new NotFoundError("Social account not found");
  }

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

  // Pre-flight: some platforms demand an image
  if (account.platform === SocialPlatform.INSTAGRAM && !imageUrl) {
    throw new BadRequestError("Instagram publishing requires an image");
  }

  // Lazy token refresh if expired
  let activeAccount = account;
  const provider = providers[platformFromEnum(account.platform)];
  if (
    account.accessTokenExpiresAt &&
    account.accessTokenExpiresAt.getTime() < Date.now() + 60_000 &&
    account.refreshToken &&
    provider.refresh
  ) {
    try {
      const refreshed = await provider.refresh(account.refreshToken);
      activeAccount = await integrationsRepository.update(account.id, {
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.expiresAt ?? null,
      });
    } catch (err) {
      console.error("[maya] token refresh failed", err);
    }
  }

  // Hashtags can arrive from the LLM with or without a leading `#`, with stray
  // whitespace, or as empty strings. IG/LinkedIn only render `#token` (no
  // spaces) as a tappable tag, so normalise here rather than at every call
  // site or trust the model.
  const normalizedHashtags = (input.hashtags ?? [])
    .map((raw) => raw.trim().replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((tag) => tag.length > 0)
    .map((tag) => `#${tag}`);

  const caption = normalizedHashtags.length
    ? `${input.caption}\n\n${normalizedHashtags.join(" ")}`
    : input.caption;

  const pending = await prisma.publishedPost.create({
    data: {
      organizationId,
      userId,
      socialAccountId: activeAccount.id,
      platform: activeAccount.platform,
      caption,
      hashtags: input.hashtags ?? [],
      imageUrl,
      status: "pending",
    },
  });

  try {
    const { platformPostId, url } = await provider.publish({
      account: activeAccount,
      caption,
      imageUrl,
    });

    await prisma.publishedPost.update({
      where: { id: pending.id },
      data: {
        status: "success",
        platformPostId,
        publishedAt: new Date(),
      },
    });

    const platform = platformFromEnum(activeAccount.platform);

    await mayaRepository.createAssistantMessage({
      organizationId,
      userId,
      content: `Published to ${platform}${url ? `: ${url}` : ""}`,
      imageUrl,
      customInput: {
        actionId: "maya:publish",
        input,
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
      where: { id: pending.id },
      data: { status: "failed", error: message },
    });
    throw new BadRequestError(`Publish failed: ${message}`);
  }
};

export const draftCarousel = async (
  userId: string,
  organizationId: string,
  input: DraftCarouselInput
): Promise<CarouselDraftResponse> => {
  const [history, memBlock] = await Promise.all([
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.MAYA),
  ]);

  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Carousel post (${input.carouselCount} slides) on ${input.platform}: ${input.topic}`,
    customInput: { actionId: "maya:draft-carousel", input },
  });

  const { data } = await aiService.post<CarouselDraftResponse>("/ai/maya/draft-carousel", {
    user_id: userId,
    organization_id: organizationId,
    topic: input.topic,
    platform: input.platform,
    carousel_count: input.carouselCount,
    tone_override: input.toneOverride,
    include_images: input.includeImages,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
    additional_context: input.additionalContext,
    image_aspect_ratio: input.imageAspectRatio,
    metadata: { memory_context: memBlock ?? "" },
  });

  const hostedSlides: CarouselSlide[] = await Promise.all(
    data.slides.map(async (slide) => ({
      slide_number: slide.slide_number,
      image: await hostImage(organizationId, slide.image),
    }))
  );

  const result: CarouselDraftResponse = { ...data, slides: hostedSlides };

  const assistantContent = `Carousel: ${data.slides.length} slides for ${data.platform}`;
  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: assistantContent,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:draft-carousel", input, result },
  });

  void storeActionTurn({
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    organizationId,
    userContent: `Carousel post (${input.carouselCount} slides) on ${input.platform}: ${input.topic}`,
    assistantContent,
    rawHistory: history,
  }).catch(() => {});

  return result;
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
  });
  return data;
};

export const publishCarousel = async (
  userId: string,
  organizationId: string,
  input: PublishCarouselInput
): Promise<PublishCarouselResponse> => {
  const account = await integrationsRepository.findById(input.socialAccountId);
  if (!account || account.organizationId !== organizationId) {
    throw new NotFoundError("Social account not found");
  }
  if (account.platform !== SocialPlatform.INSTAGRAM) {
    throw new BadRequestError("Carousel publishing is only supported for Instagram");
  }

  const provider = providers["instagram"];
  if (!provider.publishCarousel) {
    throw new BadRequestError("Carousel publishing not supported by this provider");
  }

  const normalizedHashtags = (input.hashtags ?? [])
    .map((raw) => raw.trim().replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((tag) => tag.length > 0)
    .map((tag) => `#${tag}`);

  const caption = normalizedHashtags.length
    ? `${input.caption}\n\n${normalizedHashtags.join(" ")}`
    : input.caption;

  const pending = await prisma.publishedPost.create({
    data: {
      organizationId,
      userId,
      socialAccountId: account.id,
      platform: SocialPlatform.INSTAGRAM,
      caption,
      hashtags: input.hashtags ?? [],
      imageUrl: input.imageUrls[0],
      status: "pending",
    },
  });

  try {
    const { platformPostId, url } = await provider.publishCarousel({
      account,
      caption,
      imageUrls: input.imageUrls,
    });

    await prisma.publishedPost.update({
      where: { id: pending.id },
      data: { status: "success", platformPostId, publishedAt: new Date() },
    });

    await mayaRepository.createAssistantMessage({
      organizationId,
      userId,
      content: `Campaign carousel (${input.imageUrls.length} photos) published to Instagram${url ? `: ${url}` : ""}`,
      customInput: { actionId: "maya:publish-carousel", input, result: { platformPostId, url } },
    });

    return { platform: "instagram", platformPostId, url, publishedAt: new Date().toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.publishedPost.update({
      where: { id: pending.id },
      data: { status: "failed", error: message },
    });
    throw new BadRequestError(`Carousel publish failed: ${message}`);
  }
};

export const createCampaign = async (
  userId: string,
  organizationId: string,
  input: CampaignInput
): Promise<CampaignResponse> => {
  const [history, memBlock] = await Promise.all([
    mayaRepository.findRecentMessages(organizationId, CONTEXT_HISTORY_LIMIT),
    buildMemoryBlock(organizationId, Agent.MAYA),
  ]);

  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Product campaign (${input.photoCount} photos) on ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
    customInput: { actionId: "maya:campaign", input },
  });

  const { data } = await aiService.post<CampaignResponse>("/ai/maya/campaign", {
    user_id: userId,
    organization_id: organizationId,
    product_image_url: input.productImageUrl,
    campaign_brief: input.campaignBrief,
    photo_count: input.photoCount,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
    platform: input.platform,
    metadata: { memory_context: memBlock ?? "" },
  });

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
          topic: input.campaignBrief,
          platform: input.platform,
          tone_override: null,
          word_count_target: 200,
          include_image: false,
          use_logo: false,
          use_mascot: false,
          additional_context: null,
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

  const campaignContent = `Campaign generated: ${hostedPhotos.length} photos for ${input.platform}`;
  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: campaignContent,
    imageUrl: hostedPhotos[0]?.image?.image_url,
    tokensUsed: data.tokens_used,
    model: data.model_used,
    customInput: { actionId: "maya:campaign", input, result },
  });

  void storeActionTurn({
    agentEnum: Agent.MAYA,
    agentRole: "Maya: Social media content creation assistant",
    organizationId,
    userContent: `Product campaign (${input.photoCount} photos) on ${input.platform}: ${input.campaignBrief.slice(0, 120)}`,
    assistantContent: campaignContent,
    rawHistory: history,
  }).catch(() => {});

  return result;
};
