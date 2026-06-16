ALTER TABLE "vega_label"
ADD COLUMN IF NOT EXISTS "rationale" TEXT NOT NULL DEFAULT '';

UPDATE "vega_label"
SET "rationale" = CASE "name"
  WHEN 'Investors' THEN 'Investor, fundraising, diligence, metrics, deck, term sheet, VC, angel, shareholder, or board-related communication.'
  WHEN 'Sales Leads' THEN 'Prospects, demos, pricing, trials, purchasing intent, inbound leads, customer evaluation, or sales follow-up.'
  WHEN 'Newsletters' THEN 'Subscriptions, digests, marketing newsletters, product updates, event roundups, or automated broadcasts with no direct action required.'
  WHEN 'Team' THEN 'Internal teammates, collaborators, hiring, operations, project coordination, status updates, or work planning.'
  WHEN 'Legal' THEN 'Contracts, compliance, terms, privacy, legal notices, signatures, policies, or regulatory matters.'
  WHEN 'Finance' THEN 'Invoices, receipts, payments, accounting, payroll, banking, expenses, taxes, or financial operations.'
  WHEN 'Other' THEN 'Use only when the email does not clearly match another configured label.'
  ELSE "rationale"
END
WHERE "rationale" = '';

UPDATE "vega_label"
SET "color" = CASE "name"
  WHEN 'Investors' THEN '#8A8AF0'
  WHEN 'Sales Leads' THEN '#1DBC87'
  WHEN 'Newsletters' THEN '#6FCDE8'
  WHEN 'Team' THEN '#F5C518'
  WHEN 'Legal' THEN '#B3B3F7'
  WHEN 'Finance' THEN '#149E60'
  WHEN 'Other' THEN '#999999'
  ELSE "color"
END
WHERE "color" = '#999999';
