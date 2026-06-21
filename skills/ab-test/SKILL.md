---
name: ab-test
description: "Plan and analyze A/B tests — sample size calculation, variant design, statistical significance analysis. Use when running experiments, testing variants, or /ab-test."
user-invocable: true
argument-hint: "[test-description]"
---

# A/B Test Framework

Plan, execute, and analyze experiments.

## Planning

### 1. Hypothesis
"Changing [X] from [current] to [variant] will increase [metric] by [expected %] because [reason]."

### 2. Sample Size Calculator
```python
from math import ceil
import scipy.stats as stats

def sample_size(baseline_rate, min_detectable_effect, alpha=0.05, power=0.8):
    """Calculate required sample size per variant."""
    p1 = baseline_rate
    p2 = baseline_rate * (1 + min_detectable_effect)
    z_alpha = stats.norm.ppf(1 - alpha/2)
    z_beta = stats.norm.ppf(power)
    n = ceil(((z_alpha + z_beta)**2 * (p1*(1-p1) + p2*(1-p2))) / (p2 - p1)**2)
    return n

# Example: 3% baseline conversion, detect 20% lift
n = sample_size(0.03, 0.20)  # ~4,000 per variant
```

### 3. Test Design
- **Control (A)**: Current version
- **Variant (B)**: Changed version
- **Metric**: Primary (conversion) + guardrail (bounce rate)
- **Duration**: Until sample size reached (minimum 1 week for day-of-week effects)
- **Traffic split**: 50/50

## Analysis

### Statistical Significance
```python
from scipy.stats import chi2_contingency
import numpy as np

# Observed data
control = [conversions_a, visitors_a - conversions_a]
variant = [conversions_b, visitors_b - conversions_b]

chi2, p_value, dof, expected = chi2_contingency([control, variant])
significant = p_value < 0.05
lift = (conversions_b/visitors_b) / (conversions_a/visitors_a) - 1
```

## Test Prioritization — ICE Scoring
Before building a test, score it:
- **I**mpact: 1–10 (how much will this move the conversion metric?)
- **C**onfidence: 1–10 (how sure are you it will work — prior data, heatmaps, user research?)
- **E**ase: 1–10 (how fast/cheap to implement?)

ICE = (I + C + E) / 3 → run highest ICE tests first.

## Common Test Types (by impact level)
High impact first:
1. Headline / Value proposition copy
2. Offer or pricing presentation
3. Hero image / hero video
4. CTA button copy ("Start Free Trial" vs "Get Started")
5. Form length (fewer fields)
6. Trust signals placement
7. Page layout (above fold content)
8. Button color (lowest impact — test last)

## Anti-Patterns
- **Peeking problem**: Checking results before sample size is reached → false positives. Run until completion.
- **Multiple comparisons**: Testing 5 variants simultaneously without adjusting significance threshold → inflated false positive rate
- **Segment pollution**: Showing variants to returning visitors who saw the control → bias in results
- **Marginal variable testing**: Testing button color before testing headline/offer = wasted cycles
- **Calling tests too early**: Minimum 95% confidence AND sample size reached before declaring winner

## Output
```markdown
# A/B Test Results: [Test Name]

| Metric | Control | Variant | Lift | p-value | Significant |
|--------|---------|---------|------|---------|-------------|
| Conversion | 3.2% | 3.8% | +18.7% | 0.023 | ✅ Yes |
| Bounce Rate | 42% | 41% | -2.4% | 0.34 | ❌ No |

**Recommendation**: [Ship variant / Extend test / Revert]
**ICE Score**: [X] | **Test Duration**: [N days] | **Sample Size**: [N per variant]
```
