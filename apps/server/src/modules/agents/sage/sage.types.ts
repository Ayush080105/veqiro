import { z } from "zod";
import { sendMessageSchema } from "./sage.schema.js";

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface AssistantMessagePayload {
  response: string;
  image?: { url: string };
  tokens_used?: number;
  model_used?: string;
}
