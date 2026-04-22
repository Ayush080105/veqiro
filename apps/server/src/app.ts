import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import notFound from "./middlewares/notFound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import router from "./router.js";
import { openApiDocument } from "./docs/swagger.js";
import morgan from "morgan";

export const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);
app.use(morgan("dev"));

// Better Auth must be mounted BEFORE express.json() so it can stream request bodies
app.use(`/api/${env.API_VERSION}/auth`, toNodeHandler(auth));

app.use(express.json());
app.use(`/api/${env.API_VERSION}`, router);

app.get("/docs.json", (_req, res) => res.json(openApiDocument));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get("/", (_req, res) => {
  res.send("Hello World");
});

app.use(notFound);
app.use(errorHandler);
