# Veqiro Blog — Editorial Overview

> This file is the editorial reference for the Veqiro blog. It indexes all posts, their keyword targets, and status. Edit post content in `content/blog/[slug].md`.

---

## Content Strategy

The blog targets six keyword clusters from the SEO plan:
- **Cluster 1 — AI Employees** (Posts 1, 9, 12)
- **Cluster 2 — Founders/Startups** (Posts 2, 9, 12)
- **Cluster 3 — Per-Agent** (Posts 3–8, one per agent)
- **Cluster 5 — Use Cases** (Posts 11, 12)
- **Cluster 6 — GEO/AI Overviews** (FAQ sections across all posts)

Publishing cadence: 2 posts/week for the first month, 1/week after.

---

## Post Index

| # | Title | Slug | Target Keyword | Agent | Category | Status |
|---|-------|------|----------------|-------|----------|--------|
| 1 | What is an AI Employee? | `what-is-an-ai-employee` | ai employees | — | ai-employees | ✅ Published |
| 2 | AI Employee vs Freelancer | `ai-employee-vs-freelancer` | ai employee vs freelancer | — | founders | ✅ Published |
| 3 | Automate Inbox With AI | `automate-inbox-with-ai` | ai inbox automation | Vega | agents | ✅ Published |
| 4 | AI Competitor Research | `ai-competitor-research-workflow` | ai competitor research tool | Scout | agents | ✅ Published |
| 5 | Writing Content Brand Voice | `writing-content-brand-voice` | ai content brand voice | Maya | agents | ✅ Published |
| 6 | Modern SEO Workflow | `modern-seo-workflow-founders` | ai seo workflow | Sage | agents | ✅ Published |
| 7 | Contract Red Flags | `contract-red-flags-founders` | ai contract red flags | Lex | agents | ✅ Published |
| 8 | SaaS Metrics Explained | `saas-metrics-founders` | saas metrics for founders | Rex | agents | ✅ Published |
| 9 | Build an AI Team | `build-ai-team-startup` | how to build ai team startup | — | ai-employees | ✅ Published |
| 10 | Lindy vs Sintra vs Veqiro | `lindy-vs-sintra-vs-veqiro` | lindy vs sintra vs veqiro | — | comparisons | ✅ Published |
| 11 | Best AI Tools for Agencies | `best-ai-tools-agencies-2026` | ai tools for agencies | — | use-cases | ✅ Published |
| 12 | 3-Person Startup Ships Like 10 | `startup-ships-like-big-team` | lean team ai | — | founders | ✅ Published |

---

## Adding a New Post

1. Create `content/blog/[slug].md` with the frontmatter schema from Post 1
2. Required frontmatter: `title`, `slug`, `date`, `description`, `category`, `keywords`, `readingTime`, `faq` (min 3 Q&As)
3. Add an entry to the table above
4. The post auto-appears in `/blog` index and sitemap on next build

---

## SEO Checklist Per Post

- [ ] Title contains primary keyword naturally
- [ ] Description ≤ 158 characters
- [ ] H1 matches title (or close variant)
- [ ] At least 2 H2s contain secondary keywords
- [ ] Internal link to 2+ agent pages using keyword anchor text
- [ ] FAQ section with 3–5 Q&As (targets Cluster 6 / AI Overview queries)
- [ ] No keyword stuffing — keyword density feels natural
- [ ] At least one comparison table
- [ ] `agentKey` set if post is primarily about one agent
