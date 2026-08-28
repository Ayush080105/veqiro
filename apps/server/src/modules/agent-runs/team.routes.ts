import { Router } from "express";
import { getTeam, getTeamMessages, postTeamMessage } from "./team.controller.js";

/**
 * Shared team thread. Mounted under /agents/team behind auth; entitlement is
 * enforced inside the service, which needs the entitled set anyway to decide
 * who is in the room.
 */
export const teamRouter: Router = Router();

teamRouter.get("/", getTeam);
teamRouter.get("/chat", getTeamMessages);
teamRouter.post("/chat", postTeamMessage);
