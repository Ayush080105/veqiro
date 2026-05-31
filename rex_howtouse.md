 ---
  What Is Rex?

  Rex is your AI-powered CFO assistant. It does not just chat — it runs real financial algorithms (trend detection, statistical forecasting, scenario
  modeling) on your data and explains the results in plain English. Think of it as replacing a spreadsheet-and-finance-expert combo.

  ---
  The Data Tab — Understanding Datasets First

  Why You Must Upload Data

  Rex cannot analyze what it does not know. You need to upload your business numbers (revenue, expenses, customers, etc.) as CSV or Excel files. These
  become datasets — named time-series records stored in the database.

  The Upload Flow (Step by Step)

  1. Click the Data tab at the top of the Rex page
  2. Drop a CSV/Excel file onto the drop zone (or click Browse). Max 10 MB. Formats: .csv, .xlsx, .xls
  3. File uploads to cloud storage, then the backend parses it
  4. A review screen appears — you confirm/edit each detected dataset
  5. Click Save — datasets are stored and all Rex features can use them immediately

  WHY Does One CSV Create Multiple Datasets? (Most Important Concept)

  Your CSV likely has multiple numeric columns:

  Month,     MRR,    Burn,   Cash,   New_Customers
  2024-01,   45000,  30000,  200000, 85
  2024-02,   48000,  31000,  215000, 90

  Rex treats each numeric column as a separate metric. This one CSV becomes 4 datasets:
  - mrr — 12 data points over time
  - burn — 12 data points over time
  - cash — 12 data points over time
  - new_customers — 12 data points over time

  Why split them? Because different Rex features use different metrics. Forecast needs only MRR. Runway needs only Cash + Burn. Unit Economics needs
  Marketing Spend + New Customers. If everything were one blob, Rex could not selectively pull "just MRR history" for a forecast.

  Column names auto-detected: Rex recognizes "MRR/Monthly Recurring Revenue" → mrr, "Burn/Net Burn" → burn, "Cash on Hand" → cash, "New Customers" →
  new_customers, and 17 more patterns. Unrecognized columns get a generated key you can rename on the review screen.

  Long-format CSVs also work:
  Date,     MetricName, Value
  2024-01,  MRR,        45000
  2024-01,  Burn,       30000
  Rex pivots this to wide format and still produces separate datasets.

  What Is "Period"?

  Tells Rex how often your data is measured:
  - Daily — one point per day (e.g., daily signups)
  - Weekly — one point per week
  - Monthly — one point per month ← most common for finance
  - Quarterly — one point per quarter

  Period matters for forecasts (what unit to project in), health thresholds, and the Weekly Digest comparison. Always set this correctly — Rex auto-guesses
  but may be wrong.

  What Is "Purpose" (Actual vs Budget)?

  - Actual = real data — what actually happened
  - Budget = your plan/target — what you said would happen at year start

  This exists solely for Variance Analysis. To compare actual vs. budget, you must upload TWO datasets for the same metric and tag one as Budget. More on
  this in Feature 9.

  What Happens When You Upload More Datasets Later?

  Each upload adds to your library. Previous datasets stay. After every upload/delete, Rex automatically refreshes the KPI strip, Magic Numbers tiles, and
  all dataset picker dropdowns in every form.

  ---
  KPI Strip & Magic Numbers (Auto-Updates After Upload)

  KPI Strip (4 tiles at top of Chat tab)

  Live headline numbers: MRR, Cash, Runway (months of cash left), Status pill (green/amber/red). Click any tile → drill-down with 24-point chart.

  Magic Numbers (5 tiles below)

  ┌─────────────┬───────────────────────────────────────────────────────────────┬────────┬──────────┬────────┐
  │    Tile     │                         What It Means                         │ Green  │  Amber   │  Red   │
  ├─────────────┼───────────────────────────────────────────────────────────────┼────────┼──────────┼────────┤
  │ Runway      │ Months until cash hits zero                                   │ >12 mo │ 6–12 mo  │ <6 mo  │
  ├─────────────┼───────────────────────────────────────────────────────────────┼────────┼──────────┼────────┤
  │ NRR         │ Net Revenue Retention — are existing customers spending more? │ ≥100%  │ 90–99%   │ <90%   │
  ├─────────────┼───────────────────────────────────────────────────────────────┼────────┼──────────┼────────┤
  │ CAC Payback │ Months to recoup what you spent to acquire one customer       │ <12 mo │ 12–18 mo │ >18 mo │
  ├─────────────┼───────────────────────────────────────────────────────────────┼────────┼──────────┼────────┤
  │ Churn       │ Monthly customer churn rate                                   │ <2%    │ 2–4%     │ >4%    │
  ├─────────────┼───────────────────────────────────────────────────────────────┼────────┼──────────┼────────┤
  │ MoM Growth  │ Month-over-month MRR growth                                   │ ≥5%    │ 0–5%     │ <0%    │
  └─────────────┴───────────────────────────────────────────────────────────────┴────────┴──────────┴────────┘

  These auto-compute from your datasets. Tiles hide if the required data is missing.

  ---
  The Plus Icon — All 11 Features Explained

  Click + in the bottom-right of the chat input. 11 options appear.

  ---
  1. Analyze Metrics

  What it does: Reads multiple metrics simultaneously — trends (up/down/stable), anomaly detection (unusual spikes/drops), and a health score
  (healthy/watch/critical) per metric. Your starting point after uploading data.

  The form:
  - "Add metric from saved dataset" dropdown — pick a saved dataset to auto-fill a row instantly
  - Metric rows — each row = metric name (text) + a date/value table + remove button
  - "Add metric" button — adds a blank row for manual entry (type name + enter data points manually)
  - Period selector — daily / weekly / monthly / quarterly

  Example input:
  Metric: mrr
  Data:   2024-01 → 45000 | 2024-02 → 48000 | 2024-03 → 46000 | 2024-04 → 52000
  Period: monthly

  Output: Trend label + anomaly flags + health indicator + sparkline + plain-English paragraph per metric.

  ---
  2. Forecast a Metric

  What it does: Projects one metric forward using real statistical algorithms (Facebook Prophet, or linear regression as fallback). Gives a confidence range
  with optimistic/pessimistic bands. Answers: "Where will MRR be in 3 months if current trends continue?"

  The form:
  - Metric name — text, e.g. "mrr"
  - Historical data — dataset picker + editable table. Need ≥3 points; 6+ for accuracy
  - Horizon days — how far ahead to forecast. Default 90. Range 7–365.
    - If your last data point is Jan 2026 and you set 90 days → forecasts through April 2026

  Output: Forecast table (date | predicted | lower bound | upper bound), confidence %, methodology note, sparkline with shaded bands.

  ---
  3. Financial Analysis

  What it does: Full health report computing all standard startup KPIs: MRR, ARR, MoM growth %, churn rate, burn rate, net burn, runway — plus health
  verdict and recommendations. Replaces manual spreadsheet calculations.

  The form (3 sections):
  - Revenue data (required) — dataset picker for MRR/revenue
  - Expenses data (optional) — dataset picker for burn/expenses
  - Subscribers data (optional) — dataset picker for new customers

  Rex computes what it can with what you provide. Revenue alone → MRR/ARR/growth. Add expenses → burn + runway. Add subscribers → churn.

  Output: KPI grid + health indicator (green/amber/red with reasoning) + narrative paragraph + recommendations list.

  ---
  4. Runway Scenarios

  What it does: Answers "How many months until we run out of cash?" with 3 scenarios (base, optimistic, pessimistic). No CSV needed — all manual number
  inputs.

  The form (4 numbers):
  - Cash on hand ($) — current bank balance
  - Monthly burn ($) — total going out per month
  - Monthly revenue ($) — money coming in (reduces net burn)
  - MoM revenue growth (%) — if revenue grows, runway extends over time

  Net burn = burn − revenue. Burn $45K, revenue $30K → net burn $15K/month.

  Output: Net burn, base runway, scenario comparison table, recommendation. If revenue > burn → shows "Profitable."

  ---
  5. Unit Economics

  What it does: Calculates the economics of acquiring and keeping one customer:
  - CAC = total marketing spend ÷ total new customers
  - LTV = monthly ARPU × customer lifetime months
  - LTV:CAC ratio — the sustainability metric. >3x = healthy, >10x = excellent
  - Payback period = months to recoup acquisition cost

  The form:
  - Marketing spend — dataset picker + table (monthly spend data)
  - New customers — dataset picker + table (monthly acquisition numbers)
  - Avg monthly revenue per customer ($) — single number (ARPU). Example: 100 customers × $12K/year → $120/month each
  - Avg customer lifetime (months) — default 24

  Output: CAC, LTV, LTV:CAC, payback — each with health color + benchmark context + recommendations.

  ---
  6. What-If Scenarios

  What it does: Models financial impact of business decisions side by side. "Hire 2 engineers vs. raise prices 20% — which gives better runway?" Replaces
  building a scenario model in Excel.

  The form:

  Base Metrics (current state):
  MRR ($), Burn ($), Cash ($), Growth rate (decimal: 0.05 = 5% monthly)

  Scenarios:
  Quick templates — click to add instantly:
  - "Hire 2 engineers" → +$25K burn/month
  - "Double marketing" → doubles marketing budget
  - "Price increase 20%" → +20% MRR
  - "Cut $10K burn" → -$10K burn

  Or create custom scenarios with: name + burn delta + MRR delta + optional growth override.

  Output: Side-by-side table: Scenario | Net Burn | Runway | 12-month MRR. After results load, the card shows live sliders (burn/MRR/growth) — drag to tweak
  in real time without resubmitting.

  ---
  7. Weekly CFO Digest

  What it does: Monday-morning report comparing this week vs. last week. Surfaces what improved, what deteriorated, alerts, and action items. Replaces a CFO
  status meeting.

  The form:

  This week's metrics (required): Key-value pairs. Metric name + current number.
  Common keys: mrr, burn, cash, churn_rate, growth_rate, new_customers
  Enter rates as decimals: churn_rate: 0.022 = 2.2%. Money in dollars: mrr: 48000.

  Last week's metrics (optional): Same structure. Enables week-over-week change calculation.

  Output: Headline sentence + WoW change table with arrows + alerts (bad movements) + green flags (improvements) + 3 action items for this week.

  ---
  8. Investor Update

  What it does: Writes a complete, professional investor update email. Founders send these monthly to their investors. Takes 2 minutes instead of 2 hours.

  The form:
  - Period — text, e.g. "April 2026"
  - Highlights — list of wins. "Add highlight" per item. Example: "MRR grew $45K → $48K (+6.7%)"
  - Asks — list of help needed. "Add ask" per item. Example: "Intros to B2B SaaS VCs"

  Output: Subject line + full email (Executive Summary, Key Metrics table, Highlights, Challenges, Asks) + Copy button.

  ---
  9. Variance Analysis

  What it does: Compares actual results vs. your budget/plan month by month. Shows exactly where and how much you're over or under target.

  PREREQUISITE — you must have uploaded:
  1. Budget CSV → toggled to Budget on the review screen during upload
  2. Actual CSV → left as Actual (default)
  Both must use the same metric key (e.g., both mrr)

  The form:
  - Metric dropdown — only shows metrics that have BOTH actual AND budget datasets. If empty → you haven't uploaded both yet.
  - Period — daily / weekly / monthly / quarterly

  Output: Month-by-month table: Actual | Budget | Variance ($) | Variance (%) | Direction (over/under). Plus total variance summary and narrative paragraph.

  ---
  10. Board Deck

  What it does: Generates a complete investor-ready board update as styled HTML. Open in browser and it looks like a professional presentation. Replaces
  building a PowerPoint.

  The form:
  - Period — e.g. "Q1 2026"
  - Highlights — list of wins. Example: "MRR grew 18% QoQ to $48K"
  - Risks — list of concerns. Example: "Competitive pricing pressure from Telco X"
  - Key Ask — textarea. Main decision/approval needed. Example: "Approval for $200K marketing budget increase"

  Output: Full HTML deck (Company Overview, Financial Health KPI grid, Metrics Analysis, Risks & Mitigations, Key Ask) + Copy HTML button + Open in browser
  button.

  ---
  11. Executive Briefing

  What it does: Combines Rex's financial data with intelligence from other AI agents (Vega, Maya, Scout, Sage) into one unified briefing document. This is
  the cross-agent synthesis feature — Rex pulls everything into one place for leadership meetings.

  The form:
  - Date — date picker
  - Agent summaries — list of agent name + summary text pairs
    - Go to each other agent, ask "give me a status summary," paste their response here
    - Agent name examples: "Vega", "Maya", "Scout", "Sage"
    - Click "Add agent summary" to add entries

  Output: Financial Snapshot (from Rex datasets) + Market Context (from Vega) + Team insights (from Sage) + Action Items (synthesized across all) + Risks
  and opportunities.

  ---
  After a Feature Runs — Result Cards

  Every analysis produces a card in chat:

  ┌───────────────────┬──────────────────────────────┬───────────────────────────────────────────────────────────────────┐
  │      Action       │             How              │                               What                                │
  ├───────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Pin               │ Pin icon on card             │ Saves to "Today" panel at top of chat — keeps key metrics visible │
  ├───────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Follow-up buttons │ Inside card                  │ Context-aware next steps (after Forecast → "Analyze this metric") │
  ├───────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Share             │ Pin first, then share toggle │ Generates a public URL viewable without login                     │
  ├───────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Scenario sliders  │ Scenario result cards only   │ Drag burn/MRR/growth sliders — table recomputes in real time      │
  └───────────────────┴──────────────────────────────┴───────────────────────────────────────────────────────────────────┘

  ---
  Recommended First-Time Flow

  1. Data tab → Upload your main metrics CSV
  2. Review screen: set period = monthly, purpose = actual → Save
  3. (Optional) Upload budget CSV → set purpose = Budget → Save
  4. Chat tab: KPI strip should show your numbers
  5. Plus → Financial Analysis → pick datasets → run health report
  6. Plus → Forecast → pick MRR → 90 days → run
  7. Plus → Runway → enter cash + burn manually → run
  8. Plus → Analyze Metrics → add all datasets → run
  9. If budget uploaded: Plus → Variance → pick metric → run

  ---
  Common Mistakes

  ┌─────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────────────┐
  │             Mistake             │                Effect                │                  Fix                   │
  ├─────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────┤
  │ Wrong period set                │ Forecasts project in wrong intervals │ Edit dataset in Data tab               │
  ├─────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────┤
  │ Budget not tagged               │ Variance dropdown empty              │ Re-upload budget CSV, toggle to Budget │
  ├─────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────┤
  │ Only 1 data point               │ Forecast fails or is useless         │ Need ≥3 points, 6+ for accuracy        │
  ├─────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────┤
  │ churn_rate: 22 instead of 0.022 │ Reads 2200% churn                    │ Enter rates as decimals                │
  ├─────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────┤
  │ No date column in CSV           │ Parse fails entirely                 │ Add a date column (any format)         │
  ├─────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────┤
  │ File > 10 MB                    │ Upload blocked                       │ Split the file or reduce date range    │
  └─────────────────────────────────┴──────────────────────────────────────┴────────────────────────────────────────┘

  The full guide is also saved in the plan file for future reference. You are now ready to test every feature end-to-end.
