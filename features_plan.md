
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Veqiro Landing — New Pages Implementation Plan

 ▎ For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan
 ▎  task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

 Goal: Build 9 new pages for the Veqiro landing site (apps/landing) — 6 individual agent pages with interactive demo chat, plus About, Privacy, and Terms —
  all matching the existing bold brutalist theme.

 Architecture: New pages live under src/app/ using Next.js App Router dynamic routes. Shared components (nav, footer) are extracted to reusable files. All
 agent page data (descriptions, capabilities, demo chats) lives in src/components/veqiro/data.ts. Style philosophy is identical to existing: inline styles
 using CSS variables and the FONT constants from shared.tsx.

 Tech Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 (inline styles preferred) · existing component patterns from shared.tsx

 IMPORTANT: Before writing any Next.js-specific code (dynamic routes, metadata, generateStaticParams), read node_modules/next/dist/docs/ in the landing
 folder — the project CLAUDE.md warns this version has breaking changes.

 ---
 Context

 Veqiro's home page is done. For launch we need:
 - 6 agent pages (/agents/maya, /agents/rex, etc.) so users can understand each AI employee in depth, with an interactive demo chat on each page
 - About page — brand story, mission, values (trust builder)
 - Privacy Policy and Terms of Service — legally required; already referenced in footer (currently dummy links)

 All new pages must match the existing design: beige #EFE7D6 background, #111 ink, thick 3px borders, box-shadows, display font (Bagel Fat One), playful
 tone.

 ---
 File Map

 Create:
 - src/components/veqiro/page-nav.tsx — shared nav for inner pages (links prefixed with /#)
 - src/components/veqiro/mobile-chat.tsx — phone-frame animated demo chat
 - src/components/veqiro/agent-page.tsx — full agent page layout
 - src/app/agents/[slug]/page.tsx — dynamic route for all 6 agents
 - src/app/about/page.tsx — About Veqiro
 - src/app/privacy/page.tsx — Privacy Policy
 - src/app/terms/page.tsx — Terms of Service

 Modify:
 - src/components/veqiro/data.ts — add description, capabilities, useCases, demoChat to each Employee
 - src/components/veqiro/crew.tsx — add <Link href={/agents/${key}}> on each crew card
 - src/lib/site-config.ts — update footer crew links to /agents/[key], update privacy/terms links to real routes
 - src/app/sitemap.ts — add all 9 new routes

 ---
 Task 1: Extend Employee data in data.ts

 Files: Modify src/components/veqiro/data.ts

 - Step 1: Add new types to the Employee interface

 export interface DemoChatMessage {
   role: 'user' | 'agent';
   content: string;
   delayMs: number;
 }

 export interface AgentCapability {
   title: string;
   description: string;
 }

 export interface Employee {
   key: string;
   name: string;
   role: string;
   tag: string;
   color: string;
   ink: string;
   skills: string[];
   quote: string;
   stats: { k: string; v: string }[];
   // NEW: agent page fields
   description: string;
   capabilities: AgentCapability[];
   useCases: string[];
   demoChat: DemoChatMessage[];
 }

 - Step 2: Add page data for all 6 employees (add below existing fields)

 For Vega:
 description: "Vega runs your inbox, books your calendar, and writes emails that actually sound like you — without you asking twice. She handles the
 scheduling chaos so your brain stays on the work that matters.",
 capabilities: [
   { title: "Inbox Triage", description: "Reads every email, flags the urgent ones, drafts replies for the rest. You review, approve, done." },
   { title: "Calendar Management", description: "Books meetings, spots conflicts, finds free slots, and blocks deep-work time before someone else does." },
   { title: "Daily Briefing", description: "Every morning: a crisp summary of your day, open threads, and what needs a decision." },
   { title: "Email Drafting", description: "Compose from scratch or reply to a thread — in your voice, with your usual sign-off." },
 ],
 useCases: [
   "Founders drowning in 300+ emails a day",
   "Sales leaders juggling back-to-back demos",
   "Operators coordinating across 4 time zones",
   "Anyone who loses 2 hours a day to scheduling",
 ],
 demoChat: [
   { role: 'user', content: "Vega, what's on my calendar this week?", delayMs: 800 },
   { role: 'agent', content: "You've got 11 events. Tuesday is brutal — 4 back-to-back. I moved the vendor sync to Thursday. Also: Sarah's been trying to
 reach you since Monday. Want me to draft a reply?", delayMs: 1600 },
   { role: 'user', content: "Yes, keep it short. And block Friday afternoon.", delayMs: 3200 },
   { role: 'agent', content: "Done. Reply sent. Friday 1–5pm blocked as 'Focus — do not book'. I also bumped the investor call to 10am before your block.",
  delayMs: 4800 },
 ],

 For Scout:
 description: "Scout digs into competitors, markets, and companies so you don't have to spend a Thursday in browser tabs. She gives you a memo, not a data
 dump — with the stuff that actually matters highlighted.",
 capabilities: [
   { title: "Competitor Research", description: "Full teardown of any competitor: product, pricing, positioning, recent moves, and what their customers
 complain about." },
   { title: "Market Trends", description: "Spots rising topics in your industry with momentum scores and content angles to get ahead of the wave." },
   { title: "Lead Research", description: "Builds detailed profiles on target companies: size, funding, tech stack, key contacts, and why now." },
   { title: "Research Memos", description: "Synthesizes web sources into a clean memo with sources, key takeaways, and recommended actions." },
 ],
 useCases: [
   "Founders doing competitive diligence before a fundraise",
   "Sales teams qualifying enterprise accounts",
   "Product teams tracking competitor feature launches",
   "Marketers looking for trending content angles",
 ],
 demoChat: [
   { role: 'user', content: "Scout, what's happening with our top 3 competitors this month?", delayMs: 800 },
   { role: 'agent', content: "Pulled 23 sources. Two things worth flagging: Rival A just dropped pricing by 20% on their starter plan — probably responding
  to churn. Rival B launched an integration with Salesforce last week.", delayMs: 1800 },
   { role: 'user', content: "How should we respond to the pricing move?", delayMs: 3400 },
   { role: 'agent', content: "Three options: match it (risky margin hit), reframe on value (safer), or stay quiet and let it play out (they might reverse
 it — it happened in Q3 last year). Want the memo?", delayMs: 5000 },
 ],

 For Maya:
 description: "Maya writes content that doesn't sound like it came from an AI — because she's trained on what actually gets engagement, not what sounds
 nice. Give her a topic and she'll have three versions ready before you finish your coffee.",
 capabilities: [
   { title: "Social Media Posts", description: "Platform-native drafts for LinkedIn, Twitter/X, and Instagram — with hooks, hashtags, and predicted
 engagement baked in." },
   { title: "Blog & Long-form", description: "Full-length articles with structure, flow, and a voice that matches your brand — not a Wikipedia entry." },
   { title: "Ad Copy", description: "Headlines, body copy, CTAs for paid campaigns — built around your ICP and brand tone." },
   { title: "Image Generation", description: "Auto-generates social images using your brand colors, logo, and mascot. No Canva required." },
 ],
 useCases: [
   "Marketing teams producing content across 3+ platforms",
   "Founders who need to post consistently but can't write daily",
   "Agencies managing content for multiple brands",
   "Product launches that need a blitz across channels",
 ],
 demoChat: [
   { role: 'user', content: "Maya, write me a LinkedIn post about our new feature — AI-powered onboarding.", delayMs: 800 },
   { role: 'agent', content: "Got it. I did 3 angles: (1) the 'before vs after' story, (2) a data-first hook with a stat, (3) a cheeky one that might get
 comments. Which direction?", delayMs: 1800 },
   { role: 'user', content: "Go with the cheeky one.", delayMs: 3200 },
   { role: 'agent', content: "\"We just made onboarding so fast, our users are confused why it's already over. New: AI that sets you up in 4 minutes. No
 wizard. No 47-step checklist. Just done. Link in bio →\" — posting with an image I generated. Want to see it first?", delayMs: 5000 },
 ],

 For Sage:
 description: "Sage knows how search actually works right now — not the theory from 2019. She does keyword research, writes SEO-optimized content, and
 audits what you already have so your pages actually show up.",
 capabilities: [
   { title: "Keyword Research", description: "Intent-classified keyword lists with difficulty scores, volume, and a clear picture of what to target first."
  },
   { title: "Blog Generation", description: "Full SEO-optimized articles with correct heading structure, meta tags, schema markup, and internal link
 suggestions." },
   { title: "Content Audits", description: "Scores your existing pages against ranking factors and surfaces specific improvements — not vague advice." },
   { title: "Content Briefs", description: "Strategic briefs for writers: SERP analysis, competitor gaps, questions to answer, and word count targets." },
 ],
 useCases: [
   "SaaS companies trying to rank for bottom-of-funnel keywords",
   "Startups with existing content that isn't converting",
   "Marketing teams without a dedicated SEO hire",
   "Blogs that need consistent output without sacrificing quality",
 ],
 demoChat: [
   { role: 'user', content: "Sage, what keywords should we target this quarter?", delayMs: 800 },
   { role: 'agent', content: "Ran the research. You're ignoring 3 high-intent, low-competition clusters that your rivals haven't touched yet. The biggest:
 'ai employee scheduling' — 2,400 searches/mo, difficulty 28. That's a 2-week win.", delayMs: 2000 },
   { role: 'user', content: "Write me a post targeting that keyword.", delayMs: 3600 },
   { role: 'agent', content: "Done — 1,400 words, H2 structure, FAQ schema, internal links to your pricing page. It's sitting in the content hub ready to
 publish. Est. time to rank: 3–4 weeks if we get 3 backlinks.", delayMs: 5200 },
 ],

 For Lex:
 description: "Lex reads contracts, spots the traps, and explains what the clauses actually mean — in plain English, not legalese. She doesn't replace a
 lawyer, but she makes sure you don't go into a lawyer meeting blind.",
 capabilities: [
   { title: "Contract Review", description: "Flags risky clauses, missing protections, and unusual terms in NDAs, MSAs, vendor agreements, and employment
 contracts." },
   { title: "Document Drafting", description: "Generates legal templates for standard startup docs: NDAs, SaaS agreements, offer letters, contractor
 agreements." },
   { title: "Plain English Explanations", description: "Turns legalese into clear language with a key terms glossary. What it means, and what it means for
 you." },
   { title: "Compliance Checks", description: "Evaluates your practices against GDPR, CCPA, SOC2, HIPAA, and PCI-DSS — with a prioritized fix list." },
 ],
 useCases: [
   "Founders reviewing their first enterprise contract",
   "Startups about to sign a vendor agreement",
   "Teams preparing for a SOC2 or GDPR audit",
   "Anyone who needs an NDA fast but can't wait for counsel",
 ],
 demoChat: [
   { role: 'user', content: "Lex, I just got a 40-page MSA from an enterprise client. Can you review it?", delayMs: 800 },
   { role: 'agent', content: "Uploading now. Give me 90 seconds. ... Done. 6 flags. The big ones: Clause 12.4 gives them perpetual license to your IP —
 that needs to go. Clause 18 has uncapped liability exposure. The indemnification terms are one-sided.", delayMs: 2400 },
   { role: 'user', content: "Draft suggested edits for clause 12.4.", delayMs: 4000 },
   { role: 'agent', content: "Redline ready: replaced 'perpetual, irrevocable' with 'limited, revocable license for the term of the agreement.' Also added
 a clear ownership carve-out for your existing IP. Sending to your email as a Word doc.", delayMs: 5600 },
 ],

 For Rex:
 description: "Rex turns your business numbers into a story you actually understand — and flags the weird stuff before it becomes a real problem. He looks
 at MRR, burn, CAC, and churn so you always know exactly where you stand.",
 capabilities: [
   { title: "Financial Analysis", description: "Full P&L breakdown: MRR, ARR, burn rate, runway, CAC, LTV — with health indicators and what to focus on."
 },
   { title: "Revenue Forecasting", description: "Project revenue, growth, and churn forward with confidence bands and scenario modeling." },
   { title: "Anomaly Detection", description: "Flags unusual spikes, drops, or patterns in your metrics before they show up in next month's board deck." },
   { title: "Investor Updates", description: "Generates polished investor update emails from your metrics — you just approve and send." },
 ],
 useCases: [
   "Founders preparing for a fundraise or board meeting",
   "Operators who need daily metric visibility without a CFO",
   "Teams trying to understand their unit economics",
   "Anyone who's ever been surprised by their burn rate",
 ],
 demoChat: [
   { role: 'user', content: "Rex, how's our financial health this month?", delayMs: 800 },
   { role: 'agent', content: "Revenue's up 12% MoM — good. But your CAC spiked 3x on Meta last Tuesday. Something changed. Churn is flat at 2.1%. Runway:
 14 months at current burn.", delayMs: 1800 },
   { role: 'user', content: "What happened with Meta CAC?", delayMs: 3200 },
   { role: 'agent', content: "Your top-performing ad set got flagged and paused — budget shifted to a weaker creative. The anomaly started at 2pm Tuesday.
 Want me to model what happens if we pause Meta entirely and double down on organic?", delayMs: 4800 },
 ],

 - Step 3: Verify TypeScript compiles cleanly

 Run: cd apps/landing && npx tsc --noEmit
 Expected: No errors.

 - Step 4: Commit

 git add apps/landing/src/components/veqiro/data.ts
 git commit -m "feat(landing): add agent page data (descriptions, capabilities, demo chats)"

 ---
 Task 2: Create MobileChatDemo component

 Files: Create src/components/veqiro/mobile-chat.tsx

 - Step 1: Create the file

 'use client';
 import React, { useState, useEffect, useRef } from 'react';
 import { FONT } from './shared';
 import type { Employee, DemoChatMessage } from './data';

 interface Props {
   employee: Employee;
 }

 interface DisplayMessage extends DemoChatMessage {
   id: number;
 }

 export function MobileChatDemo({ employee }: Props) {
   const [messages, setMessages] = useState<DisplayMessage[]>([]);
   const [typing, setTyping] = useState(false);
   const [done, setDone] = useState(false);
   const [key, setKey] = useState(0); // increment to restart
   const scrollRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     setMessages([]);
     setTyping(false);
     setDone(false);
     let cancelled = false;

     const run = async () => {
       for (let i = 0; i < employee.demoChat.length; i++) {
         const msg = employee.demoChat[i];
         await new Promise(r => setTimeout(r, msg.delayMs));
         if (cancelled) return;
         if (msg.role === 'agent') {
           setTyping(true);
           await new Promise(r => setTimeout(r, 900));
           if (cancelled) return;
           setTyping(false);
         }
         setMessages(prev => [...prev, { ...msg, id: i }]);
       }
       if (!cancelled) setDone(true);
     };

     run();
     return () => { cancelled = true; };
   }, [key, employee]);

   // Auto-scroll
   useEffect(() => {
     if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
   }, [messages, typing]);

   return (
     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
       {/* Phone frame */}
       <div style={{
         width: 320, height: 580, background: '#111',
         borderRadius: 42, border: '3px solid #333',
         boxShadow: `0 0 0 6px #111, 0 0 0 9px ${employee.color}, 8px 16px 0 rgba(0,0,0,0.3)`,
         display: 'flex', flexDirection: 'column', overflow: 'hidden',
         position: 'relative',
       }}>
         {/* Status bar */}
         <div style={{
           padding: '16px 20px 8px', display: 'flex',
           justifyContent: 'space-between', alignItems: 'center',
         }}>
           <span style={{ color: '#888', fontFamily: FONT.mono, fontSize: 11 }}>9:41</span>
           <div style={{
             width: 90, height: 22, background: '#1a1a1a',
             borderRadius: 999, border: '1px solid #333',
           }} />
           <span style={{ color: '#888', fontFamily: FONT.mono, fontSize: 11 }}>●●●</span>
         </div>

         {/* Chat header */}
         <div style={{
           padding: '8px 16px 12px', borderBottom: '1px solid #222',
           display: 'flex', alignItems: 'center', gap: 10,
         }}>
           <div style={{
             width: 36, height: 36, borderRadius: '50%',
             background: employee.color, border: '2px solid #333',
             display: 'grid', placeItems: 'center',
             fontFamily: FONT.head, fontSize: 14, color: employee.ink,
           }}>
             {employee.name[0]}
           </div>
           <div>
             <div style={{ color: '#eee', fontFamily: FONT.head, fontSize: 14 }}>{employee.name}</div>
             <div style={{ color: '#1DBC87', fontFamily: FONT.mono, fontSize: 10 }}>● online</div>
           </div>
         </div>

         {/* Messages area */}
         <div ref={scrollRef} style={{
           flex: 1, overflowY: 'auto', padding: '16px 12px',
           display: 'flex', flexDirection: 'column', gap: 10,
           scrollbarWidth: 'none',
         }}>
           {messages.map(msg => (
             <div key={msg.id} style={{
               display: 'flex',
               justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
             }}>
               <div style={{
                 maxWidth: '78%',
                 background: msg.role === 'user' ? employee.color : '#1e1e1e',
                 color: msg.role === 'user' ? employee.ink : '#ddd',
                 borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                 padding: '10px 14px',
                 fontFamily: FONT.body, fontSize: 13, lineHeight: 1.5,
                 border: `1px solid ${msg.role === 'user' ? 'transparent' : '#2a2a2a'}`,
               }}>
                 {msg.content}
               </div>
             </div>
           ))}

           {typing && (
             <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
               <div style={{
                 background: '#1e1e1e', borderRadius: '18px 18px 18px 4px',
                 padding: '12px 16px', border: '1px solid #2a2a2a',
                 display: 'flex', gap: 5, alignItems: 'center',
               }}>
                 {[0, 1, 2].map(i => (
                   <div key={i} style={{
                     width: 6, height: 6, borderRadius: '50%', background: '#555',
                     animation: 'bounce 1s infinite',
                     animationDelay: `${i * 0.2}s`,
                   }} />
                 ))}
               </div>
             </div>
           )}
         </div>

         {/* Input bar */}
         <div style={{
           padding: '12px', borderTop: '1px solid #222',
           display: 'flex', gap: 8, alignItems: 'center',
         }}>
           <div style={{
             flex: 1, background: '#1a1a1a', borderRadius: 999,
             padding: '10px 16px', color: '#444',
             fontFamily: FONT.body, fontSize: 13,
             border: '1px solid #2a2a2a',
           }}>
             Message {employee.name}…
           </div>
           <div style={{
             width: 36, height: 36, borderRadius: '50%',
             background: employee.color, display: 'grid', placeItems: 'center',
             cursor: 'pointer',
           }}>
             <span style={{ color: employee.ink, fontSize: 16 }}>↑</span>
           </div>
         </div>
       </div>

       {/* Replay button */}
       {done && (
         <button
           onClick={() => setKey(k => k + 1)}
           style={{
             background: 'transparent', border: `2px solid #111`,
             borderRadius: 999, padding: '8px 20px',
             fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase',
             letterSpacing: 1, cursor: 'pointer',
             boxShadow: '3px 3px 0 #111',
           }}
         >
           ↺ Replay demo
         </button>
       )}
     </div>
   );
 }

 - Step 2: Verify no TypeScript errors

 Run: cd apps/landing && npx tsc --noEmit
 Expected: No errors.

 - Step 3: Commit

 git add apps/landing/src/components/veqiro/mobile-chat.tsx
 git commit -m "feat(landing): add MobileChatDemo phone-frame component"

 ---
 Task 3: Create PageNav shared component

 Files: Create src/components/veqiro/page-nav.tsx

 Inner pages need the same nav but with /#crew, /#pricing etc. links (full-path anchors).

 - Step 1: Create page-nav.tsx

 import React from 'react';
 import Link from 'next/link';
 import { FONT, Button } from './shared';
 import { mainAppUrl } from '@/lib/site-config';

 export function PageNav() {
   const links = [
     { href: '/#crew', label: 'The Crew' },
     { href: '/#how', label: 'How it Works' },
     { href: '/#pricing', label: 'Pricing' },
     { href: '/#faq', label: 'FAQ' },
   ];

   return (
     <nav style={{
       display: 'flex', justifyContent: 'space-between', alignItems: 'center',
       maxWidth: 1400, margin: '0 auto', padding: '40px 32px',
     }}>
       <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
         <div style={{
           width: 42, height: 42, background: '#111', borderRadius: 10,
           display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
           boxShadow: '3px 3px 0 #F5C518',
         }}>
           <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 24 }}>v</span>
         </div>
         <span style={{ fontFamily: FONT.display, fontSize: 22, color: '#111' }}>veqiro</span>
       </Link>

       <div style={{ display: 'flex', gap: 28 }}>
         {links.map(l => (
           <Link key={l.href} href={l.href} style={{
             fontFamily: FONT.head, fontSize: 13, textTransform: 'uppercase',
             letterSpacing: 1, color: '#111', textDecoration: 'none',
           }}>
             {l.label}
           </Link>
         ))}
       </div>

       <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
         <Button variant="ghost" href={`${mainAppUrl}/login`}>Sign in</Button>
         <Button variant="primary" href={`${mainAppUrl}/signup`}>Get the crew</Button>
       </div>
     </nav>
   );
 }

 - Step 2: Verify no TypeScript errors

 Run: cd apps/landing && npx tsc --noEmit
 Expected: No errors.

 ---
 Task 4: Create AgentPage layout component

 Files: Create src/components/veqiro/agent-page.tsx

 This is the full page layout for each agent. No data is hardcoded — everything comes from the Employee object.

 - Step 1: Create agent-page.tsx

 'use client';
 import React from 'react';
 import Link from 'next/link';
 import { FONT, Button } from './shared';
 import { PageNav } from './page-nav';
 import { MobileChatDemo } from './mobile-chat';
 import { mainAppUrl } from '@/lib/site-config';
 import type { Employee } from './data';

 // Re-import character SVGs lazily
 import dynamic from 'next/dynamic';

 interface Props {
   employee: Employee;
 }

 export function AgentPage({ employee }: Props) {
   return (
     <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
       <PageNav />

       {/* HERO — agent color band */}
       <section style={{
         background: employee.color, borderTop: '3px solid #111', borderBottom: '3px solid #111',
         padding: '80px 32px',
       }}>
         <div style={{
           maxWidth: 1400, margin: '0 auto',
           display: 'grid', gridTemplateColumns: '1fr auto', gap: 64, alignItems: 'center',
         }}>
           <div>
             {/* Back breadcrumb */}
             <Link href="/#crew" style={{
               fontFamily: FONT.mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2,
               color: employee.ink, textDecoration: 'none', marginBottom: 24, display: 'inline-block',
             }}>
               ← The Crew
             </Link>

             {/* Label */}
             <div style={{
               fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase',
               color: employee.ink, marginBottom: 16, opacity: 0.7,
             }}>
               [ AI EMPLOYEE ]
             </div>

             {/* Name */}
             <h1 style={{
               fontFamily: FONT.display, fontSize: 'clamp(72px, 10vw, 140px)',
               margin: 0, lineHeight: 0.9, letterSpacing: -2, color: '#111',
             }}>
               {employee.name}
             </h1>

             {/* Role */}
             <div style={{
               fontFamily: FONT.head, fontSize: 'clamp(18px, 2.5vw, 28px)', marginTop: 12,
               color: employee.ink, fontWeight: 700,
             }}>
               {employee.role}
             </div>

             {/* Tagline */}
             <div style={{
               fontFamily: FONT.body, fontSize: 'clamp(16px, 2vw, 22px)', marginTop: 16,
               color: employee.ink, lineHeight: 1.4, maxWidth: 480,
             }}>
               {employee.description}
             </div>

             {/* Stats row */}
             <div style={{ display: 'flex', gap: 32, marginTop: 40 }}>
               {employee.stats.map(s => (
                 <div key={s.k}>
                   <div style={{ fontFamily: FONT.display, fontSize: 36, color: '#111', lineHeight: 1 }}>{s.v}</div>
                   <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: employee.ink, marginTop: 4
 }}>{s.k}</div>
                 </div>
               ))}
             </div>

             {/* CTAs */}
             <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
               <Button variant="dark" href={`${mainAppUrl}/signup`}>Hire {employee.name} →</Button>
               <Button variant="ghost" href="/#pricing">See pricing</Button>
             </div>
           </div>

           {/* RIGHT: Mobile chat demo */}
           <MobileChatDemo employee={employee} />
         </div>
       </section>

       {/* CAPABILITIES */}
       <section style={{ padding: '80px 32px', borderBottom: '3px solid #111' }}>
         <div style={{ maxWidth: 1400, margin: '0 auto' }}>
           <div style={{ marginBottom: 48 }}>
             <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>
               [ WHAT {employee.name.toUpperCase()} DOES ]
             </div>
             <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, lineHeight: 0.9 }}>
               real work.<br />
               <span style={{
                 background: employee.color, padding: '0 16px', display: 'inline-block',
                 transform: 'rotate(-1.5deg)', border: '3px solid #111', borderRadius: 8, boxShadow: '4px 4px 0 #111',
               }}>
                 every day.
               </span>
             </h2>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
             {employee.capabilities.map((cap, i) => (
               <div key={cap.title} style={{
                 background: '#fff', border: '3px solid #111', borderRadius: 14,
                 padding: '28px 24px', boxShadow: '6px 6px 0 #111',
                 transform: `rotate(${i % 2 === 0 ? -0.8 : 0.8}deg)`,
               }}>
                 <div style={{
                   width: 10, height: 10, borderRadius: '50%', background: employee.color,
                   border: '2px solid #111', marginBottom: 16,
                 }} />
                 <h3 style={{ fontFamily: FONT.head, fontSize: 20, margin: '0 0 10px' }}>{cap.title}</h3>
                 <p style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.6, color: '#333', margin: 0 }}>{cap.description}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

       {/* SKILLS TICKER */}
       <div style={{
         background: '#111', color: '#EFE7D6', padding: '18px 0',
         borderBottom: '3px solid #111', overflow: 'hidden',
       }}>
         <div style={{
           display: 'flex', gap: 48,
           animation: 'marquee 20s linear infinite',
           whiteSpace: 'nowrap',
         }}>
           {[...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills].map((s, i) => (
             <span key={i} style={{ fontFamily: FONT.head, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>
               ★ {s}
             </span>
           ))}
         </div>
       </div>

       {/* WHO HIRES THIS AGENT */}
       <section style={{ padding: '80px 32px', background: '#FFF9ED', borderBottom: '3px solid #111' }}>
         <div style={{ maxWidth: 1400, margin: '0 auto' }}>
           <div style={{ marginBottom: 48 }}>
             <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>
               [ USE CASES ]
             </div>
             <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(36px, 5vw, 64px)', margin: 0 }}>
               who hires {employee.name}?
             </h2>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
             {employee.useCases.map((uc, i) => (
               <div key={i} style={{
                 border: '3px solid #111', borderRadius: 12, padding: '24px 20px',
                 background: '#EFE7D6', boxShadow: '5px 5px 0 #111',
               }}>
                 <div style={{
                   display: 'inline-block', background: employee.color, border: '2px solid #111',
                   borderRadius: 999, padding: '4px 12px', fontFamily: FONT.mono,
                   fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12,
                 }}>
                   Use case {i + 1}
                 </div>
                 <p style={{ fontFamily: FONT.body, fontSize: 16, margin: 0, lineHeight: 1.5 }}>{uc}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

       {/* QUOTE CALLOUT */}
       <section style={{ padding: '80px 32px', background: '#111', borderBottom: '3px solid #111' }}>
         <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
           <div style={{
             fontFamily: FONT.display, fontSize: 'clamp(28px, 4vw, 52px)',
             color: '#EFE7D6', lineHeight: 1.2,
           }}>
             "{employee.quote}"
           </div>
           <div style={{
             marginTop: 24, fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
             textTransform: 'uppercase', color: employee.color,
           }}>
             — {employee.name}, {employee.role}
           </div>
         </div>
       </section>

       {/* CTA */}
       <section style={{ padding: '80px 32px' }}>
         <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
           <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 16 }}>
             [ READY? ]
           </div>
           <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: '0 0 24px', lineHeight: 0.9 }}>
             hire {employee.name}<br />
             <span style={{ background: employee.color, padding: '0 16px', display: 'inline-block', border: '3px solid #111', borderRadius: 8, boxShadow:
 '4px 4px 0 #111' }}>
               today.
             </span>
           </h2>
           <p style={{ fontFamily: FONT.body, fontSize: 18, color: '#555', marginBottom: 40 }}>
             Start with {employee.name} on the Solo plan at $24/mo, or get all six on the Crew plan at $99/mo.
           </p>
           <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
             <Button variant="dark" href={`${mainAppUrl}/signup`}>Start free →</Button>
             <Button variant="ghost" href="/#pricing">View pricing</Button>
           </div>
         </div>
       </section>

       {/* FOOTER — import from sections.tsx */}
     </div>
   );
 }

 Note: The footer is already exported from sections.tsx as a named export. Import it at the top of the page file, not the component file (to keep this
 component self-contained). See Task 5.

 - Step 2: Verify no TypeScript errors

 Run: cd apps/landing && npx tsc --noEmit
 Expected: No errors.

 - Step 3: Commit

 git add apps/landing/src/components/veqiro/agent-page.tsx apps/landing/src/components/veqiro/page-nav.tsx
 git commit -m "feat(landing): add AgentPage layout and PageNav components"

 ---
 Task 5: Create dynamic agent route /agents/[slug]

 Files: Create src/app/agents/[slug]/page.tsx

 - Step 1: Read Next.js App Router docs for generateStaticParams

 Read: apps/landing/node_modules/next/dist/docs/ — look for the app-router dynamic routes guide before writing this file. The CLAUDE.md warns the API may
 differ from training data.

 - Step 2: Create the page file

 import type { Metadata } from 'next';
 import { notFound } from 'next/navigation';
 import { EMPLOYEES } from '@/components/veqiro/data';
 import { AgentPage } from '@/components/veqiro/agent-page';
 import { Footer } from '@/components/veqiro/sections';

 interface Props {
   params: Promise<{ slug: string }>;
 }

 export async function generateStaticParams() {
   return EMPLOYEES.map(e => ({ slug: e.key }));
 }

 export async function generateMetadata({ params }: Props): Promise<Metadata> {
   const { slug } = await params;
   const employee = EMPLOYEES.find(e => e.key === slug);
   if (!employee) return {};
   return {
     title: `${employee.name} — ${employee.role} | Veqiro`,
     description: employee.description,
     openGraph: {
       title: `Meet ${employee.name}, your AI ${employee.role}`,
       description: employee.description,
     },
   };
 }

 export default async function AgentSlugPage({ params }: Props) {
   const { slug } = await params;
   const employee = EMPLOYEES.find(e => e.key === slug);
   if (!employee) notFound();

   return (
     <>
       <AgentPage employee={employee} />
       <Footer />
     </>
   );
 }

 - Step 3: Verify route works

 Run: cd apps/landing && npm run dev
 Navigate to: http://localhost:3000/agents/maya
 Expected: Maya's agent page renders with the demo chat on the right, no console errors.

 Check all 6: /agents/vega, /agents/scout, /agents/sage, /agents/lex, /agents/rex

 - Step 4: Commit

 git add apps/landing/src/app/agents/
 git commit -m "feat(landing): add dynamic /agents/[slug] route for all 6 agents"

 ---
 Task 6: Wire crew cards to agent pages

 Files: Modify src/components/veqiro/crew.tsx

 - Step 1: Read the file first

 Read the full file to understand the crew card structure before editing.

 - Step 2: Add Link to each crew card

 Find the element that renders each crew card (the outermost card div). Wrap it with <Link href={/agents/${emp.key}} style={{ textDecoration: 'none',
 color: 'inherit' }}>. Import Link from 'next/link' at the top.

 The crew card should show a "→ Learn more" label on hover if possible, or at minimum be a clickable link.

 - Step 3: Verify navigation works

 Run: npm run dev
 Click a crew card → should navigate to /agents/[key]
 Expected: No visual regressions on home page.

 - Step 4: Commit

 git add apps/landing/src/components/veqiro/crew.tsx
 git commit -m "feat(landing): crew cards now link to individual agent pages"

 ---
 Task 7: Create About page

 Files: Create src/app/about/page.tsx

 - Step 1: Create the page

 import type { Metadata } from 'next';
 import { Footer } from '@/components/veqiro/sections';
 import { PageNav } from '@/components/veqiro/page-nav';
 import { FONT, Button } from '@/components/veqiro/shared';
 import { mainAppUrl } from '@/lib/site-config';

 export const metadata: Metadata = {
   title: 'About Veqiro — Six AI Employees, One Bill',
   description: 'We built Veqiro because lean teams deserve the same leverage as big ones. Six AI employees that do real work, together.',
 };

 export default function AboutPage() {
   return (
     <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
       <PageNav />

       {/* HERO */}
       <section style={{ padding: '80px 32px', borderTop: '3px solid #111', borderBottom: '3px solid #111', background: '#111' }}>
         <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
           <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 16 }}>
             [ ABOUT VEQIRO ]
           </div>
           <h1 style={{ fontFamily: FONT.display, fontSize: 'clamp(56px, 8vw, 120px)', margin: 0, lineHeight: 0.9, color: '#EFE7D6' }}>
             made by humans.<br />
             <span style={{ color: '#F5C518' }}>(mostly.)</span>
           </h1>
         </div>
       </section>

       {/* MISSION */}
       <section style={{ padding: '80px 32px', borderBottom: '3px solid #111' }}>
         <div style={{ maxWidth: 820, margin: '0 auto' }}>
           <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 24 }}>
             [ THE WHY ]
           </div>
           <p style={{ fontFamily: FONT.display, fontSize: 'clamp(28px, 3.5vw, 48px)', lineHeight: 1.2, margin: '0 0 32px' }}>
             Lean teams deserve the same leverage as teams ten times their size.
           </p>
           <p style={{ fontFamily: FONT.body, fontSize: 18, lineHeight: 1.7, color: '#333', margin: '0 0 24px' }}>
             We built Veqiro because we kept watching great companies stall — not because the ideas were bad, but because a 3-person team can only do so
 much in a day. The grunt work piles up. The emails go unanswered. The blog gets abandoned. The competitor analysis never gets done.
           </p>
           <p style={{ fontFamily: FONT.body, fontSize: 18, lineHeight: 1.7, color: '#333', margin: 0 }}>
             So we built six. Not a chat interface with a generic prompt. Six actual AI employees — each with a name, a specialty, a personality, and a
 bias toward shipping. They share memory. They talk to each other. They work while you sleep.
           </p>
         </div>
       </section>

       {/* VALUES */}
       <section style={{ padding: '80px 32px', background: '#FFF9ED', borderBottom: '3px solid #111' }}>
         <div style={{ maxWidth: 1200, margin: '0 auto' }}>
           <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 48 }}>
             [ HOW WE THINK ]
           </div>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
             {[
               { title: 'Personality over prompts', body: "AI that has a name, a voice, and a point of view is AI you actually want to work with. Generic
 is boring. We make crew members.", color: '#6FCDE8' },
               { title: 'Real work, not summaries', body: "Vega doesn't just tell you about your emails — she handles them. Sage doesn't suggest keywords —
  she writes the post. Output over observation.", color: '#F06464' },
               { title: 'Lean is a superpower', body: "A 2-person team that operates like a 10-person team doesn't need to hire their way out. They need
 better tools. We're those tools.", color: '#F5C518' },
               { title: 'Trust but verify', body: "Every agent tells you what it's doing and why. Nothing gets sent without your say-so. We make them fast
 — you make them final.", color: '#1DBC87' },
             ].map((v, i) => (
               <div key={v.title} style={{
                 border: '3px solid #111', borderRadius: 14, padding: '28px 24px',
                 background: '#EFE7D6', boxShadow: '6px 6px 0 #111',
                 transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
               }}>
                 <div style={{ width: 32, height: 5, background: v.color, border: '2px solid #111', borderRadius: 4, marginBottom: 16 }} />
                 <h3 style={{ fontFamily: FONT.head, fontSize: 20, margin: '0 0 12px' }}>{v.title}</h3>
                 <p style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.6, color: '#444', margin: 0 }}>{v.body}</p>
               </div>
             ))}
           </div>
         </div>
       </section>

       {/* ORIGIN / LORE */}
       <section style={{ padding: '80px 32px', borderBottom: '3px solid #111', background: '#111' }}>
         <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
           <p style={{ fontFamily: FONT.display, fontSize: 'clamp(24px, 3vw, 40px)', color: '#EFE7D6', lineHeight: 1.3, margin: 0 }}>
             "Built in a small room, loud — Bengaluru, IN. Started because the founders were tired of copy-pasting into ChatGPT at midnight."
           </p>
           <div style={{ marginTop: 24, fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#666' }}>
             — the origin story, abridged
           </div>
         </div>
       </section>

       {/* CTA */}
       <section style={{ padding: '80px 32px' }}>
         <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
           <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 80px)', margin: '0 0 24px', lineHeight: 0.9 }}>
             meet the<br /><span style={{ background: '#F5C518', padding: '0 16px', display: 'inline-block', border: '3px solid #111', borderRadius: 8,
 boxShadow: '4px 4px 0 #111' }}>crew.</span>
           </h2>
           <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
             <Button variant="dark" href={`${mainAppUrl}/signup`}>Start hiring →</Button>
             <Button variant="ghost" href="/">See the landing</Button>
           </div>
         </div>
       </section>

       <Footer />
     </div>
   );
 }

 - Step 2: Verify page renders

 Navigate to: http://localhost:3000/about
 Expected: Page renders with consistent styling, no console errors.

 - Step 3: Commit

 git add apps/landing/src/app/about/
 git commit -m "feat(landing): add About page"

 ---
 Task 8: Create Privacy Policy page

 Files: Create src/app/privacy/page.tsx

 - Step 1: Create the page

 Styled like the brand (beige, same nav/footer, monospace labels) but content is standard SaaS privacy policy covering: data collection, usage, storage,
 cookies, third-party services, GDPR/CCPA rights, contact info.

 import type { Metadata } from 'next';
 import { PageNav } from '@/components/veqiro/page-nav';
 import { Footer } from '@/components/veqiro/sections';
 import { FONT } from '@/components/veqiro/shared';
 import { contact } from '@/lib/site-config';

 export const metadata: Metadata = {
   title: 'Privacy Policy | Veqiro',
   description: 'How Veqiro collects, uses, and protects your data.',
 };

 const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
   <div style={{ marginBottom: 48 }}>
     <h2 style={{ fontFamily: FONT.head, fontSize: 22, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '3px solid #111',
 paddingBottom: 8 }}>
       {title}
     </h2>
     {children}
   </div>
 );

 const P = ({ children }: { children: React.ReactNode }) => (
   <p style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 1.8, color: '#333', margin: '0 0 16px' }}>{children}</p>
 );

 export default function PrivacyPage() {
   const updated = 'April 23, 2026';

   return (
     <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
       <PageNav />

       <section style={{ padding: '60px 32px 40px', borderTop: '3px solid #111', borderBottom: '3px solid #111', background: '#111' }}>
         <div style={{ maxWidth: 800, margin: '0 auto' }}>
           <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 12 }}>
             [ LEGAL ]
           </div>
           <h1 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, color: '#EFE7D6', lineHeight: 0.9 }}>
             Privacy Policy
           </h1>
           <p style={{ fontFamily: FONT.mono, fontSize: 13, color: '#666', marginTop: 20 }}>
             Last updated: {updated}
           </p>
         </div>
       </section>

       <section style={{ padding: '80px 32px' }}>
         <div style={{ maxWidth: 800, margin: '0 auto' }}>
           <Section title="1. Overview">
             <P>Veqiro Labs ("we", "us", "our") operates the Veqiro platform — a suite of AI-powered assistants. This Privacy Policy explains how we
 collect, use, disclose, and safeguard your information when you use our services.</P>
             <P>By using Veqiro, you agree to the terms of this policy. If you disagree, please do not use the platform.</P>
           </Section>

           <Section title="2. Information We Collect">
             <P><strong>Account data:</strong> Name, email address, company name, billing information, and any other details you provide during signup or
 onboarding.</P>
             <P><strong>Usage data:</strong> Pages visited, features used, agent interactions, session duration, and device/browser metadata.</P>
             <P><strong>Content data:</strong> Text, documents, and other content you share with our AI agents to perform tasks (emails, contracts, briefs,
  etc.).</P>
             <P><strong>Integration data:</strong> If you connect third-party services (Google Workspace, LinkedIn, Twitter, etc.), we store only the OAuth
  tokens and the data required to complete the requested tasks.</P>
           </Section>

           <Section title="3. How We Use Your Data">
             <P>We use collected data to: provide and improve the Veqiro platform; personalize AI agent responses to your brand and preferences; process
 payments and manage your subscription; send service-related communications (never marketing without consent); comply with legal obligations.</P>
             <P><strong>We do not train our AI models on your data.</strong> Your content is used only to perform the tasks you request.</P>
           </Section>

           <Section title="4. Data Sharing">
             <P>We do not sell your personal data. We share data only with: (a) sub-processors required to operate the service (cloud infrastructure,
 payment processors, LLM API providers); (b) law enforcement when legally required; (c) acquirers in a merger or acquisition, with prior notice to you.</P>
             <P>All sub-processors are bound by data processing agreements with equivalent privacy protections.</P>
           </Section>

           <Section title="5. Cookies">
             <P>We use strictly necessary cookies (session management, authentication) and optional analytics cookies (aggregate usage stats). We do not
 use advertising cookies. You can disable optional cookies in your browser settings.</P>
           </Section>

           <Section title="6. Data Retention">
             <P>We retain your data for as long as your account is active or as needed to provide services. After account deletion, personal data is purged
  within 30 days. Content data is purged immediately on request.</P>
           </Section>

           <Section title="7. Your Rights (GDPR / CCPA)">
             <P>Depending on your location, you may have the right to: access, correct, or delete your personal data; export your data in a portable
 format; opt out of certain data processing; withdraw consent at any time.</P>
             <P>To exercise these rights, email us at {contact.email}. We respond within 30 days.</P>
           </Section>

           <Section title="8. Security">
             <P>We implement SOC 2 Type II controls including encryption at rest (AES-256) and in transit (TLS 1.3), access controls, audit logging, and
 regular penetration testing. No method is 100% secure — we will notify you promptly of any breach affecting your data.</P>
           </Section>

           <Section title="9. Children">
             <P>Veqiro is not directed at children under 16. We do not knowingly collect data from minors. If you believe a minor has provided us data,
 contact us immediately.</P>
           </Section>

           <Section title="10. Changes to This Policy">
             <P>We may update this policy periodically. We will notify you by email or in-app notice at least 30 days before material changes take effect.
 Continued use constitutes acceptance.</P>
           </Section>

           <Section title="11. Contact">
             <P>Questions about this policy? Email us: <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700
 }}>{contact.email}</a></P>
             <P>Veqiro Labs · {contact.address}</P>
           </Section>
         </div>
       </section>

       <Footer />
     </div>
   );
 }

 - Step 2: Verify page renders

 Navigate to: http://localhost:3000/privacy
 Expected: Readable, branded legal page with nav/footer.

 - Step 3: Commit

 git add apps/landing/src/app/privacy/
 git commit -m "feat(landing): add Privacy Policy page"

 ---
 Task 9: Create Terms of Service page

 Files: Create src/app/terms/page.tsx

 - Step 1: Create the page

 Follow the identical layout pattern as the Privacy page (same PageNav, Footer, Section, P patterns). Content covers: acceptance, service description, user
  obligations, payment/billing, intellectual property, liability limitations, termination, governing law.

 import type { Metadata } from 'next';
 import { PageNav } from '@/components/veqiro/page-nav';
 import { Footer } from '@/components/veqiro/sections';
 import { FONT } from '@/components/veqiro/shared';
 import { contact } from '@/lib/site-config';

 export const metadata: Metadata = {
   title: 'Terms of Service | Veqiro',
   description: 'The terms governing your use of the Veqiro platform.',
 };

 // Re-use same Section/P component pattern as privacy page
 const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
   <div style={{ marginBottom: 48 }}>
     <h2 style={{ fontFamily: FONT.head, fontSize: 22, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '3px solid #111',
 paddingBottom: 8 }}>
       {title}
     </h2>
     {children}
   </div>
 );

 const P = ({ children }: { children: React.ReactNode }) => (
   <p style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 1.8, color: '#333', margin: '0 0 16px' }}>{children}</p>
 );

 export default function TermsPage() {
   const updated = 'April 23, 2026';

   return (
     <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
       <PageNav />

       <section style={{ padding: '60px 32px 40px', borderTop: '3px solid #111', borderBottom: '3px solid #111', background: '#111' }}>
         <div style={{ maxWidth: 800, margin: '0 auto' }}>
           <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 12 }}>
             [ LEGAL ]
           </div>
           <h1 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, color: '#EFE7D6', lineHeight: 0.9 }}>
             Terms of Service
           </h1>
           <p style={{ fontFamily: FONT.mono, fontSize: 13, color: '#666', marginTop: 20 }}>
             Last updated: {updated}
           </p>
         </div>
       </section>

       <section style={{ padding: '80px 32px' }}>
         <div style={{ maxWidth: 800, margin: '0 auto' }}>
           <Section title="1. Acceptance">
             <P>By accessing or using Veqiro, you agree to be bound by these Terms. If you don't agree, do not use the service. If you're using Veqiro on
 behalf of an organization, you represent you have authority to bind that organization.</P>
           </Section>

           <Section title="2. The Service">
             <P>Veqiro provides a suite of AI-powered assistants ("Agents") that perform specialized business tasks including content creation, financial
 analysis, research, SEO, legal review, and executive assistance.</P>
             <P>We reserve the right to modify, suspend, or discontinue any part of the service with reasonable notice.</P>
           </Section>

           <Section title="3. Account & Eligibility">
             <P>You must be at least 18 years old to use Veqiro. You are responsible for maintaining the security of your account credentials and for all
 activities under your account.</P>
             <P>You may not share accounts or use automated means to create accounts.</P>
           </Section>

           <Section title="4. Acceptable Use">
             <P>You may not use Veqiro to: generate spam, disinformation, or content intended to deceive; violate any applicable law; infringe third-party
 intellectual property; harass or harm others; attempt to reverse-engineer or extract our AI models.</P>
             <P>We may suspend accounts that violate these terms without prior notice.</P>
           </Section>

           <Section title="5. Payment & Billing">
             <P>Subscriptions are billed monthly or annually in advance. All fees are non-refundable except as required by law or as explicitly stated in
 our refund policy. We may change pricing with 30 days' notice.</P>
             <P>If payment fails, access may be suspended until the outstanding balance is settled.</P>
           </Section>

           <Section title="6. Intellectual Property">
             <P><strong>Your content:</strong> You own all content you create or upload. By using the service, you grant us a limited license to process
 your content solely to provide the service.</P>
             <P><strong>Our platform:</strong> All platform code, agent personalities, interfaces, and brand elements are owned by Veqiro Labs. You may not
  copy, redistribute, or create derivative works.</P>
             <P><strong>Output ownership:</strong> Content generated by AI Agents in response to your prompts is owned by you, subject to applicable law
 and third-party model terms.</P>
           </Section>

           <Section title="7. Disclaimer & Limitation of Liability">
             <P>The service is provided "as is." We disclaim all warranties, express or implied. AI Agent outputs are not professional advice (legal,
 financial, medical, or otherwise). Always review Agent outputs before acting on them.</P>
             <P>To the maximum extent permitted by law, Veqiro Labs's liability is limited to the fees paid by you in the 12 months preceding any
 claim.</P>
           </Section>

           <Section title="8. Termination">
             <P>Either party may terminate at any time. Upon termination, your access ceases and your data is deleted per our Privacy Policy. Provisions
 that should survive termination (IP, limitations of liability) will do so.</P>
           </Section>

           <Section title="9. Governing Law">
             <P>These Terms are governed by the laws of India, without regard to conflict of law principles. Disputes shall be resolved in the courts of
 Bengaluru, Karnataka, India.</P>
           </Section>

           <Section title="10. Contact">
             <P>For questions: <a href={`mailto:${contact.email}`} style={{ color: '#111', fontWeight: 700 }}>{contact.email}</a></P>
             <P>Veqiro Labs · {contact.address}</P>
           </Section>
         </div>
       </section>

       <Footer />
     </div>
   );
 }

 - Step 2: Verify page renders

 Navigate to: http://localhost:3000/terms
 Expected: Readable, branded legal page with nav/footer.

 - Step 3: Commit

 git add apps/landing/src/app/terms/
 git commit -m "feat(landing): add Terms of Service page"

 ---
 Task 10: Update nav links, footer links, and sitemap

 Files:
 - Modify src/lib/site-config.ts
 - Modify src/app/sitemap.ts
 - Step 1: Update footer crew links in site-config.ts

 In footerColumns, change the Crew column links from href: '#crew' to href: '/agents/[key]':

 {
   h: 'The Crew',
   links: [
     { label: 'Vega', href: '/agents/vega' },
     { label: 'Scout', href: '/agents/scout' },
     { label: 'Maya', href: '/agents/maya' },
     { label: 'Sage', href: '/agents/sage' },
     { label: 'Lex', href: '/agents/lex' },
     { label: 'Rex', href: '/agents/rex' },
   ],
 },

 Change Company column links:
 {
   h: 'Company',
   links: [
     { label: 'About', href: '/about' },
     { label: 'Careers', href: demoCtaHref },
     { label: 'Manifesto', href: demoCtaHref },
     { label: 'Press kit', href: demoCtaHref },
   ],
 },

 Change footer bottom privacy/terms links:
 export const footerBottom = {
   copyright: '© 2026 veqiro labs · made by humans (mostly)',
   links: [
     { label: 'terms', href: '/terms' },
     { label: 'privacy', href: '/privacy' },
     { label: 'cookies (chocolate chip)', href: '/privacy#cookies' },
   ],
 };

 - Step 2: Update sitemap.ts

 import type { MetadataRoute } from "next";

 const SITE_URL = process.env.NEXT_PUBLIC_LANDING_URL || "https://veqiro.com";

 export default function sitemap(): MetadataRoute.Sitemap {
   const lastModified = new Date();
   const agentSlugs = ['vega', 'scout', 'maya', 'sage', 'lex', 'rex'];

   return [
     { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
     { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
     { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.4 },
     { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "monthly", priority: 0.4 },
     ...agentSlugs.map(slug => ({
       url: `${SITE_URL}/agents/${slug}`,
       lastModified,
       changeFrequency: "monthly" as const,
       priority: 0.9,
     })),
   ];
 }

 - Step 3: Check the footer renders new links correctly

 Run: npm run dev
 Open home page → scroll to footer → verify crew links go to /agents/[key], privacy/terms links work.

 - Step 4: Commit

 git add apps/landing/src/lib/site-config.ts apps/landing/src/app/sitemap.ts
 git commit -m "feat(landing): update footer links to real routes, expand sitemap"

 ---