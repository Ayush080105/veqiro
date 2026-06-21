-- Revert Financial Digest and SEO Report back to weekly (Monday 9am)
UPDATE "task"
SET
  "name" = CASE
    WHEN "name" = 'Financial Digest' THEN 'Weekly Financial Digest'
    WHEN "name" = 'SEO Report'       THEN 'Weekly SEO Report'
  END,
  "description" = CASE
    WHEN "name" = 'Financial Digest' THEN 'Send a weekly summary of key financial metrics to your team.'
    WHEN "name" = 'SEO Report'       THEN 'Summarise keyword performance and surface new SEO opportunities.'
  END,
  "cronExpression" = '0 9 * * 1',
  "nextRunAt" = date_trunc('week', NOW()) + INTERVAL '7 days' + INTERVAL '9 hours',
  "updatedAt" = NOW()
WHERE "isDefault" = true
  AND "name" IN ('Financial Digest', 'SEO Report');

-- Keep Content Ideas as daily at 9am (already updated, just confirm description)
UPDATE "task"
SET
  "description" = 'Generate fresh content ideas for the day ahead.',
  "updatedAt" = NOW()
WHERE "isDefault" = true
  AND "name" = 'Content Ideas';
