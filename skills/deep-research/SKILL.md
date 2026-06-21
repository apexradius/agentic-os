---
name: deep-research
description: "Multi-step web research with source verification, evidence levels (0-5), framework analysis (Porter's, PESTLE, JTBD). Use when researching topics in depth, fact-checking, market analysis, or /deep-research."
user-invocable: true
context: fork
agent: Explore
argument-hint: "[research-question]"
---

# Deep Research

Thorough multi-step research with source verification.

## Steps
1. **Formulate queries** — Break the question into 3-5 specific search queries
2. **Evidence level check** — Classify what type of evidence is available:
   - Level 3 (light "Do"): ad clicks, sign-ups, forum discussions
   - Level 4 (strong "Do"): case studies with metrics, peer-reviewed data
   - Level 5 (irrefutable): sales data, public filings, real transactions
   Flag if only Level 0–2 evidence exists (opinions, spreadsheets)
3. **Search** — WebSearch each query, collect top results
4. **Scout pattern** — Before fetching all sources, identify which 2–3 are most likely to contain primary data; fetch those first
5. **Fetch and analyze** — WebFetch the most promising sources, extract key facts
6. **Cross-reference** — Verify claims across multiple sources, flag contradictions
7. **Apply framework** — Select the most appropriate analytical lens:
   - **Porter's Five Forces**: industry competitiveness
   - **PESTLE**: macro environment
   - **Jobs-to-be-Done**: customer motivation analysis
   - **Value Proposition Canvas**: customer/offer fit
8. **Synthesize** — Combine findings into coherent analysis

## Source Reliability Rating
- **High**: Peer-reviewed, government data, audited financial filings, primary research
- **Medium**: Trade publications, credible journalism, industry reports
- **Low**: Blogs, social media, forum opinions, vendor-produced research

## Output
- **Executive summary** (3-5 sentences)
- **Key findings** (numbered, with source citations)
- **Contradictions/uncertainties** (if any)
- **Sources** (URLs with reliability rating: high/medium/low)
- **Further research needed** (open questions)
