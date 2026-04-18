import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import authRouter from "./modules/auth/auth.routes.js";
import sageRouter from "./modules/sage/sage.routes.js";
import authMiddleware from "./middlewares/auth.middleware.js";
import notFound from "./middlewares/notFound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";

export const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Better Auth must be mounted BEFORE express.json() so it can stream request bodies
app.use(`/api/${env.API_VERSION}/auth`, authRouter);

app.use(express.json());

app.use(`/api/${env.API_VERSION}/sage`, authMiddleware, sageRouter);

app.get("/", (_req, res) => {
  res.send("Hello World");
});

app.use(notFound);
app.use(errorHandler);
