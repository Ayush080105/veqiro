import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { resend } from "../../lib/resend.js";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
});

export const send = async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError("Name, valid email, and message are required");

  const { name, email, message } = parsed.data;

  await resend.emails.send({
    from: process.env.EMAIL_USER!,
    to: "info@veqiro.com",
    subject: `New message from ${name} via Veqiro`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    replyTo: email,
  });

  res.status(StatusCodes.OK).json({ success: true });
};
