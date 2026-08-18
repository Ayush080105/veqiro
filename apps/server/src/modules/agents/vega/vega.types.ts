import type { ToolTraceEntry } from "../../mcp/mcp.types.js";
import { z } from "zod";
import { sendMessageSchema } from "./vega.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url?: string; image_base64?: string; content_type?: string; prompt_used?: string };
  tokens_used?: number;
  model_used?: string;
  action_id?: string;
  action_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Visible tool trace for this turn — see mcp.service.ts's withToolTrace. */
  tool_trace?: ToolTraceEntry[];
}
