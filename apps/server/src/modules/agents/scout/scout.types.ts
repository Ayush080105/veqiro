import { z } from "zod";
import {
  sendMessageSchema,
  researchTopicSchema,
  researchCompanySchema,
  trendingTopicsSchema,
  addCompetitorSchema,
  discoverCompetitorsSchema,
} from "./scout.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ResearchTopicInput = z.infer<typeof researchTopicSchema>;
export type ResearchCompanyInput = z.infer<typeof researchCompanySchema>;
export type TrendingTopicsInput = z.infer<typeof trendingTopicsSchema>;
export type AddCompetitorInput = z.infer<typeof addCompetitorSchema>;
export type DiscoverCompetitorsInput = z.infer<typeof discoverCompetitorsSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url?: string; image_base64?: string; content_type?: string; prompt_used?: string };
  tokens_used?: number;
  model_used?: string;
  action_id?: string;
  action_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Mirror AI-side response shapes (snake_case preserved — proxied verbatim)
export interface ResearchTopicResponse {
  findings: string;
  synthesis: string;
  sources_scraped: string[];
  keywords_found: string[];
}

export interface CompanyProfile {
  name: string;
  description: string;
  founded: string;
  team_size: string;
  funding: string;
  key_features: string[];
  pricing: Record<string, string>;
  target_market: string;
  strengths: string[];
  weaknesses: string[];
  recent_news: string[];
}

export interface ResearchCompanyResponse {
  company: CompanyProfile;
  scraped_at: string;
}

export interface TrendItem {
  topic: string;
  momentum: string;
  relevance_score: number;
  content_angle: string;
  search_volume_estimate: string;
}

export interface TrendingTopicsResponse {
  trends: TrendItem[];
  generated_at: string;
}

export interface CompetitorWatch {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  latestHash: string | null;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface DiscoveredCompetitor {
  name: string;
  url: string;
  why_competitive: string;
  pricing_model: string;
}

export interface DiscoverCompetitorsResponse {
  competitors: DiscoveredCompetitor[];
  generated_at: string;
}
