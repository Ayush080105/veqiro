import type { Message } from "@/lib/types"
import type {
  MayaCampaignResult,
  MayaCarouselDraftResult,
  MayaContentRegenResult,
  MayaDraftResult,
  MayaImageRegenResult,
  MayaVariantResult,
} from "@/lib/types/agents"

/**
 * Fold Maya's regeneration messages back into the card they came from.
 *
 * Regenerating an image or a caption is a correction, not a new result: the
 * customer expects the original card to change, not a second card to appear
 * beneath it. The server stores both messages, so this reassembles them on
 * read — which is also why a refresh does not undo the swap.
 *
 * Moved from the old chat page unchanged. It is Maya-specific, which is why it
 * reaches the framework through her spec's transformMessages rather than
 * living anywhere the other five agents pay for it.
 */
export function mergeMayaMessages(msgWindow: Message[]): Message[] {
    const merged = [...msgWindow]
    const toRemove = new Set<number>()

    for (let i = 0; i < merged.length; i++) {
      const ci = merged[i].customInput
      if (ci?.actionId !== "maya:regenerate-image") continue
      const regenResult = ci.result as MayaImageRegenResult | undefined
      if (!regenResult?.image) continue
      const inputImageUrl = (ci.input as { image_url?: string } | undefined)?.image_url

      let patched = false
      for (let j = i - 1; j >= 0; j--) {
        const src = merged[j].customInput
        if (!src?.actionId || !src.result) continue

        if (src.actionId === "maya:draft-content") {
          const r = src.result as MayaDraftResult
          if (!inputImageUrl || r.image?.image_url === inputImageUrl) {
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, image: regenResult.image } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:draft-carousel") {
          const r = src.result as MayaCarouselDraftResult
          const idx = (r?.slides ?? []).findIndex((s) => s?.image?.image_url === inputImageUrl)
          if (idx >= 0) {
            const newSlides = [...r.slides]
            newSlides[idx] = { ...newSlides[idx], image: regenResult.image }
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, slides: newSlides } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:campaign") {
          const r = src.result as MayaCampaignResult
          const idx = (r?.photos ?? []).findIndex((p) => p?.image?.image_url === inputImageUrl)
          if (idx >= 0) {
            const newPhotos = [...r.photos]
            newPhotos[idx] = { ...newPhotos[idx], image: regenResult.image }
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, photos: newPhotos } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:generate-variants") {
          const r = src.result as MayaVariantResult
          const idx = (r?.variants ?? []).findIndex((v) => v?.image?.image_url === inputImageUrl)
          if (idx >= 0) {
            const newVariants = [...r.variants]
            newVariants[idx] = { ...newVariants[idx], image: regenResult.image }
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, variants: newVariants } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:regenerate-image") {
          const r = src.result as MayaImageRegenResult
          if (r?.image?.image_url === inputImageUrl) {
            merged[j] = { ...merged[j], customInput: { ...src, result: regenResult } }
            patched = true; break
          }
        }
      }

      if (patched) {
        // Also remove the preceding user message that triggered the regen
        if (i > 0 && merged[i - 1].role === "user") toRemove.add(i - 1)
        toRemove.add(i)
      }
    }

    // Merge maya:regenerate-content messages (from regular chat) into the most
    // recent DraftCard's caption/hashtags/cta, then hide the regen message.
    for (let i = 0; i < merged.length; i++) {
      if (toRemove.has(i)) continue
      const ci = merged[i].customInput
      if (ci?.actionId !== "maya:regenerate-content") continue
      const regenResult = ci.result as MayaContentRegenResult | undefined
      if (!regenResult?.caption) continue

      let patched = false
      for (let j = i - 1; j >= 0; j--) {
        if (toRemove.has(j)) continue
        const src = merged[j].customInput
        if (!src?.actionId || !src.result) continue

        if (src.actionId === "maya:draft-content") {
          const r = src.result as MayaDraftResult
          if (!r?.draft) continue
          merged[j] = {
            ...merged[j],
            customInput: {
              ...src,
              result: { ...r, draft: { ...r.draft, body: regenResult.caption, hashtags: regenResult.hashtags, cta: regenResult.cta } },
            },
          }
          patched = true
          break
        }
      }

      if (patched) {
        if (i > 0 && merged[i - 1].role === "user") toRemove.add(i - 1)
        toRemove.add(i)
      }
    }

    return merged.filter((_, i) => !toRemove.has(i))}
