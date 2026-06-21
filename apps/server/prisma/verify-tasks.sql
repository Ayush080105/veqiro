SELECT name, "cronExpression" FROM "task" WHERE "isDefault" = true GROUP BY name, "cronExpression" ORDER BY name;
