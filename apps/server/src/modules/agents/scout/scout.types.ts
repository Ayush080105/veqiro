import { z } from "zod";
import {
  sendMessageSchema,
  researchTopicSchema,
  researchCompanySchema,
  scanCompetitorsSchema,
  trendingTopicsSchema,
} from "./scout.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ResearchTopicInput = z.infer<typeof researchTopicSchema>;
export type ResearchCompanyInput = z.infer<typeof researchCompanySchema>;
export type ScanCompetitorsInput = z.infer<typeof scanCompetitorsSchema>;
export type TrendingTopicsInput = z.infer<typeof trendingTopicsSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url: string };
  tokens_used?: number;
  model_used?: string;
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

export interface CompetitorScanResult {
  competitor_name: string;
  url: string;
  has_changes: boolean;
  change_summary: string;
  significance: string;
  new_hash: string;
}

export interface CompetitorScanResponse {
  results: CompetitorScanResult[];
  scanned_at: string;
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
