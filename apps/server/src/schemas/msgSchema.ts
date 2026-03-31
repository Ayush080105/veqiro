import { z } from "zod";

export const msgSchema = z.object({
    organizationId: z.string().min(1).max(16),
    content: z.string().min(1).max(1000),
    
});

