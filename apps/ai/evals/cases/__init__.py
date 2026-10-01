from evals.cases import lex, maya, others, rex


def all_cases():
    cases = [*rex.CASES, *maya.CASES, *lex.CASES, *others.CASES]
    ids = [c.id for c in cases]
    dupes = {i for i in ids if ids.count(i) > 1}
    assert not dupes, f"duplicate case ids: {dupes}"
    return cases
