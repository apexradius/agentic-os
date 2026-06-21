---
name: gemma-eval
description: "Evaluate local model quality — reasoning, code gen, instruction following, domain knowledge benchmarks. Use when benchmarking models, comparing Gemma/Llama/Mistral, /gemma-eval."
user-invocable: true
argument-hint: "[model-name] [optional: baseline-model]"
---

# Gemma Eval

## Step 1: Select Benchmark Categories

Each category gets equal weight (20%) unless the user specifies a focus area.

### 1. Reasoning (20%)
Test multi-step logic, math, and cause-and-effect:
- 3-step word problems (e.g., "If A is twice B, and B is 3 more than C...")
- Simple logical deductions (syllogisms, negation handling)
- Cause-and-effect chains (2-3 hops)

**Scoring:** Full correct answer = 100, partial reasoning with wrong answer = 40, no reasoning = 0.

### 2. Code Generation (20%)
Test practical coding tasks at three difficulty levels:
- **Easy:** Write a function (FizzBuzz, list filtering, string manipulation)
- **Medium:** Implement a data structure or algorithm (linked list, binary search)
- **Hard:** Debug a broken function (provide code with a subtle bug)

**Scoring:** Runs correctly = 100, correct logic with syntax errors = 60, wrong approach = 20, refusal/hallucination = 0.

### 3. Instruction Following (20%)
Test structured output compliance:
- "Return valid JSON with keys: name, age, city"
- "Respond in exactly 3 bullet points"
- "Answer only yes or no"
- "Format as a markdown table with columns X, Y, Z"

**Scoring:** Exact format compliance = 100, correct content but wrong format = 50, ignores format = 0.

### 4. Domain Knowledge (20%)
Test knowledge relevant to the business:
- **Construction:** Building code questions, permit processes, material specifications
- **Marketing/SEO:** On-page ranking factors, schema markup, conversion optimization
- **Technical:** API design, database indexing, security best practices

**Scoring:** Accurate and specific = 100, partially correct = 50, confidently wrong (hallucination) = 0.

### 5. Factual Accuracy (20%)
Test with verifiable facts across domains:
- Historical dates, scientific constants, geography
- Technical specifications (HTTP status codes, SQL syntax)
- Detect hallucination: ask about a fictional entity and check if model fabricates

**Scoring:** Correct = 100, hedged but correct = 80, wrong = 0, confidently fabricated = -20 (penalty).

## Step 2: Run Evaluation

```bash
# Run each prompt against the model via Ollama API
curl -s http://localhost:11434/api/generate \
  -d '{"model":"MODEL_NAME","prompt":"PROMPT","stream":false}' | jq -r '.response'
```

Run a minimum of 5 prompts per category (25 total). For statistical significance when comparing models, run 10 per category (50 total) and report mean and standard deviation.

## Step 3: Compare Against Baseline

If a baseline model is provided, run identical prompts on both models. Report:

| Category | Test Model | Baseline | Delta |
|----------|-----------|----------|-------|
| Reasoning | [score] | [score] | [+/-] |
| Code Gen | [score] | [score] | [+/-] |
| Instruction Following | [score] | [score] | [+/-] |
| Domain Knowledge | [score] | [score] | [+/-] |
| Factual Accuracy | [score] | [score] | [+/-] |
| **Weighted Total** | **[score]** | **[score]** | **[+/-]** |

If no baseline is provided, use these reference thresholds:
- 80+ = Production-ready for the category
- 60-79 = Usable with supervision
- 40-59 = Significant gaps, not reliable
- <40 = Not suitable

## Output Format

```
## Model Evaluation: [model-name]

### Summary
- Overall Score: [weighted average]/100
- Recommendation: [production-ready / usable with caveats / not recommended]
- Best at: [top category]
- Weakest at: [bottom category]

### Category Scores
[table with per-prompt scores and category averages]

### Notable Observations
- [specific strengths, failure modes, hallucination patterns]
```

## Anti-Patterns

- **Testing with fewer than 5 prompts per category** — single data points are noise, not signal
- **Using the same prompts every evaluation** — models may have memorized benchmarks; rotate prompts
- **Ignoring hallucination detection** — a model that sounds confident but fabricates is worse than one that says "I don't know"
- **Comparing different quantization levels without noting it** — Q4 vs Q8 performance differences are expected
