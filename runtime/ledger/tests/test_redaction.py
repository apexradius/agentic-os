"""Tests for redact_text() and the evidence-redaction path in mirror_proxy_evidence.

Root cause context: Apify token was leaked into VPS proxy report files because the
apify_api_* pattern was absent from SECRETISH_PATTERNS, and mirror_proxy_evidence
wrote raw evidence content to the VPS without applying redact_text(). Both are now
fixed (commit 8717c44). This file is the regression guard.
"""
from __future__ import annotations

import importlib.machinery
import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "aorg"

FAKE_APIFY_TOKEN = "apify_api_aBcDeFgHiJkLmNoPqRsTuVwXyZ"


def load_module():
    loader = importlib.machinery.SourceFileLoader("aorg_module", str(SCRIPT))
    spec = importlib.util.spec_from_loader("aorg_module", loader)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestRedactApifyToken(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()

    def test_apify_token_redacted(self):
        result = self.mod.redact_text(f"token: {FAKE_APIFY_TOKEN}")
        self.assertNotIn(FAKE_APIFY_TOKEN, result)
        self.assertIn("[REDACTED_APIFY_TOKEN]", result)

    def test_apify_token_in_diff_content_redacted(self):
        diff = (
            "--- a/config.json\n"
            "+++ b/config.json\n"
            f"+  \"APIFY_API_KEY\": \"{FAKE_APIFY_TOKEN}\"\n"
        )
        result = self.mod.redact_text(diff, max_chars=len(diff) + 1)
        self.assertNotIn(FAKE_APIFY_TOKEN, result)
        self.assertIn("[REDACTED_APIFY_TOKEN]", result)

    def test_apify_pattern_requires_min_length(self):
        short = "apify_api_short"
        result = self.mod.redact_text(short)
        self.assertIn("apify_api_short", result)

    def test_other_patterns_redacted(self):
        cases = [
            ("AKIAIOSFODNN7EXAMPLE", "[REDACTED_AWS_ACCESS_KEY]"),
            ("sk-abcdefghijklmnopqrstuv", "[REDACTED_API_KEY]"),
            ("ghp_abcdefghijklmnopqrstuvwxyz01234567", "[REDACTED_GITHUB_TOKEN]"),
        ]
        for raw, expected_marker in cases:
            with self.subTest(raw=raw[:10]):
                result = self.mod.redact_text(raw)
                self.assertNotIn(raw, result, f"expected {raw[:10]}... to be redacted")
                self.assertIn(expected_marker, result)

    def test_benign_content_passes_through(self):
        safe = "This is a normal log line with no secrets: foo=bar baz=qux"
        result = self.mod.redact_text(safe)
        self.assertEqual(result, safe)


class TestEvidenceFileRedactionBeforeWrite(unittest.TestCase):
    """Verify the exact logic path used by mirror_proxy_evidence: reading an evidence
    file and applying redact_text() before persisting/rsyncing to VPS."""

    def setUp(self):
        self.mod = load_module()

    def test_evidence_file_content_redacted(self):
        raw_content = (
            "## Proxy diff\n"
            f"token={FAKE_APIFY_TOKEN}\n"
            "some other content\n"
        )
        # Replicate the exact expression in mirror_proxy_evidence (line 1295)
        redacted = self.mod.redact_text(raw_content, max_chars=len(raw_content) + 1)

        self.assertNotIn(FAKE_APIFY_TOKEN, redacted)
        self.assertIn("[REDACTED_APIFY_TOKEN]", redacted)
        self.assertIn("some other content", redacted)

    def test_evidence_tempfile_written_without_token(self):
        raw_content = f"secret: {FAKE_APIFY_TOKEN}\nregular: hello\n"
        redacted = self.mod.redact_text(raw_content, max_chars=len(raw_content) + 1)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".diff", delete=False, encoding="utf-8") as tmp:
            tmp.write(redacted)
            tmp_path = tmp.name

        written = Path(tmp_path).read_text(encoding="utf-8")
        Path(tmp_path).unlink()

        self.assertNotIn(FAKE_APIFY_TOKEN, written)
        self.assertIn("regular: hello", written)


if __name__ == "__main__":
    unittest.main()
