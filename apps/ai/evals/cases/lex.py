"""Lex: contract reviews and document answers. The balanced pair (one bad contract, one fair one)
keeps a reviewer that flags everything from scoring well."""
from evals.case import Case
from evals.fixtures.contracts import FAIR_NDA, FAIR_NDA_CHUNKS, ONE_SIDED_SAAS
from evals.graders import (HONEST, USABLE, avoids, count, is_true, judge, mentions, nonempty, one_of, quotes_exist,
                           no_placeholders)
from evals.personas import KULHAD, LEDGERLOOP


def _ask(case_id, question, graders, story):
    return Case(id=case_id, agent="lex", endpoint="/ai/lex/query-document",
                payload={"user_id": "eval_user", "organization_id": KULHAD,
                         "source_id": "eval_nda", "query": question, "top_k": 5},
                graders=graders, story=story, rag_chunks=FAIR_NDA_CHUNKS, latency_s=30)


CASES = [
    Case(id="lex.review.one_sided_msa", agent="lex", endpoint="/ai/lex/analyze-contract",
         payload={"user_id": "eval_user", "organization_id": LEDGERLOOP,
                  "contract_text": ONE_SIDED_SAAS, "perspective": "customer"},
         graders=[one_of("analysis.risk_level", "high", "critical"),
                  count("analysis.negotiation_points", 3),
                  mentions("analysis", "terminat", name="flags one-sided termination"),
                  mentions("analysis", "data", name="flags the data-use clause"),
                  mentions("analysis", "Singapore", "governing law", "jurisdiction",
                           name="flags foreign governing law"),
                  judge("The suggested changes are concrete enough to send to the supplier "
                        "(specific wording or numbers, not 'consider negotiating').",
                        path="analysis.negotiation_points")],
         story="SaaS founder about to sign a hosting contract that is heavily one-sided.",
         latency_s=90),

    Case(id="lex.review.fair_nda_not_alarmist", agent="lex", endpoint="/ai/lex/analyze-contract",
         payload={"user_id": "eval_user", "organization_id": KULHAD,
                  "contract_text": FAIR_NDA, "perspective": "Kulhad Co."},
         graders=[one_of("analysis.risk_level", "low", "medium"),
                  judge("Does not describe any clause as dangerous or one-sided when the "
                        "agreement is mutual and standard.", category=HONEST, path="analysis")],
         story="Owner checks a standard mutual NDA. Crying wolf makes them ignore real warnings.",
         latency_s=90),

    _ask("lex.ask.notice_period", "How much notice do we need to give to end this NDA?",
         [mentions("answer", "30 days", "thirty days", name="30 days"),
          is_true("found"), count("citations", 1),
          quotes_exist("citations.*.quote", FAIR_NDA)],
         "Owner asks a plain question about an uploaded NDA and wants the clause it comes from."),

    _ask("lex.ask.not_in_document", "What penalty do we pay for late delivery under this agreement?",
         [is_true("found", False, category=HONEST, name="says it's not in the document"),
          judge("Does not invent a penalty amount or clause that is not in the NDA.",
                category=HONEST, path="answer")],
         "The NDA says nothing about delivery penalties. Making one up would be dangerous."),

    Case(id="lex.explain.hinglish", agent="lex", endpoint="/ai/lex/explain",
         payload={"user_id": "eval_user", "organization_id": LEDGERLOOP,
                  "text": "Customer shall indemnify Supplier against all claims arising from use of "
                          "the Services, including claims caused by Supplier's negligence.",
                  "context": "iska simple mein matlab kya hai? kya ye humare liye risky hai?"},
         graders=[nonempty("explanation"),
                  judge("Explains in plain language that the customer would pay for claims even "
                        "when the supplier is at fault.",
                        "Answers the 'is it risky for us' part directly.", path="")],
         story="Founder without a lawyer pastes a clause and asks in Hinglish what it means.",
         latency_s=40),

    Case(id="lex.draft.nda_uses_given_details", agent="lex", endpoint="/ai/lex/draft-document",
         payload={"user_id": "eval_user", "organization_id": KULHAD, "document_type": "nda",
                  "jurisdiction": "India",
                  "requirements": "Mutual NDA between Kulhad Co. Private Limited (Jaipur) and "
                                  "Saffron Packaging LLP (Surat) for discussing a packaging supply "
                                  "deal. Confidentiality lasts 2 years. Courts at Jaipur."},
         graders=[mentions("document", "Saffron Packaging", name="uses the counterparty's name"),
                  mentions("document", "Jaipur", name="uses the chosen court"),
                  avoids("document", r"\[[^\]]*(party|company|counterparty|jurisdiction|court|city|term|duration|period|purpose)[^\]]*\]",
                         category=USABLE, name="no blanks for details the customer gave"),
                  judge("Uses the parties, duration and jurisdiction given instead of leaving "
                        "blanks for them.", path="document")],
         story="Owner gives parties, purpose, duration and court; blanks for those mean retyping "
               "what they already said. (Signatory names and signing date were not given, so blanks there are fine.)",
         latency_s=90),
]
