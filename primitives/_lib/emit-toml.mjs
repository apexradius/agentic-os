// emit-toml.mjs — one-directional emit of a Codex agent `.toml` from canonical fields.
//
// The pipeline is NEVER round-tripped: canonical `.md` -> `.codex/agents/<name>.toml`.
// Nobody edits the `.toml`. So we never PARSE toml here — we only GENERATE it. That
// removes every multi-line/triple-quote parsing worry; the only duty we owe is to
// produce VALID toml from arbitrary body bytes, and to fail loudly on the one input
// shape we cannot safely embed.
//
// The Codex emit is a deliberately LOSSY projection: only name, description, and the
// body survive. model/tools/skills/mcpServers/memory/level/color/disallowedTools are
// Claude-only frontmatter and are intentionally dropped — Codex consumes a 3-key
// agent. This is by design, not a bug; the agents spec.md says so in plain words.

/**
 * Build the full text of a Codex agent .toml file.
 * @param {{name:string, description:string, body:string}} fields
 * @returns {string} complete .toml file content (with trailing newline)
 */
export function emitAgentToml({ name, description, body }) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("emitAgentToml: `name` is required and must be a non-empty string");
  }
  if (typeof description !== "string") {
    throw new Error(`emitAgentToml(${name}): \`description\` is required and must be a string`);
  }

  const cleanBody = String(body).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // The body lives inside a TOML multi-line BASIC string (""" ... """). Three
  // consecutive double-quotes would terminate it early and there is no clean escape
  // for that sequence — so we refuse rather than emit invalid toml silently.
  if (cleanBody.includes('"""')) {
    throw new Error(
      `emitAgentToml(${name}): body contains a \`"""\` sequence, which cannot be safely ` +
        `embedded in a TOML multi-line basic string. Refactor the body, or switch this ` +
        `agent's emit to a literal-string ('''…''') variant.`
    );
  }

  // In a multi-line basic string, backslash is the escape char. Make every backslash
  // literal so the body is treated as opaque bytes. (`"""` already ruled out above;
  // single/double `"` are fine inside the string.)
  const escapedBody = cleanBody.replace(/\\/g, "\\\\");

  // Closing delimiter is glued to the last body line (matches the established Codex
  // agent format). The newline right after the opening `"""` is trimmed by TOML, so
  // the parsed value is exactly the (escaped) body — no leading/trailing newline.
  const header = [
    `name = "${escapeBasic(name)}"`,
    `description = "${escapeBasic(description)}"`,
    `developer_instructions = """`,
  ].join("\n");
  return `${header}\n${escapedBody}"""\n`;
}

// Escape a value for a single-line TOML basic string ("...").
function escapeBasic(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}
