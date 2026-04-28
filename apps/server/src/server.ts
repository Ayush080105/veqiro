import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { startRexCron } from "./modules/agents/rex/rex.cron.js";
import { startVegaCron } from "./modules/agents/vega/vega.cron.js";

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
  if (process.env.NODE_ENV === "production") {
    startRexCron();
    startVegaCron();
  }
});
