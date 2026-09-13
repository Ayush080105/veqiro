import { Router } from "express";
import { getLastMessages, setMessagePinned, getPinnedMessages, searchMessages } from "./messages.controller.js";

const router = Router();

router.get("/last-messages", getLastMessages);
router.patch("/messages/:id/pin", setMessagePinned);
router.get("/messages/pinned", getPinnedMessages);
router.get("/messages/search", searchMessages);

export default router;
