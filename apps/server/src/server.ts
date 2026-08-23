import "dotenv/config";
import { app } from "./app.js";
import env from "./config/env.js";
import { startSystemCrons } from "./jobs/system.cron.js";
import { startPlaysCron } from "./modules/mcp/mcp.plays.cron.js";
import { startMcpRetentionCron } from "./modules/mcp/mcp.retention.js";

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
  if (process.env.NODE_ENV !== "test") {
    startSystemCrons();
    startPlaysCron();
    startMcpRetentionCron();
  }
});
