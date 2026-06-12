export interface BuildContextResponse {
  hot_messages: { role: string; content: string }[]
  semantic_messages: { role: string; content: string }[]
  memory_block: string
}

export interface SharedMemoryShape {
  goals: string[]
  product: string
  decisions: string[]
  userPreferences: string[]
}
