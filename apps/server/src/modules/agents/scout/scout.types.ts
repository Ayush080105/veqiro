import { z } from "zod";
import {
  sendMessageSchema,
  researchTopicSchema,
  researchCompanySchema,
  trendingTopicsSchema,
  discoverCompetitorsSchema,
} from "./scout.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ResearchTopicInput = z.infer<typeof researchTopicSchema>;
export type ResearchCompanyInput = z.infer<typeof researchCompanySchema>;
export type TrendingTopicsInput = z.infer<typeof trendingTopicsSchema>;
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
export interface TopicPlayerItem {
  name: string;
  role: string;
  note: string;
}

export interface TopicStatItem {
  label: string;
  value: string;
}

export interface ResearchTopicResponse {
  bottom_line: string;
  market_overview: string;
  key_players: TopicPlayerItem[];
  opportunities: string[];
  risks: string[];
  key_stats: TopicStatItem[];
  emerging_trends: string[];
  target_customers: string;
  recommended_actions: string[];
  sources_scraped: string[];
  keywords_found: string[];
  tokens_used?: number;
  model_used?: string;
}

export interface SourceLink {
  title: string;
  url: string;
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
  sources: SourceLink[];
}

export interface ResearchCompanyResponse {
  company: CompanyProfile;
  scraped_at: string;
  tokens_used?: number;
  model_used?: string;
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
  tokens_used?: number;
  model_used?: string;
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
  tokens_used?: number;
  model_used?: string;
}
