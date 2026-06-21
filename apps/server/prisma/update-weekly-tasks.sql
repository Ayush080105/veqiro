UPDATE "task"
SET
  "name" = CASE
    WHEN "name" = 'Weekly Financial Digest' THEN 'Financial Digest'
    WHEN "name" = 'Weekly Content Ideas'    THEN 'Content Ideas'
    WHEN "name" = 'Weekly SEO Report'       THEN 'SEO Report'
    ELSE "name"
  END,
  "description" = CASE
    WHEN "name" = 'Weekly Financial Digest' THEN 'Send a daily summary of key financial metrics to your team.'
    WHEN "name" = 'Weekly Content Ideas'    THEN 'Generate fresh content ideas for the day ahead.'
    WHEN "name" = 'Weekly SEO Report'       THEN 'Summarise keyword performance and surface new SEO opportunities.'
    ELSE "description"
  END,
  "cronExpression" = '0 9 * * *',
  "nextRunAt" = NOW() + INTERVAL '1 day',
  "updatedAt" = NOW()
WHERE "isDefault" = true
  AND "cronExpression" = '0 9 * * 1';
