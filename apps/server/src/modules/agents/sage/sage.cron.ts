import { prisma } from "../../../config/prisma.js";
import { sendMessage } from "./sage.service.js";

export async function runSeoReportForOrg(organizationId: string) {
  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    select: { userId: true },
  });
  if (!owner) return;

  await sendMessage(owner.userId, organizationId, {
    content:
      "Generate a weekly SEO summary: review our top keywords, surface ranking changes, and suggest 3 actionable opportunities for this week.",
  });
}
