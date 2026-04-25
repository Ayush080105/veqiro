import { z } from "zod"

export const CHAT_MESSAGE_MAX = 1000

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Type a message before sending")
    .max(CHAT_MESSAGE_MAX, `Message must be at most ${CHAT_MESSAGE_MAX} characters`),
})

export type ChatMessageValues = z.infer<typeof chatMessageSchema>
