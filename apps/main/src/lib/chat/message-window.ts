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

function isPersistedEquivalent(optimistic: Message, persisted: Message): boolean {
  return (
    optimistic.role === "user" &&
    persisted.role === "user" &&
    optimistic.content === persisted.content &&
    Math.abs(timestamp(optimistic) - timestamp(persisted)) <= OPTIMISTIC_MATCH_WINDOW_MS
  )
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
  const reconciledOptimisticIds = new Set<string>()

  for (const persisted of incoming) {
    if (!persisted.id || persisted.role !== "user") continue
    const optimistic = current.find(
      (message) =>
        message.id &&
        !reconciledOptimisticIds.has(message.id) &&
        isOptimisticMessage(message) &&
        isPersistedEquivalent(message, persisted),
    )
    if (optimistic?.id) reconciledOptimisticIds.add(optimistic.id)
  }

  const merged = current
    .filter((message) => !message.id || !reconciledOptimisticIds.has(message.id))
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

  return limit === undefined ? ordered : ordered.slice(-limit)
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
