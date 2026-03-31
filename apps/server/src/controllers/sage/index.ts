import { StatusCodes } from "http-status-codes";
import { Request, Response } from "express";
import { msgSchema } from "../../schemas/msgSchema.js";
import { prisma } from "../../lib/prisma.js";
import { Agent } from "../../../prisma/generated/prisma/client.js";
import { aiService } from "../../utils/aiService.js";
import { BadRequestError } from "../../errors/badRequest.js";

// TODO: Check Authorization
const msgSage = async (req: Request, res: Response) => {
    const validated = msgSchema.parse(req.body);
    const msg = await prisma.message.create({
        data: {
            organizationId: validated.organizationId,
            role: "user",
            content: validated.content,
            agent: Agent.SAGE,
        }
    });
    const history = await prisma.message.findMany({
        where: {
            organizationId: validated.organizationId,
            agent: Agent.SAGE,
        },
        take: 10,
        orderBy: {
            createdAt: "desc",
        },
        select: {
            role: true,
            content: true,
        },
    });

    const response = await aiService.post("/ai/sage/chat", {
        user_id: validated.organizationId,
        conversation_id: msg.id,
        message: validated.content,
        history: history,
    });
    if (!response.data) {
        throw new BadRequestError("Failed to get response from AI");
    }

    await prisma.message.create({
        data: {
            organizationId: validated.organizationId,
            role: "assistant",
            content: response.data.response,
            agent: Agent.SAGE,
            imageUrl: response.data.image?.url,
            tokensUsed: response.data.tokens_used,
            model: response.data.model_used,
        }
    });
    res.status(StatusCodes.OK).json({ role: "assistant", content: response.data.response, imageUrl: response.data.image?.url, createdAt: msg.createdAt });
}

// TODO: Check Authorization
const getSageMessages = async (req: Request, res: Response) => {
    const organizationId = req.query.organizationId as string;
    if (!organizationId) {
        throw new BadRequestError("Organization ID is required");
    }
    const messages = await prisma.message.findMany({
        where: {
            organizationId: organizationId,
            agent: Agent.SAGE,
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            role: true,
            content: true,
            imageUrl: true,
            createdAt: true,
        },
    });
    return res.status(StatusCodes.OK).json(messages);

}

export { msgSage, getSageMessages };