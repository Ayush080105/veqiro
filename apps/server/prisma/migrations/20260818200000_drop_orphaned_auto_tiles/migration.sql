-- Remove dashboard tiles that reference the auto-discovered widgets.
--
-- Auto-widgets were built, measured against 14 live connections, and removed:
-- only 9 of 42 candidates rendered anything and those still titled rows "INR"
-- and "siteOwner". Tiles pinned while the feature existed now reference widget
-- ids that no catalog entry can resolve, so they are invisible in the picker
-- (listTiles skips unresolvable widgets) and cannot be deleted from the UI —
-- dead rows that only ever produce "Unknown widget" errors.
DELETE FROM "mcp_dashboard_tile" WHERE "widgetId" LIKE 'auto:%';
