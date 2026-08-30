import type { Message, MessageDeliveryStatus } from "@/lib/types"

const OPTIMISTIC_ID_PREFIX = "optimistic-"
// The database row is created immediately after the optimistic append; keep
// this narrow so a deliberately repeated prompt is not mistaken for a retry.
const OPTIMISTIC_MATCH_WINDOW_MS = 15_000

function timestamp(message: Message): number {
  const value = new Date(message.createdAt).getTime()
  return Number.isFinite(value) ? value : 0
}

export function isOptimisticMessage(message: Message): boolean {
  return message.id?.startsWith(OPTIMISTIC_ID_PREFIX) ?? false
}

function isLocalMessage(message: Message): boolean {
  return !message.id || isOptimisticMessage(message)
}

function isPersistedEquivalent(local: Message, persisted: Message): boolean {
  const localActionId = local.customInput?.actionId
  const persistedActionId = persisted.customInput?.actionId
  return (
    local.role === persisted.role &&
    local.content === persisted.content &&
    (!localActionId || !persistedActionId || localActionId === persistedActionId) &&
    Math.abs(timestamp(local) - timestamp(persisted)) <= OPTIMISTIC_MATCH_WINDOW_MS
  )
}

function applyLimit(messages: Message[], limit?: number): Message[] {
  if (limit === undefined) return messages
  const safeLimit = Math.max(0, Math.floor(limit))
  if (safeLimit === 0) return []
  if (messages.length <= safeLimit) return messages

  // Client-only rows must survive a server-time/client-time skew. A plain
  // chronological slice can otherwise discard a just-sent optimistic row if
  // the browser clock is behind the server. Fill the remaining slots with the
  // newest persisted rows while preserving display order.
  const localIndexes = messages.flatMap((message, index) =>
    isLocalMessage(message) ? [index] : [],
  )
  if (localIndexes.length >= safeLimit) {
    const retained = new Set(localIndexes.slice(-safeLimit))
    return messages.filter((_message, index) => retained.has(index))
  }

  const persistedSlots = safeLimit - localIndexes.length
  const persistedIndexes = messages.flatMap((message, index) =>
    isLocalMessage(message) ? [] : [index],
  )
  const retained = new Set([
    ...localIndexes,
    ...persistedIndexes.slice(-persistedSlots),
  ])
  return messages.filter((_message, index) => retained.has(index))
}

/**
 * Merge a server snapshot into the visible window without allowing an older
 * response to erase optimistic or locally-failed messages. Persisted ids win,
 * and a persisted user row replaces its optimistic equivalent so refreshes do
 * not render the same prompt twice.
 */
export function mergeMessageWindow(
  current: Message[],
  incoming: Message[],
  limit?: number,
): Message[] {
  const reconciledLocalIndexes = new Set<number>()
  const currentPersistedIds = new Set(
    current
      .filter((message) => message.id && !isLocalMessage(message))
      .map((message) => message.id as string),
  )

  for (const persisted of incoming) {
    if (!persisted.id || currentPersistedIds.has(persisted.id)) continue

    // Multiple identical prompts are valid. Match the closest still-local
    // candidate, rather than the first one in the thread, and never consume a
    // new optimistic prompt for a persisted row already present by id.
    let closestIndex = -1
    let closestDistance = Number.POSITIVE_INFINITY
    current.forEach((message, index) => {
      if (
        reconciledLocalIndexes.has(index) ||
        !isLocalMessage(message) ||
        !isPersistedEquivalent(message, persisted)
      ) {
        return
      }
      const distance = Math.abs(timestamp(message) - timestamp(persisted))
      if (distance < closestDistance) {
        closestIndex = index
        closestDistance = distance
      }
    })
    if (closestIndex >= 0) reconciledLocalIndexes.add(closestIndex)
  }

  const merged = current
    .filter((_message, index) => !reconciledLocalIndexes.has(index))
    .map((message, index) => ({ message, order: index }))
  const indexById = new Map<string, number>()

  merged.forEach(({ message }, index) => {
    if (message.id) indexById.set(message.id, index)
  })

  for (const persisted of incoming) {
    const serverMessage = { ...persisted }
    delete serverMessage.deliveryStatus
    const existingIndex = persisted.id ? indexById.get(persisted.id) : undefined

    if (existingIndex !== undefined) {
      merged[existingIndex] = {
        message: serverMessage,
        order: merged[existingIndex].order,
      }
      continue
    }

    const nextIndex = merged.length
    merged.push({ message: serverMessage, order: nextIndex })
    if (persisted.id) indexById.set(persisted.id, nextIndex)
  }

  const ordered = merged
    .sort((a, b) => timestamp(a.message) - timestamp(b.message) || a.order - b.order)
    .map(({ message }) => message)

  return applyLimit(ordered, limit)
}

/**
 * Replace cached/persisted rows with an authoritative latest-page snapshot,
 * while retaining messages that exist only in the browser. This prevents an
 * empty or shortened server history from leaving stale localStorage rows on
 * screen, without letting a refresh erase an in-flight send or action result.
 */
export function mergeServerSnapshot(
  current: Message[],
  incoming: Message[],
  limit: number,
): Message[] {
  const incomingIds = new Set(
    incoming.flatMap((message) => (message.id ? [message.id] : [])),
  )
  const merged = mergeMessageWindow(current, incoming).filter(
    (message) => isLocalMessage(message) || (message.id ? incomingIds.has(message.id) : true),
  )
  return applyLimit(merged, limit)
}

/** Parse the local chat cache defensively; browser storage is user-editable
 * and older app versions may have left incompatible data behind. */
export function parseCachedMessageWindow(raw: string, limit: number): Message[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const messages = parsed.flatMap((value): Message[] => {
      if (!value || typeof value !== "object") return []
      const candidate = value as Record<string, unknown>
      if (candidate.role !== "user" && candidate.role !== "assistant") return []
      if (typeof candidate.content !== "string") return []
      if (
        typeof candidate.createdAt !== "string" ||
        !Number.isFinite(new Date(candidate.createdAt).getTime())
      ) {
        return []
      }
      if (candidate.id !== undefined && typeof candidate.id !== "string") return []
      if (
        candidate.imageUrl !== undefined &&
        candidate.imageUrl !== null &&
        typeof candidate.imageUrl !== "string"
      ) {
        return []
      }

      const message = {
        ...candidate,
        role: candidate.role,
        content: candidate.content,
        imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : null,
        createdAt: candidate.createdAt,
      } as Message
      if (message.deliveryStatus !== "sending" && message.deliveryStatus !== "failed") {
        delete message.deliveryStatus
      }
      return [message]
    })

    return applyLimit(messages, limit)
  } catch {
    return []
  }
}

export function setMessageDeliveryStatus(
  messages: Message[],
  id: string,
  deliveryStatus: MessageDeliveryStatus | undefined,
): Message[] {
  if (!id) return messages
  return messages.map((message) =>
    message.id === id ? { ...message, deliveryStatus } : message,
  )
}
