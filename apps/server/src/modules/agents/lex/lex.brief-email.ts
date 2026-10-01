/** The weekly Legal Brief email body. Kept free of the mail client so it can be unit tested. */
import type { buildBrief } from "./lex.memory.js";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Brief = Awaited<ReturnType<typeof buildBrief>>;

export const renderBriefEmail = (brief: Brief, appUrl: string) => {
  const list = (items: Brief["attention"]) =>
    items
      .map((i) => `<li style="margin:0 0 6px"><strong>${escapeHtml(i.documentName)}</strong> — ${escapeHtml(i.title)}</li>`)
      .join("");
  const body = brief.clear
    ? `<p style="font-size:16px;margin:0 0 12px"><strong>Nothing urgent needs your attention this week.</strong></p>
       <p style="margin:0 0 16px;color:#555">Lex is watching ${brief.monitored} ${brief.monitored === 1 ? "document" : "documents"}.</p>`
    : `<p style="margin:0 0 16px;color:#555">${brief.attentionCount} ${brief.attentionCount === 1 ? "item needs" : "items need"} attention ·
         ${brief.upcomingCount} upcoming ${brief.upcomingCount === 1 ? "date" : "dates"} ·
         ${brief.reviewedThisWeek} ${brief.reviewedThisWeek === 1 ? "document" : "documents"} reviewed this week</p>
       ${brief.attention.length ? `<h3 style="font-size:14px;margin:16px 0 8px">Needs attention</h3><ul style="padding-left:18px;margin:0">${list(brief.attention)}</ul>` : ""}
       ${brief.upcoming.length ? `<h3 style="font-size:14px;margin:16px 0 8px">Upcoming</h3><ul style="padding-left:18px;margin:0">${list(brief.upcoming)}</ul>` : ""}`;
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#15171c;line-height:1.5">
    <h2 style="font-size:20px;margin:0 0 4px">Lex's Legal Brief</h2>
    <p style="margin:0 0 20px;color:#777;font-size:13px">This week</p>
    ${body}
    <p style="margin:24px 0"><a href="${appUrl}/assistants/lex" style="background:#15171c;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Open Lex</a></p>
    <p style="font-size:12px;color:#888;margin:0">Lex provides AI-generated legal information and document analysis. It does not replace advice from a qualified lawyer.
    You can turn this brief off in Lex's settings.</p>
  </div>`;
};
