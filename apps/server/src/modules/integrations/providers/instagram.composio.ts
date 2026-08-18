import { BadRequestError } from "../../../common/errors/badRequest.js";
import * as mcpService from "../../mcp/mcp.service.js";
import { stageImageForMeta, stageVideoForMeta } from "./meta-staging.js";

/**
 * Publishes to Instagram through the Composio MCP connection instead of the
 * bespoke Meta Graph provider.
 *
 * Composio's Instagram toolkit uses the same instagram_business_* Instagram
 * Login scopes as the native provider (so it needs no Facebook Page either) and
 * exposes a superset: insights, comments, DMs, stories. Verified live against a
 * BUSINESS account — container creation returned status FINISHED.
 *
 * Two constraints are Meta's, not the provider's, and survive the migration:
 *   1. media must be restaged on an allow-listed host (see meta-staging.ts);
 *   2. a container must reach FINISHED before publishing, or the publish call
 *      fails with code 9007 / subcode 2207027.
 */

// Meta ingests video far more slowly than images.
const READY_TIMEOUT_MS = { image: 60_000, video: 300_000 };
const POLL_INTERVAL_MS = 3_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "me" resolves the authenticated business account, so no id lookup is needed. */
const IG_SELF = "me";

export interface ComposioPublishArgs {
  organizationId: string;
  caption: string;
  imageUrl?: string;
  videoUrl?: string;
  postType?: "post" | "reel";
}

export interface ComposioPublishResult {
  platformPostId: string;
  url?: string;
}

const connectionIdFor = async (organizationId: string): Promise<string> => {
  const connection = (await mcpService.listConnections(organizationId)).find(
    (c) => c.slug === "instagram" && c.status === "CONNECTED",
  );
  if (!connection) {
    throw new BadRequestError(
      "Instagram isn't connected. Connect it from Settings → Integrations to publish.",
    );
  }
  return connection.connectionId;
};

const call = async (
  organizationId: string,
  connectionId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const raw = (await mcpService.callTool(organizationId, connectionId, tool, args)) as {
    successful?: boolean;
    data?: Record<string, unknown>;
  };
  // Composio reports provider-level failures in the body with a 200, so a
  // thrown error is not the only failure mode to handle.
  if (raw?.successful === false) {
    const message =
      typeof raw.data?.message === "string" ? raw.data.message : JSON.stringify(raw.data);
    throw new Error(`${tool} failed: ${String(message).slice(0, 300)}`);
  }
  return raw?.data ?? {};
};

/** Polls until Meta finishes ingesting the container. */
const waitForContainerReady = async (
  organizationId: string,
  connectionId: string,
  creationId: string,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "UNKNOWN";
  while (Date.now() < deadline) {
    const data = await call(organizationId, connectionId, "INSTAGRAM_GET_POST_STATUS", {
      creation_id: creationId,
    });
    lastStatus = String(data.status_code ?? data.status ?? "UNKNOWN");
    if (lastStatus === "FINISHED") return;
    if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
      throw new Error(`Instagram rejected the media (status ${lastStatus})`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Instagram media was still ${lastStatus} after ${Math.round(timeoutMs / 1000)}s — try again`,
  );
};

export interface ComposioPublishCarouselArgs {
  organizationId: string;
  caption: string;
  imageUrls: string[];
}

/**
 * Carousel publish. Composio's CREATE_CAROUSEL_CONTAINER accepts
 * `child_image_urls` directly, so we don't have to create each child container
 * ourselves the way Meta's raw API requires.
 *
 * NOT yet verified against a live account — unlike the single-post path, which
 * was confirmed end to end. Every child still goes through the Cloudinary
 * restage, which is the part most likely to fail, and that is shared with the
 * verified path.
 */
export const publishCarouselViaComposio = async ({
  organizationId,
  caption,
  imageUrls,
}: ComposioPublishCarouselArgs): Promise<ComposioPublishResult> => {
  if (imageUrls.length < 2) {
    throw new BadRequestError("An Instagram carousel needs at least 2 images");
  }
  if (imageUrls.length > 10) {
    throw new BadRequestError("Instagram carousels allow at most 10 images");
  }
  const connectionId = await connectionIdFor(organizationId);

  // Sequential rather than parallel: each restage streams a full image through
  // this process, and Meta rate-limits container creation.
  const staged: string[] = [];
  for (const url of imageUrls) {
    staged.push(await stageImageForMeta(url));
  }

  const container = await call(
    organizationId,
    connectionId,
    "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    { ig_user_id: IG_SELF, caption, child_image_urls: staged },
  );
  const creationId = container.id ?? container.creation_id;
  if (!creationId) {
    throw new Error("Instagram did not return a carousel container id");
  }

  await waitForContainerReady(
    organizationId,
    connectionId,
    String(creationId),
    READY_TIMEOUT_MS.image,
  );

  const published = await call(
    organizationId,
    connectionId,
    "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    { ig_user_id: IG_SELF, creation_id: String(creationId) },
  );
  const platformPostId = published.id ?? published.media_id;
  if (!platformPostId) {
    throw new Error("Instagram carousel publish returned no post id");
  }
  return { platformPostId: String(platformPostId) };
};

export const publishViaComposio = async ({
  organizationId,
  caption,
  imageUrl,
  videoUrl,
  postType,
}: ComposioPublishArgs): Promise<ComposioPublishResult> => {
  if (!imageUrl && !videoUrl) {
    throw new BadRequestError("Instagram publishing requires an image or video URL");
  }
  const connectionId = await connectionIdFor(organizationId);
  const isVideo = Boolean(videoUrl);

  // Restage first: Meta will not fetch from our own CDN hosts.
  const mediaUrl = isVideo
    ? await stageVideoForMeta(videoUrl!)
    : await stageImageForMeta(imageUrl!);

  const containerArgs: Record<string, unknown> = {
    ig_user_id: IG_SELF,
    caption,
  };
  if (isVideo) {
    containerArgs.video_url = mediaUrl;
    // A "post" that carries video is still a reel unless explicitly a feed
    // video — matching the native provider's mapping.
    containerArgs.media_type = postType === "post" ? "VIDEO" : "REELS";
  } else {
    containerArgs.image_url = mediaUrl;
  }

  const container = await call(
    organizationId,
    connectionId,
    "INSTAGRAM_CREATE_MEDIA_CONTAINER",
    containerArgs,
  );
  const creationId = container.id ?? container.creation_id;
  if (!creationId) {
    throw new Error("Instagram did not return a media container id");
  }

  await waitForContainerReady(
    organizationId,
    connectionId,
    String(creationId),
    isVideo ? READY_TIMEOUT_MS.video : READY_TIMEOUT_MS.image,
  );

  const published = await call(
    organizationId,
    connectionId,
    "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    { ig_user_id: IG_SELF, creation_id: String(creationId) },
  );
  const platformPostId = published.id ?? published.media_id;
  if (!platformPostId) {
    throw new Error("Instagram publish returned no post id");
  }

  // The permalink needs a second lookup; failing to get it must not fail an
  // otherwise-successful publish.
  let url: string | undefined;
  try {
    const media = await call(organizationId, connectionId, "INSTAGRAM_GET_IG_MEDIA", {
      ig_media_id: String(platformPostId),
      fields: "permalink",
    });
    if (typeof media.permalink === "string") url = media.permalink;
  } catch {
    // Post is live regardless; the caller just won't get a link.
  }

  return { platformPostId: String(platformPostId), url };
};
