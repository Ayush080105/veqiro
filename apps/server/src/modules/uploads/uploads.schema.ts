import { z } from "zod";

// Asset kinds the frontend is allowed to ask for. Each maps to a content-type
// allow-list, a max byte size, and the R2 prefix below the org's namespace.
export const UPLOAD_KINDS = ["logo", "mascot", "lex-source"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

interface KindConfig {
  contentTypes: readonly string[];
  maxBytes: number;
  prefix: string;
}

export const KIND_CONFIG: Record<UploadKind, KindConfig> = {
  logo: {
    contentTypes: ALLOWED_IMAGE_TYPES,
    maxBytes: 5 * 1024 * 1024,
    prefix: "brand/logo",
  },
  mascot: {
    contentTypes: ALLOWED_IMAGE_TYPES,
    maxBytes: 5 * 1024 * 1024,
    prefix: "brand/mascot",
  },
  "lex-source": {
    contentTypes: ["application/pdf"],
    maxBytes: 25 * 1024 * 1024,
    prefix: "lex/documents",
  },
};

export const presignUploadSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  contentType: z.string().min(1).max(120),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(50 * 1024 * 1024), // global ceiling, per-kind max enforced in controller
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
