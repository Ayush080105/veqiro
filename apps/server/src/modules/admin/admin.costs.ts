const MODEL_COST_PER_TOKEN: Record<string, number> = {
  "gpt-4.1-mini":     0.40 / 1_000_000,
  "gpt-4o-mini":      0.30 / 1_000_000,
  "gpt-4o":           2.50 / 1_000_000,
  "gemini-2.5-flash": 0.20 / 1_000_000,
  "gemini-2.5-flash-image": 0.20 / 1_000_000,
};
const DEFAULT_COST_PER_TOKEN = 0.30 / 1_000_000;

export const PLAN_MONTHLY_REVENUE: Record<string, number> = {
  MONTHLY: 39,
  ANNUAL: 32.5,
};

export function estimateCost(tokens: number, model: string | null): number {
  const rate = model
    ? (MODEL_COST_PER_TOKEN[model] ?? DEFAULT_COST_PER_TOKEN)
    : DEFAULT_COST_PER_TOKEN;
  return tokens * rate;
}
