// UI option lists rendered in chip / palette pickers. Kept here so individual
// step pages stay focused on layout.

export const INDUSTRIES = [
  "SaaS",
  "E-commerce",
  "Fintech",
  "Healthcare",
  "Education",
  "Media",
  "Agency",
  "Consumer app",
  "Hardware",
  "Nonprofit",
  "Other",
] as const

export const VOICES = [
  { v: "Playful", d: "puns, emojis, loose" },
  { v: "Bold", d: "sharp, confident, short" },
  { v: "Warm", d: "human, empathetic, cozy" },
  { v: "Professional", d: "crisp, formal, clean" },
  { v: "Witty", d: "clever, dry, observant" },
  { v: "Rebellious", d: "loud, opinionated, punk" },
] as const

export const PRESET_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ["#F06464", "#111111", "#EFE7D6"],
  ["#1DBC87", "#0E5C3F", "#FFF9ED"],
  ["#6FCDE8", "#111111", "#FFE37A"],
  ["#F79FD4", "#8A8AF0", "#111111"],
  ["#F5C518", "#F06464", "#111111"],
]

export const DRAFT_KEY = "veqiro.brandKitDraft"
