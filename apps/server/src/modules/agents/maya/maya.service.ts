import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { SAGE_HISTORY_LIMIT } from "../../../config/constants.js";
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
  ImageResult,
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
  const userMessage = await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: input.content,
  });
  const history = await mayaRepository.findRecentMessages(
    organizationId,
    SAGE_HISTORY_LIMIT
  );
  const { data } = await aiService.post<AssistantMessagePayload>("/ai/maya/chat", {
    user_id: userId,
    organization_id: organizationId,
    conversation_id: userMessage.id,
    message: input.content,
    history,
  });
  if (!data) throw new BadRequestError("Failed to get response from AI");

  let imageUrl: string | undefined = data.image?.url;
  if (!imageUrl && data.image?.image_base64 && isR2Configured()) {
    try {
      const upload = await uploadImageBase64({
        organizationId,
        base64: data.image.image_base64,
        contentType: data.image.content_type,
      });
      imageUrl = upload.url;
    } catch (err) {
      console.error("[maya] chat image upload failed", err);
    }
  }

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: data.response,
    imageUrl,
    tokensUsed: data.tokens_used,
    model: data.model_used,
  });

  return {
    role: "assistant" as const,
    content: data.response,
    imageUrl,
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
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Generate ${input.count} ${input.platform} ideas${input.topicHint ? `: ${input.topicHint}` : ""}`,
    customInput: { tool: "generate-ideas", input },
  });

  const { data } = await aiService.post<IdeationResponse>("/ai/maya/generate-ideas", {
    user_id: userId,
    platform: input.platform,
    topic_hint: input.topicHint,
    count: input.count,
    include_image: input.includeImage,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
  });

  const hostedImage = await hostImage(organizationId, data.image);
  const result: IdeationResponse = { ...data, image: hostedImage };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.ideas.length} ideas generated for ${input.platform}`,
    imageUrl: hostedImage?.image_url,
    customInput: { tool: "generate-ideas", output: result },
  });

  return result;
};

export const draftContent = async (
  userId: string,
  organizationId: string,
  input: DraftContentInput
): Promise<DraftResponse> => {
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Draft ${input.platform} post: ${input.topic}`,
    customInput: { tool: "draft-content", input },
  });

  const { data } = await aiService.post<DraftResponse>("/ai/maya/draft-content", {
    user_id: userId,
    topic: input.topic,
    platform: input.platform,
    tone_override: input.toneOverride,
    word_count_target: input.wordCountTarget,
    include_image: input.includeImage,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
    additional_context: input.additionalContext,
  });

  const hostedImage = await hostImage(organizationId, data.image);
  const result: DraftResponse = { ...data, image: hostedImage };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.draft.platform} draft (${data.draft.word_count} words): ${data.draft.title}`,
    imageUrl: hostedImage?.image_url,
    customInput: { tool: "draft-content", output: result },
  });

  return result;
};

export const generateVariants = async (
  userId: string,
  organizationId: string,
  input: GenerateVariantsInput
): Promise<VariantResponse> => {
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Adapt ${input.originalPlatform} content for ${input.targetPlatforms.join(", ")}`,
    customInput: { tool: "generate-variants", input },
  });

  const { data } = await aiService.post<VariantResponse>("/ai/maya/generate-variants", {
    user_id: userId,
    original_content: input.originalContent,
    original_platform: input.originalPlatform,
    target_platforms: input.targetPlatforms,
    include_images: input.includeImages,
  });

  const hostedVariants = await Promise.all(
    data.variants.map(async (v) => ({
      ...v,
      image: await hostImage(organizationId, v.image),
    }))
  );
  const result: VariantResponse = { variants: hostedVariants };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `${data.variants.length} variants generated`,
    customInput: { tool: "generate-variants", output: result },
  });

  return result;
};

export const revise = async (
  userId: string,
  organizationId: string,
  input: ReviseInput
): Promise<ReviseResponse> => {
  await mayaRepository.createUserMessage({
    organizationId,
    userId,
    content: `Revise ${input.platform} post`,
    customInput: { tool: "revise", input },
  });

  const { data } = await aiService.post<ReviseResponse>("/ai/maya/revise", {
    user_id: userId,
    original_content: input.originalContent,
    platform: input.platform,
    feedback: input.feedback,
    specific_instructions: input.specificInstructions,
  });

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: `Revision complete: ${data.changes_made.length} changes applied`,
    customInput: { tool: "revise", output: data },
  });

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
    customInput: { tool: "regenerate-image", input },
  });

  const { data } = await aiService.post<ImageRegenResponse>("/ai/maya/regenerate-image", {
    user_id: userId,
    image_url: input.imageUrl,
    prompt: input.prompt,
    platform: input.platform,
    use_logo: input.useLogo,
    use_mascot: input.useMascot,
  });

  const hosted = await hostImage(organizationId, data.image);
  const result: ImageRegenResponse = { image: hosted ?? data.image };

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Image regenerated",
    imageUrl: result.image.image_url,
    customInput: { tool: "regenerate-image", output: result },
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
    customInput: { tool: "regenerate-content", input },
  });

  const { data } = await aiService.post<ContentRegenResponse>(
    "/ai/maya/regenerate-content",
    {
      user_id: userId,
      caption: input.caption,
      prompt: input.prompt,
      platform: input.platform,
    }
  );

  await mayaRepository.createAssistantMessage({
    organizationId,
    userId,
    content: "Caption refreshed",
    customInput: { tool: "regenerate-content", output: data },
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
      base64: input.imageBase64,
      prefix: "maya/publish",
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

  const caption =
    input.hashtags && input.hashtags.length > 0
      ? `${input.caption}\n\n${input.hashtags.join(" ")}`
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
        tool: "publish",
        output: { platform, platformPostId, url },
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
