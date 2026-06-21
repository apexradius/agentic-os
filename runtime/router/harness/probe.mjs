// Parse-safety probe: run the TARGET machine's own router parser against a library file.
// usage: <node> probe.mjs <abs path to dist/lib.js> <abs path to index.generated.md>
// Prints one JSON line; ok=true means the library is activation-safe on THIS machine.
const lib = await import(process.argv[2]);
const { prompts, warnings } = await lib.readPromptLibrary(process.argv[3]);
const res = lib.resolveRoutes(prompts);
const out = {
  prompts: prompts.length,
  warnings: (warnings || []).length,
  resolved: res.resolved.length,
  missing: (res.missing || []).length,
  ok: (warnings || []).length === 0 && res.resolved.length === 28 && (res.missing || []).length === 0,
};
console.log(JSON.stringify(out));
