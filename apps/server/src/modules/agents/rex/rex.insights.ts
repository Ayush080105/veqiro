import { Agent, InsightSeverity } from "../../../../prisma/generated/prisma/client.js";
import { upsertInsight } from "../../workspace/insights.service.js";
import { SIMPLE_KINDS } from "../../workspace/simple-agents.workspace.js";

/**
 * Rex's alert rules, as Insights.
 *
 * The rules already existed and already fired — they just only ever produced
 * an email, which meant an org with no configured recipient got nothing at all
 * even though something had genuinely gone wrong with their numbers. A finding
 * is worth recording whether or not anyone wants a message about it.
 */

export interface FiredAlertLike {
  metric: string;
  message: string;
  rule: { label?: string; operator?: string; threshold?: number };
}

/**
 * Alerts are re-evaluated daily against the same rule, so the period segment
 * is the day: a threshold that stays breached updates today's card rather than
 * stacking a new one, and tomorrow is a genuinely new finding the customer has
 * not already dismissed.
 */
function dayPeriod(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Severity from the rule's operator.
 *
 * A metric falling — below a floor, or by more than a tolerated percentage —
 * outranks one rising, because a customer sets a floor precisely because
 * crossing it is the thing they are afraid of. A ceiling is more often a
 * "tell me when this gets interesting".
 */
function severityFor(operator?: string): InsightSeverity {
  return operator === "lt" || operator === "change_lt_pct"
    ? InsightSeverity.HIGH
    : InsightSeverity.MEDIUM;
}

export async function recordRexAlertInsights(
  organizationId: string,
  fired: FiredAlertLike[],
  now = new Date(),
): Promise<void> {
  const period = dayPeriod(now);

  for (const alert of fired) {
    await upsertInsight({
      organizationId,
      agent: Agent.REX,
      dedupeKey: `rex.alert:${alert.metric}:${period}`,
      kind: "rex.alert",
      title: `${alert.rule.label || alert.metric}: ${alert.message}`,
      body: `Your alert rule for ${alert.metric} fired.`,
      severity: severityFor(alert.rule.operator),
      // Explaining a number is the thing Rex is for, so that is the offer.
      suggestedActionId: "rex:analyze-metrics",
      suggestedArgs: { metric: alert.metric },
      objectKind: SIMPLE_KINDS.rexDataset,
      metadata: { metric: alert.metric, threshold: alert.rule.threshold },
    });
  }
}
