/**
 * PostgREST query construction for the assignment board.
 *
 * Extracted from the component so it can be unit-tested directly. Every
 * function here returns a query string, and none of them perform I/O, so the
 * tests need no database and no network.
 *
 * The important invariant, which is asserted in the tests and was the cause of
 * a real production bug: **PostgREST logic trees (`or=`, `and=`) require the
 * dotted filter form `column.eq.value`.** The `column=eq.value` form is only
 * valid for top-level filters and produces a `PGRST100` parse error inside a
 * logic tree. That error is indistinguishable from "no results" in the UI, so
 * a student would simply see an empty list.
 */

const ASSIGNMENT_SELECT =
  "select=id,title,description,subject_id,class_id,class_option_id,teacher_id,due_date,max_score,created_at,Subject(name),User(name)&order=due_date.desc&limit=20";

export type AssignmentQueryInput = {
  role: string;
  classId: string | null;
  classOptionId: string | null;
  teacherId?: string;
  select?: string;
};

/**
 * Escapes a value for use inside a logic tree or a plain filter.
 *
 * `encodeURIComponent` is not sufficient on its own. Per RFC 3986 it leaves
 * the sub-delimiters `!'()*` unescaped, and parentheses are structural inside
 * a PostgREST logic tree: a value containing `)` would close the `or=(...)`
 * early and let the remainder be parsed as a new filter. Those characters are
 * therefore escaped explicitly.
 */
function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Builds the `Assignment?...` path for the given viewer.
 *
 * Student scoping is the subtle case: a student should see assignments aimed
 * at their specific section, plus anything aimed at their whole class. Every
 * other section in the same year must stay invisible. Filtering on `class_id`
 * alone cannot express that, which is what previously leaked one section's
 * homework to another.
 */
export function buildAssignmentQuery({
  role,
  classId,
  classOptionId,
  teacherId,
  select = ASSIGNMENT_SELECT,
}: AssignmentQueryInput): string {
  if (role === "student") {
    if (classOptionId) {
      // Dotted form is mandatory inside or=(...).
      const scope = `class_option_id.eq.${encode(classOptionId)}`;
      const withinClass = classId
        ? `and(${scope},class_id.eq.${encode(classId)})`
        : scope;
      return `Assignment?or=(${withinClass},class_option_id.is.null)&${select}`;
    }
    if (classId) {
      // No section assigned yet: fall back to the whole class rather than
      // showing nothing at all.
      return `Assignment?class_id=eq.${encode(classId)}&${select}`;
    }
    return `Assignment?${select}`;
  }

  if (role === "teacher" && teacherId) {
    return `Assignment?teacher_id=eq.${encode(teacherId)}&${select}`;
  }

  return `Assignment?${select}`;
}

export { ASSIGNMENT_SELECT };
