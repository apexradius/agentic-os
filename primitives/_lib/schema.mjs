// schema.mjs — thin, honest wrapper over ajv. We do NOT hand-roll JSON-Schema
// validation: a framework whose promise is "machine-checkable" must use a conformant
// validator, not an 80-line lookalike that silently passes `oneOf`/`$ref`/`items`.

import Ajv from "ajv";
import addFormats from "ajv-formats";

/** Build a configured Ajv instance (draft-07 compatible, all errors, lenient meta). */
export function makeAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

/** Compile a schema object into a validate function. */
export function compileSchema(schema) {
  return makeAjv().compile(schema);
}

/** Turn ajv errors into short, human-readable lines. */
export function formatErrors(errors) {
  if (!errors || errors.length === 0) return [];
  return errors.map((e) => {
    const where = e.instancePath && e.instancePath.length ? e.instancePath : "(root)";
    const params =
      e.params && Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : "";
    return `${where} ${e.message}${params}`;
  });
}
