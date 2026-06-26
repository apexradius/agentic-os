# Judge Validity Standard

Raw agreement is not enough for model-judge validation. A judge can agree often by chance,
especially on imbalanced labels. Judge quality must be checked against a committed gold set with
chance-corrected agreement before its verdicts are trusted.

For two raters, the framework uses Cohen's kappa. An instance may use a different validated
statistic for more raters or ordinal labels, but the invariant is the same: judge agreement must
be measured against chance, not reported as plain percent agreement.

The executable gate is [`../../standards/judge-validity/`](../../standards/judge-validity/).

> Last reviewed: 2026-06-26
