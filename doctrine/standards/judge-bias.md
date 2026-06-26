# Judge Bias Standard

When a model acts as a judge, bias controls are part of verification. They are not optional
review taste.

The first rule is still deterministic-first: if a compiler, schema validator, exact match,
unit test, or tool-call check can decide the criterion, a model judge must not be used. When
judgment remains unavoidable, the judge path must declare:

- order-swap evaluation
- required agreement across swapped presentations
- separation between the producer and judge where feasible
- rubric controls that neutralize verbosity preference and self-preference
- an escalation path when swapped verdicts disagree

The executable gate is [`../../standards/judge-bias/`](../../standards/judge-bias/).

> Last reviewed: 2026-06-26
