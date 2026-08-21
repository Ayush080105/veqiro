import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import  env  from "./config/env.js";
import notFound from "./middlewares/notFound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import { camelizeBody } from "./middlewares/camelizeBody.middleware.js";
import { toNodeHandler } from "better-auth/node";
import  auth  from "./lib/auth.js";
import router from "./router.js";
import { mcpWebhookRouter } from "./modules/mcp/mcp.routes.js";
// TODO : Fix Swagger api refactoring
import { openApiDocument } from "./docs/swagger.js";

// Morgan - Logging
import morgan from "morgan";

export const app = express();


app.use(
  cors({
    origin: [env.CLIENT_URL, env.ADMIN_URL, env.LANDING_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);
app.use(morgan("dev"));

// Better Auth must be mounted BEFORE express.json() so it can stream request bodies
app.use(`/api/${env.API_VERSION}/auth/*splat`, toNodeHandler(auth));

// Composio trigger deliveries, mounted before express.json() and camelizeBody
// for the same reason Better Auth is: the signature covers the exact bytes,
// and camelizing would rewrite Composio's snake_case metadata keys.
app.use(
  `/api/${env.API_VERSION}/mcp/webhooks`,
  express.raw({ type: "application/json", limit: "5mb" }),
  mcpWebhookRouter
);

app.use(express.json({ limit: "20mb" }));
app.use(camelizeBody);
app.use(`/api/${env.API_VERSION}`, router);

app.get("/docs.json", (_req, res) => res.json(openApiDocument));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get("/", (_req, res) => {
  res.send("Veqiro server is running");
});

app.get("/health",(req,res)=>{
  res.send("Healthy")
})

app.use(notFound);
app.use(errorHandler);
