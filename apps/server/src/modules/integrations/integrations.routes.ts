import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import {
  listIntegrations,
  authorize,
  callback,
  disconnect,
} from "./integrations.controller.js";

// Public router: OAuth callback (no session needed; state is HMAC-signed)
export const integrationsPublicRouter = Router();
integrationsPublicRouter.get("/:platform/callback", callback);

// Protected router: everything else
const protectedRouter = Router();
protectedRouter.use(authMiddleware);
protectedRouter.get("/", listIntegrations);
protectedRouter.get("/:platform/authorize", authorize);
protectedRouter.delete("/:id", disconnect);

export default protectedRouter;
