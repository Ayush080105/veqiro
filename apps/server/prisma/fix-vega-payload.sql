UPDATE "task" SET payload = '{"vegaBriefingType":"MORNING"}', "updatedAt" = NOW()
WHERE "isDefault" = true AND name = 'Morning Briefing';

UPDATE "task" SET payload = '{"vegaBriefingType":"EVENING"}', "updatedAt" = NOW()
WHERE "isDefault" = true AND name = 'Evening Wrap-up';
