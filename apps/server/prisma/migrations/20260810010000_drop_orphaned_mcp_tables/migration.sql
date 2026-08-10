-- Drop leftover tables from a removed "MCP resource/capability selection"
-- feature. Their create-migrations were applied to some databases directly but
-- never committed to the repo; the feature and all code using it are gone, and
-- the orphaned _prisma_migrations rows were reconciled out of history.
-- IF EXISTS so this is a harmless no-op on databases that never had them
-- (fresh installs, staging).
DROP TABLE IF EXISTS "mcp_capability_preference";
DROP TABLE IF EXISTS "mcp_resource_selection";
