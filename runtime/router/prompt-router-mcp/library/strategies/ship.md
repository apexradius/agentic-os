## Ship Strategy

```text
Drive toward the smallest verified release unit.

Use this discipline:
1. Name the exact artifact, endpoint, command, or workflow being shipped.
2. Keep unrelated cleanup out of the slice.
3. Prefer reversible changes and an explicit rollback path.
4. Run the narrowest validation that exercises the changed path.
5. Stop only after observed output matches the stated intent, or after a blocker is
   recorded with the missing artifact.

Do not call the slice shipped when only code changed. Shipped means the relevant path was
triggered and observed.
```
