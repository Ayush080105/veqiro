---
title: "SaaS Metrics Every Founder Tracks: MRR, Burn, CAC, LTV Explained"
slug: saas-metrics-founders
date: "2026-05-26"
description: "The eight SaaS metrics that matter, how to calculate them correctly, what they mean, and how AI automates the tracking so you're never flying blind."
category: agents
agentKey: rex
keywords:
  - saas metrics for founders
  - ai for saas metrics
  - ai financial analyst
  - ai revenue forecasting
  - ai for startup finance
  - ai cfo
  - ai kpi dashboard
  - mrr tracking ai
readingTime: 9
faq:
  - q: "What are the most important SaaS metrics for an early-stage startup?"
    a: "MRR (Monthly Recurring Revenue), Net MRR Growth Rate, Burn Rate, Runway, CAC (Customer Acquisition Cost), LTV (Lifetime Value), LTV:CAC ratio, and Churn Rate. Master these eight before adding complexity. Most investors want to see exactly these in a seed-stage deck."
  - q: "What's a good LTV:CAC ratio for a SaaS startup?"
    a: "The benchmark is 3:1 — for every $1 spent acquiring a customer, you earn $3 in lifetime value. Under 1:1 means you're losing money on every customer. Above 5:1 sometimes signals underinvestment in growth. Most early-stage SaaS operates at 1.5–2:1 while scaling."
  - q: "How often should a founder review their SaaS metrics?"
    a: "MRR, burn, and cash position: weekly. CAC, LTV, and churn: monthly. Revenue forecasts and runway: before every board meeting. Anomaly detection (sudden churn spike, CAC increase) should be real-time — this is where an AI finance agent adds the most value."
  - q: "Can AI actually track SaaS metrics automatically?"
    a: "Yes, with integrations. Rex connects to Stripe (or Paddle/Chargebee), your bank feeds, and analytics platforms. It calculates key metrics daily, flags anomalies (MRR dropped 8% week-on-week), and generates a weekly financial brief. No spreadsheet maintenance required."
  - q: "What's the difference between MRR and ARR?"
    a: "MRR (Monthly Recurring Revenue) is your normalized monthly subscription revenue. ARR (Annual Recurring Revenue) is MRR × 12. ARR is useful for investor conversations and benchmarking. For operational decisions — burn rate, hiring, runway — use MRR. Don't confuse ARR with actual annual invoices, which may differ due to annual prepays."
---

Most founders know the feeling: your board meeting is in 48 hours and someone asks for your LTV:CAC ratio. You open four spreadsheets, do some calculations that don't quite reconcile, and present a number you're not fully confident in.

This is the state of SaaS metrics at most early-stage startups. Not because founders are bad at numbers — because nobody built a system to track them automatically.

Here are the eight metrics that actually matter, how to calculate them correctly, and how to set up [Rex](/agents/rex), Veqiro's AI finance agent, to track them without spreadsheets.

## Why Most Founders Get This Wrong

The problem isn't intelligence. It's infrastructure. SaaS metrics live across multiple systems: Stripe for revenue data, your bank for cash position, HubSpot or Attio for acquisition data, Mixpanel for churn signals. Nobody automatically connects these.

The result: founders either track metrics inconsistently, use approximate numbers, or spend hours every month doing financial reconciliation instead of running the company.

Rex connects to your revenue, banking, and analytics systems. The metrics below are what it calculates, monitors, and alerts on — automatically, every day.

## The Eight Metrics

### 1. Monthly Recurring Revenue (MRR)

**What it is:** The normalised monthly value of all active subscriptions.

**How to calculate it correctly:**

```
MRR = Sum of all active subscription values, normalised to monthly

Annual plan at $1,200/year → contributes $100/month to MRR
Monthly plan at $99/month → contributes $99/month to MRR
```

**Common mistake:** Including one-time fees, professional services, or annual plans at their full invoice value. MRR is *recurring* — only subscription components count.

**What to watch:** Net MRR Growth = (New MRR + Expansion MRR) − (Churned MRR + Contraction MRR). This number tells you more than gross MRR because it shows *why* revenue is moving.

**Red flags:** New MRR < Churned MRR (you're contracting). Expansion MRR = 0 for months (customers aren't growing with you — a product signal).

---

### 2. Annual Recurring Revenue (ARR)

**What it is:** MRR × 12. Used for investor conversations and market comparisons.

**When to use it:** Investor decks, benchmarking against comparable companies, annual planning. For operational decisions (hiring, burn, runway), use MRR.

**Common mistake:** Reporting ARR as "annualised bookings" when you have a mix of annual prepays and monthly subscribers. ARR should always be normalised MRR × 12.

---

### 3. Burn Rate and Runway

**What it is:** How fast you're spending cash (burn rate) and how many months until it runs out (runway).

**How to calculate:**

```
Net Burn = Total Cash Out − Total Cash In (per month)

Gross Burn = Total Cash Out (ignores revenue)

Runway = Current Cash Balance ÷ Net Burn Rate
```

Use **net burn** (not gross burn) for operational decisions — it reflects how your revenue is offsetting costs. Use **gross burn** when talking to investors about your spending discipline.

**Rex tracking:** Connects to your bank feed and Stripe. Calculates net and gross burn daily. Flags weeks where burn accelerates unexpectedly (a common early signal of a payroll or vendor billing issue).

**The runway conversation:** Most investors want to see 18+ months of runway at any close. Below 12 months, fundraising urgency increases significantly. Below 6 months, your negotiating leverage is essentially gone.

---

### 4. Customer Acquisition Cost (CAC)

**What it is:** The fully-loaded cost of acquiring one new customer.

**How to calculate:**

```
CAC = (Sales Costs + Marketing Costs) ÷ New Customers Acquired
         for the same time period
```

**Fully-loaded** means including salaries, tools, ad spend, agency fees, events, and any other cost directly attributable to acquisition — not just paid ad spend.

**Blended vs. channel CAC:** Your blended CAC (all channels combined) is useful for the LTV:CAC ratio. But you also want CAC by channel to know which channels are efficient. A startup with $80 blended CAC might have $30 CAC from SEO and $200 CAC from paid social — very different strategic implications.

**Common mistake:** Calculating CAC over a different time period than the customers acquired. If you ran a major ad campaign in January that converted customers in February, both the spend and the customers need to be in the same calculation window.

---

### 5. Lifetime Value (LTV)

**What it is:** The total revenue you can expect from a customer over the entire relationship.

**How to calculate:**

```
LTV = ARPU ÷ Churn Rate

Where:
ARPU (Average Revenue Per User) = MRR ÷ Active Customers
Churn Rate = monthly customer churn rate (decimal)

Example: ARPU = $99/mo, Monthly Churn = 2%
LTV = $99 ÷ 0.02 = $4,950
```

**The problem with this formula:** It assumes constant churn, which is rarely true. Early customers often have different retention than late cohorts. For better accuracy, use cohort-based LTV — track what each monthly cohort actually pays over 12–24 months.

**Gross margin LTV:** For the LTV:CAC comparison, use *gross margin LTV* (LTV × gross margin %) rather than raw revenue LTV. If you're comparing $4,950 LTV to $1,500 CAC but your gross margin is 60%, your real LTV is $2,970 — a 2:1 ratio instead of 3.3:1.

---

### 6. LTV:CAC Ratio

**What it is:** The single most-watched metric by SaaS investors.

**Benchmarks:**

| LTV:CAC | What it means |
|---------|---------------|
| < 1:1 | Losing money on every customer acquired |
| 1:1 – 2:1 | Marginal — need improvement |
| 3:1 | Healthy — the standard benchmark |
| > 5:1 | Either very efficient or under-investing in growth |

**Important caveat:** LTV:CAC is a lagging indicator. LTV is based on historical retention; CAC is based on recent acquisition costs. The ratio tells you how *past* customers compare to *recent* acquisition spend — it doesn't predict future profitability.

**Rex monitoring:** Calculates LTV:CAC monthly using cohort-adjusted LTV and trailing 3-month CAC. Flags significant changes in either direction.

---

### 7. Churn Rate

**What it is:** The rate at which customers cancel their subscriptions. The most important retention metric for SaaS.

**Two types:**

```
Customer Churn Rate = Customers Lost ÷ Customers at Start of Period

Revenue Churn Rate (MRR Churn) = MRR Lost ÷ MRR at Start of Period
```

Both matter, but they can diverge significantly. A startup that retains large customers but loses small ones has low revenue churn and high customer churn — a different story than the reverse.

**Net Revenue Retention (NRR):** The metric that shows whether existing customers are growing. NRR > 100% means your existing customers are expanding faster than they're churning — the holy grail.

```
NRR = (Starting MRR + Expansion − Contraction − Churn) ÷ Starting MRR
```

Best-in-class SaaS companies have NRR of 110–130%. This means you could stop acquiring new customers entirely and still grow.

**Churn benchmarks by segment:**

| Customer Segment | Acceptable Monthly Churn |
|-----------------|--------------------------|
| SMB ($0–$1k ACV) | 2–4% |
| Mid-market ($1k–$25k ACV) | 0.5–1.5% |
| Enterprise ($25k+ ACV) | < 0.5% |

---

### 8. Payback Period

**What it is:** How many months it takes to recover your CAC from a customer's gross profit contribution.

**How to calculate:**

```
CAC Payback Period = CAC ÷ (ARPU × Gross Margin %)

Example: CAC = $1,500, ARPU = $99/mo, Gross Margin = 70%
Payback = $1,500 ÷ ($99 × 0.70) = $1,500 ÷ $69.30 = 21.6 months
```

**Why it matters:** Payback period determines how capital-intensive your growth is. Short payback = each customer pays for the next customer quickly = less external funding needed to grow. Long payback = you need more capital to fund growth before revenue catches up.

**Benchmarks:** Under 12 months is excellent. 12–24 months is typical for well-run SaaS. Over 24 months requires significant capital efficiency elsewhere.

---

## How to Set Up Automatic Metrics Tracking With Rex

The manual version of all of the above takes 4–6 hours per month. Rex does it daily with zero maintenance.

**Setup (one-time, ~30 minutes):**

1. **Connect Stripe** (or Paddle/Chargebee) — Rex pulls all subscription data, calculates MRR components (new, expansion, contraction, churn), and tracks ARR
2. **Connect bank feed** — Links directly to your business bank account for real-time burn and cash position
3. **Connect acquisition data** — Either your CRM (HubSpot, Attio, Salesforce) or a simple monthly CSV of acquisition costs by channel
4. **Set alert thresholds** — Define what changes trigger a notification: "alert if MRR drops more than 5% week-on-week" or "alert if runway falls below 14 months"

**What Rex delivers:**

- **Daily:** Current MRR, cash balance, net burn, runway (updated each morning)
- **Weekly:** Net MRR movement breakdown (new/expansion/contraction/churn), CAC by channel
- **Monthly:** Full financial brief — MRR waterfall, LTV:CAC, payback period, NRR, churn cohort analysis
- **Ad-hoc:** Answer questions like "what's our LTV:CAC if we include only self-serve customers?" or "how has our CAC changed since we launched the PLG motion?"

**The result:** Your board package takes 45 minutes instead of a weekend. Your metrics are always current, always correct, and you're never caught off guard.

---

The metrics above aren't theoretical — they're the exact questions every seed and Series A investor will ask. Getting comfortable with them before your next raise isn't preparation; it's table stakes.

[See how Rex handles financial tracking →](/agents/rex)
