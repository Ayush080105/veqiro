import { Router } from "express"
import { getContext, addFact, removeFact, patchOrgMemory } from "./context.controller.js"

const router = Router({ mergeParams: true })

router.get("/", getContext)
router.post("/facts", addFact)
router.delete("/facts/:index", removeFact)
router.patch("/org", patchOrgMemory)

export default router
