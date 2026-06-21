-- 1. VEGA payload check: Morning Briefing and Evening Wrap-up should have payload set
SELECT name, agent, "cronExpression", payload, "isDefault", "isEnabled", "lastRunAt", "nextRunAt"
FROM "task"
WHERE agent = 'VEGA' AND "isDefault" = true
ORDER BY name;
