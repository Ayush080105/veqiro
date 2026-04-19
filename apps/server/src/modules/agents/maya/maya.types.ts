import { z } from "zod";
import {
  sendMessageSchema,
  generateIdeasSchema,
  draftContentSchema,
  generateVariantsSchema,
  reviseSchema,
  regenerateImageSchema,
  regenerateContentSchema,
  publishSchema,
} from "./maya.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GenerateIdeasInput = z.infer<typeof generateIdeasSchema>;
export type DraftContentInput = z.infer<typeof draftContentSchema>;
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;
export type ReviseInput = z.infer<typeof reviseSchema>;
export type RegenerateImageInput = z.infer<typeof regenerateImageSchema>;
export type RegenerateContentInput = z.infer<typeof regenerateContentSchema>;
export type PublishInput = z.infer<typeof publishSchema>;

export type ContentPlatform = "linkedin" | "twitter" | "instagram";

export interface ImageResult {
  image_base64?: string;
  image_url?: string;
  content_type: string;
  prompt_used: string;
}

export interface AssistantMessagePayload {
  response: string;
  image?: {
    url?: string;
    image_base64?: string;
    content_type?: string;
    prompt_used?: string;
  };
  tokens_used?: number;
  model_used?: string;
}

export interface ContentIdea {
  title: string;
  content_type: string;
  platform: ContentPlatform;
  hook: string;
  predicted_engagement: string;
  reasoning: string;
  suggested_hashtags: string[];
}

export interface IdeationResponse {
  ideas: ContentIdea[];
  generated_at: string;
  image?: ImageResult | null;
}

export interface DraftContent {
  title: string;
  body: string;
  hashtags: string[];
  cta: string;
  meta_description: string;
  word_count: number;
  platform: ContentPlatform;
  tone_used: string;
}

export interface DraftResponse {
  draft: DraftContent;
  image?: ImageResult | null;
}

export interface ContentVariant {
  platform: ContentPlatform;
  title: string;
  body: string;
  hashtags: string[];
  char_count: number;
  image?: ImageResult | null;
}

export interface VariantResponse {
  variants: ContentVariant[];
}

export interface RevisedContent {
  title: string;
  body: string;
  hashtags: string[];
  cta: string;
}

export interface ReviseResponse {
  revised: RevisedContent;
  changes_made: string[];
}

export interface ImageRegenResponse {
  image: ImageResult;
}

export interface ContentRegenResponse {
  caption: string;
  hashtags: string[];
  cta: string;
}

export interface PublishResponse {
  platform: ContentPlatform;
  platformPostId: string;
  url?: string;
  publishedAt: string;
}
