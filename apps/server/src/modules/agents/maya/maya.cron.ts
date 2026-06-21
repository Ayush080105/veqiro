import { prisma } from "../../../config/prisma.js";
import { sendMessage } from "./maya.service.js";

export async function runContentIdeasForOrg(organizationId: string) {
  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    select: { userId: true },
  });
  if (!owner) return;

  await sendMessage(owner.userId, organizationId, {
    content:
      "Generate 5 fresh content ideas for today. Vary the formats (short-form, long-form, visual). Use our brand voice and recent content themes.",
  });
}
