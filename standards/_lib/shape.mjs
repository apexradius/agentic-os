// framework/standards/_lib/shape.mjs — scalar shape readers shared by standards validators.
//
// These are generic JSON-value predicates with no standard-specific semantics: "is this a
// plain object", "is this a non-empty string", "is this a path-shaped persisted reference".
// They are byte-for-byte identical across validators that check serialized envelope shape,
// so they live here rather than being redefined per standard. Zero npm deps — importing this
// keeps the standard-shape contract (node ESM, no package install) intact.

/** A non-null, non-array object. */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A string with non-whitespace content. */
export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A single-token, path-shaped reference (`a/b.md`, `./x#frag`) — a persisted artifact pointer. */
export function hasPersistedRef(value) {
  return hasText(value) && !/\s/.test(value.trim()) && /[./#]/.test(value.trim());
}
