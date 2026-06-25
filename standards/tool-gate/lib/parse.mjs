// lib/parse.mjs — normalize a tool call into a Surface the rules can inspect.
//
// A "tool call" is whatever shape a runtime hands a PreToolUse hook. We accept the common
// keys across Claude and Codex without depending on either:
//   { tool|tool_name, input|tool_input: { command | file_path/content | new_string | ... } }
// or the flat convenience shape { tool, command, content, path }. The Surface is the single
// object every rule reads, so a rule never has to know the call's wire format.

/** Pull the tool name from any of the accepted keys. */
function toolName(call) {
  return call.tool || call.tool_name || call.name || "";
}

/** Pull the structured input bag from any of the accepted keys (or the call itself). */
function inputOf(call) {
  return call.input || call.tool_input || call.params || call;
}

/**
 * Build a Surface from one tool call.
 * @returns {{tool:string, command:string, content:string, path:string, text:string, raw:object}}
 */
export function buildSurface(call) {
  const tool = String(toolName(call));
  const inp = inputOf(call) || {};

  // Bash/shell carry an executable command.
  const command = String(inp.command ?? inp.cmd ?? (tool.toLowerCase() === "bash" ? inp.text ?? "" : "") ?? "");

  // Write/Edit carry file content (new_string for an Edit, content for a Write).
  const content = String(inp.content ?? inp.new_string ?? inp.new_str ?? inp.replacement ?? "");

  // Anything touching a path.
  const path = String(inp.file_path ?? inp.path ?? inp.filename ?? "");

  // The broad scan surface: everything an injected payload or secret could hide in.
  const text = [command, content, path].filter(Boolean).join("\n");

  return { tool, command, content, path, text, raw: call };
}

/** Parse a JSONL fixture (one tool call per non-blank line) into Surfaces. */
export function surfacesFromJsonl(jsonl) {
  return jsonl
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l) => buildSurface(JSON.parse(l)));
}
