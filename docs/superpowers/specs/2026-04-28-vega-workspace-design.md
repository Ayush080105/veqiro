# Vega Workspace Design Spec

> See full approved spec at: `C:\Users\AYUSH\.claude\plans\inbox-email-snoopy-wren.md`

This spec is a condensed reference for engineers implementing the Vega Workspace feature.

## What We're Building

A dedicated workspace inside Veqiro where users manage their entire email and calendar life:
- `/workspace/inbox` — Smart Inbox with AI-triaged emails, inline reply, follow-ups
- `/workspace/calendar` — Week/day calendar with meeting intelligence (Phase 2)
- `/workspace/briefing` — Daily executive briefing (already exists, connecting real data)

## Architecture Decision

**Workspace-first:** All email/calendar actions happen inline in the workspace pages. No reliance on Vega chat. All new routes are self-contained.

## Phases

- **Phase 1 (this plan):** Smart Inbox + Briefing + DB models + AI enhancement
- **Phase 2:** Calendar workspace
- **Phase 3:** Trigger.dev automation (briefings, follow-up checks)
- **Phase 4:** Personalization, voice commands

## Tech Stack

- Frontend: Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui + TanStack React Query 5
- Backend: Express 5 + Prisma 7 + PostgreSQL
- AI Engine: FastAPI + Python (existing at `apps/ai/`)
- Gmail + Calendar: via existing `googleApis.ts` + `googleAuth.ts` utilities
