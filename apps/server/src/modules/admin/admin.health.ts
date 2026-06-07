export type OrgHealthInput = {
  subscriptionStatus: string | null;
  messagesLast7d: number;
  messagesLast30d: number;
  agentsUsedLast30d: number;
  hasSocialAccount: boolean;
  hasBrandKitDescription: boolean;
  hasBrandKitCrawled: boolean;
  memberCount: number;
};

export type OrgHealthResult = {
  score: number;
  label: "Healthy" | "Watch" | "At Risk";
  color: "green" | "yellow" | "red";
};

export function computeOrgHealth(input: OrgHealthInput): OrgHealthResult {
  const statusCap =
    input.subscriptionStatus === "ACTIVE"
      ? 100
      : input.subscriptionStatus === "TRIALING" ||
          input.subscriptionStatus === "PAST_DUE"
        ? 70
        : 30;

  let score = 0;
  if (input.messagesLast7d >= 1) score += 20;
  if (input.messagesLast7d >= 10) score += 10;
  if (input.agentsUsedLast30d >= 2) score += 15;
  if (input.hasSocialAccount) score += 10;
  if (input.hasBrandKitDescription) score += 10;
  if (input.hasBrandKitCrawled) score += 10;
  if (input.memberCount > 1) score += 5;

  score = Math.min(score, statusCap);

  const label: OrgHealthResult["label"] =
    score >= 80 ? "Healthy" : score >= 50 ? "Watch" : "At Risk";
  const color: OrgHealthResult["color"] =
    score >= 80 ? "green" : score >= 50 ? "yellow" : "red";

  return { score, label, color };
}
