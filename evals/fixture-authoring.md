# Fixture Authoring

Author a parity fixture as a synthetic, inert mini-repo. It must use generic vocabulary and carry a
clear banner that it is never deployed. Candidates work on a throwaway copy, not the canonical
fixture.

## Fixture Shape

Keep the task multi-area enough that a correct plan must fan out. The reference pattern is a small
service with disjoint request-path, store-layer, configuration, and deploy-descriptor areas. The
task should require artifacts the scorer can inspect: a manifest, a decision ask, a closeout, and a
working-copy diff.

Use generic names for organizations, services, hosts, and features. The framework fixture must not
contain instance domains, private paths, credentials, or client/product names.

## Planted Finding Classes

Seed a fixed set of must-catch classes and record them in the answer key. The existing pattern uses
five independent classes so the judge can score coverage rather than a single broad impression. A
generic five-class set can span: a concurrency or ordering defect, an authorization gap, an
unbounded-resource issue, a configuration contradiction, and an isolation leak.

Do not make the class names the only route to success. The candidate can surface a finding
substantively without matching the answer-key id.

## Discoverable Facts vs Preference Forks

Discoverable facts are facts present in the fixture. A candidate must read them from the tree and
must not spend an operator ask on them.

Preference forks are genuine operator choices that the fixture cannot decide on its own. They belong
in a single batched decision ask with options and a recommendation. The no-steering run protocol
answers only those ratified forks.

## Answer-Key Contract

The private answer key carries:

- `discoverable_facts`: facts that must be found from the fixture, with file anchors.
- `preference_forks`: genuine decisions the operator may ratify.
- `must_catch_findings`: planted finding classes, with file anchors.

Every fact or finding anchor should resolve to real seeded content. For gap-defect anchors, the
function body can also assert that a token is absent, proving the missing behavior is actually
seeded.

## Golden Production

Produce the golden through the same no-steering protocol used for candidates. Promote it only after
independent review confirms all expected finding classes, zero discoverable asks, frozen artifacts
plus diff, and honest provenance. Self-scoring a trace against itself is only a load check; it is not
the promotion gate.
