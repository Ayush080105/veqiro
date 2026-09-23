-- Sample memory for the local dev org, so the workspace Memory graph has
-- something to draw. LOCAL ONLY: it is pinned to the dev org id below and does
-- nothing anywhere else. Idempotent — re-running replaces its own rows.
--
--   psql -h localhost -U postgres -d veqiro_dev -f apps/server/prisma/seed-dev-memory.sql
--
-- The company is invented (a small invoicing SaaS). Names repeat across facts on
-- purpose — Razorpay, Stripe, Acme, LinkedIn — because a name shared by two facts
-- is what the graph turns into a connecting node.

DELETE FROM memory_item WHERE "organizationId" = 'dev-org-ws' AND "sourceKind" = 'dev-seed';

INSERT INTO memory_item (id, "organizationId", agent, kind, content, origin, "sourceKind", confirmed, "confirmedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'dev-org-ws', v.agent::"Agent", v.kind, v.content, v.origin::"MemoryOrigin", 'dev-seed',
       v.confirmed, CASE WHEN v.confirmed THEN now() END,
       now() - (v.age || ' days')::interval, now()
FROM (VALUES
  -- Company-wide: what every employee works from
  (NULL, 'preference', 'Plain English over jargon, in every document and reply', 'USER', true, 30),
  (NULL, 'preference', 'Keep customer-facing writing short and warm, never salesy', 'USER', true, 28),
  (NULL, 'fact', 'Ledgerly sells invoicing software to small agencies in India', 'USER', true, 40),
  (NULL, 'fact', 'Payments run through Razorpay in India and Stripe everywhere else', 'IMPORTED', true, 21),
  (NULL, 'constraint', 'Never quote a price that is not on the public pricing page', 'USER', true, 19),

  -- Lex
  ('LEX', 'fact', 'Standard contracts are governed by Indian law with Bengaluru courts', 'IMPORTED', true, 25),
  ('LEX', 'fact', 'The Acme master agreement auto-renews every January unless cancelled 60 days before', 'IMPORTED', true, 14),
  ('LEX', 'constraint', 'Liability caps above 12 months of fees need founder sign-off', 'USER', true, 12),
  ('LEX', 'fact', 'Acme asked to move payment terms from Net 30 to Net 60', 'AGENT', false, 3),
  ('LEX', 'fact', 'Razorpay merchant terms were reviewed in August with no open issues', 'AGENT', false, 6),
  ('LEX', 'decision', 'Decided to keep the DPA template as-is until GDPR customers appear', 'USER', true, 9),

  -- Maya
  ('MAYA', 'fact', 'LinkedIn is the main channel; founders post twice a week', 'USER', true, 22),
  ('MAYA', 'preference', 'No emojis in LinkedIn posts, one hashtag at most', 'USER', true, 18),
  ('MAYA', 'fact', 'Posts about invoicing automation for agencies get the most saves on LinkedIn', 'AGENT', false, 5),
  ('MAYA', 'fact', 'Instagram is used only for product screenshots and launch news', 'AGENT', false, 4),
  ('MAYA', 'decision', 'Launch announcement for the Razorpay integration goes out on a Tuesday', 'AGENT', false, 2),

  -- Rex
  ('REX', 'fact', 'Monthly recurring revenue is reported after Stripe and Razorpay fees', 'IMPORTED', true, 20),
  ('REX', 'constraint', 'Runway below nine months triggers a note to the board', 'USER', true, 16),
  ('REX', 'fact', 'Acme is the largest customer at roughly a fifth of revenue', 'AGENT', false, 7),
  ('REX', 'fact', 'Churn spikes each April when agencies close their financial year', 'AGENT', false, 3),

  -- Sage
  ('SAGE', 'fact', 'Target keywords centre on invoicing software for agencies', 'USER', true, 24),
  ('SAGE', 'fact', 'The blog ranks best for GST invoice format queries', 'IMPORTED', true, 11),
  ('SAGE', 'preference', 'Long-form posts should end with a link to the pricing page', 'USER', true, 15),
  ('SAGE', 'fact', 'Zoho and Vyapar are the main competitors for invoicing keywords', 'AGENT', false, 4),

  -- Scout
  ('SCOUT', 'fact', 'Zoho is watched for pricing changes each week', 'USER', true, 17),
  ('SCOUT', 'fact', 'Vyapar launched a free tier aimed at agencies last quarter', 'AGENT', false, 5),
  ('SCOUT', 'fact', 'Competitors lean on LinkedIn ads while Ledgerly relies on referrals', 'AGENT', false, 3),

  -- Vega
  ('VEGA', 'preference', 'Morning briefing at 8:30 IST, urgent items first', 'USER', true, 26),
  ('VEGA', 'fact', 'Emails from Acme and investors are always high priority', 'USER', true, 13),
  ('VEGA', 'fact', 'Newsletters from Stripe and Razorpay can be summarised in one line', 'AGENT', false, 2)
) AS v(agent, kind, content, origin, confirmed, age);
