/**
 * Helpers for building PostgREST request paths safely.
 *
 * WHY VALIDATION, NOT ESCAPING
 * ---------------------------
 * The obvious approach is to percent-encode every interpolated value. That
 * works for a plain filter, because the decoded value stays inside the value
 * slot:
 *
 *   ClassOption?id=eq.x%29or(...  ->  22P02, grammar intact, value rejected
 *
 * It does NOT work inside a logic tree. PostgREST URL-decodes the path before
 * it parses the filter grammar, so an encoded `)` is a `)` by the time the
 * tree is built and still closes the expression early:
 *
 *   Assignment?or=(and(class_option_id.eq.x%29or(...   ->  PGRST100
 *
 * Measured against the live project, confirming the encoded form and the raw
 * form fail identically, while a double-encoded form (22P02) is the only one
 * the parser accepts. Relying on escaping inside a logic tree therefore gives
 * false assurance.
 *
 * So inside a tree the control is validation, not escaping: these ids come
 * from the database and are always UUIDs, so anything else is rejected
 * outright and no query is built. That is a stronger guarantee than escaping,
 * because it does not depend on the parser's decoding order.
 *
 * The severity is bounded: all these values originate from the database, not
 * from user input, so this is defence in depth rather than an open hole. The
 * point is that the guarantee no longer rests on an unverified assumption
 * about how PostgREST decodes paths.
 */

/** A canonical, lowercase or uppercase UUID. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * Returns the UUID, or null if it is not one.
 *
 * Callers should treat null as "do not build a query" rather than
 * interpolating the original value.
 */
export function uuidOrNull(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

/**
 * Percent-encodes a value for a plain (non-logic-tree) filter.
 *
 * Safe there because PostgREST decodes it back into the value slot rather than
 * the filter grammar. `!'()*` are escaped as well since encodeURIComponent
 * leaves them alone, keeping the value unambiguous in any future position.
 */
export function filterValue(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Encodes each element of an `in.(...)` list.
 *
 * The list's own commas are structural and must survive; the commas inside
 * each element must not, or a value would silently add another member to the
 * set — widening a scoped query into one that matches rows it should not.
 */
export function filterList(values: readonly string[]): string {
  return values.map(filterValue).join(",");
}
