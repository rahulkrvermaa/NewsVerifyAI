from typing import Dict, List, Tuple


def compute_article_report(propositions_data: List[Dict]) -> Tuple[str, str, List[str]]:
    """
    Generate overall assessment, summary, and key findings from claim-level results.
    Never labels an article 'fake' from a single contradicted claim, and never
    presents a support percentage as a probability of article authenticity.
    """
    total = len(propositions_data)
    if total == 0:
        return (
            "Requires further verification",
            "No independently verifiable factual propositions were extracted from this article.",
            ["No verifiable factual claims were identified in the submitted text."],
        )

    supported = sum(1 for p in propositions_data if p["verdict"] == "SUPPORTED")
    contradicted = sum(1 for p in propositions_data if p["verdict"] == "CONTRADICTED")
    conflicting = sum(1 for p in propositions_data if p["verdict"] == "CONFLICTING EVIDENCE")
    insufficient = sum(1 for p in propositions_data if p["verdict"] == "INSUFFICIENT EVIDENCE")

    if contradicted > 0 and supported == 0 and conflicting == 0:
        assessment = "Contains disputed claims"
    elif conflicting > 0 or (contradicted > 0 and supported > 0):
        assessment = "Mixed evidence"
    elif contradicted > 0:
        assessment = "Contains disputed claims"
    elif insufficient > supported:
        assessment = "Requires further verification"
    elif supported > 0 and insufficient == 0:
        assessment = "Mostly supported"
    elif supported >= insufficient:
        assessment = "Mostly supported"
    else:
        assessment = "Requires further verification"

    summary = (
        f"Out of {total} extracted factual proposition{'s' if total != 1 else ''}, "
        f"{supported} {'is' if supported == 1 else 'are'} supported by retrieved external evidence, "
        f"{contradicted} {'is' if contradicted == 1 else 'are'} contradicted, "
        f"{conflicting} {'shows' if conflicting == 1 else 'show'} conflicting evidence across sources, and "
        f"{insufficient} {'lacks' if insufficient == 1 else 'lack'} sufficient external evidence."
    )

    findings: List[str] = []
    for p in propositions_data:
        if p["verdict"] == "CONTRADICTED":
            findings.append(f"{p['claim_code']} (Contradicted): {p['claim']}")
        elif p["verdict"] == "CONFLICTING EVIDENCE":
            findings.append(f"{p['claim_code']} (Conflicting): {p['claim']}")
    for p in propositions_data:
        if p["verdict"] == "SUPPORTED" and len(findings) < 5:
            findings.append(f"{p['claim_code']} (Supported): {p['claim']}")
    if not findings:
        findings.append("Available external evidence was insufficient to establish or refute the extracted propositions.")

    return assessment, summary, findings[:6]
