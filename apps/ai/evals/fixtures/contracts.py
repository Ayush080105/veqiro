"""Contract text the Lex cases use. One clearly one-sided, one clearly fair, so a review that
calls everything "high risk" fails as surely as one that calls everything fine."""

ONE_SIDED_SAAS = """\
MASTER SERVICES AGREEMENT
between CloudStack Solutions Pvt Ltd ("Supplier") and LedgerLoop Technologies Pvt Ltd ("Customer")
Effective Date: 1 October 2026

1. Services. Supplier will provide cloud hosting services described in Schedule A.
2. Term. This Agreement runs for 36 months from the Effective Date.
3. Fees. Customer shall pay ₹4,50,000 per month, invoiced monthly in advance. Supplier may
   increase fees at any time by notifying Customer by email.
4. Termination. Supplier may terminate this Agreement at any time without notice. Customer may
   not terminate this Agreement before the end of the Term for any reason. Customer shall pay all
   fees for the full 36-month term regardless of termination.
5. Liability. Supplier's total liability under this Agreement is capped at fees paid by Customer
   in the 30 days preceding the claim. Supplier is not liable for any data loss.
6. Data. Supplier may use Customer data for any purpose, including training its products, and
   has no obligation to return or delete Customer data after termination.
7. Indemnity. Customer shall indemnify Supplier against all claims arising from use of the
   Services, including claims caused by Supplier's negligence.
8. Governing Law. This Agreement is governed by the laws of Singapore; disputes go exclusively to
   the courts of Singapore.
"""

FAIR_NDA = """\
MUTUAL NON-DISCLOSURE AGREEMENT
between Kulhad Co. Private Limited and Saffron Packaging LLP (each a "Party")
Effective Date: 15 September 2026

1. Purpose. The Parties will share information to evaluate a packaging supply arrangement.
2. Confidential Information. Each Party will keep the other's confidential information secret,
   use it only for the Purpose, and share it only with employees who need to know it and are
   bound by similar duties.
3. Exclusions. Obligations do not apply to information that is public, already known to the
   receiving Party, independently developed, or required to be disclosed by law (with prompt
   notice to the disclosing Party where lawful).
4. Term. Either Party may terminate this Agreement with 30 days' written notice. Confidentiality
   obligations survive for 2 years after termination.
5. Return of Information. On request, each Party will return or destroy the other's
   confidential information.
6. Remedies. Each Party may seek injunctive relief for a breach, in addition to other remedies.
7. Governing Law. This Agreement is governed by the laws of India; courts at Jaipur have
   jurisdiction.
"""

def clause_chunks(text: str) -> list[dict]:
    """One chunk per numbered clause (continuation lines joined) — what Lex's RAG hands back
    for an uploaded document."""
    chunks: list[str] = []
    for line in text.splitlines():
        head = line.strip().split(".", 1)[0]
        if head.isdigit():
            chunks.append(line.strip())
        elif chunks and line.startswith("   "):
            chunks[-1] += " " + line.strip()
    return [{"content": c, "score": 0.8, "metadata": {"section": c.split(".", 1)[0]}} for c in chunks]


FAIR_NDA_CHUNKS = clause_chunks(FAIR_NDA)
