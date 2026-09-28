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

import { isUuid, uuidOrNull } from "@/lib/postgrest";

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
 * Builds the `Assignment?...` path for the given viewer.
 *
 * Student scoping is the subtle case: a student should see assignments aimed
 * at their specific section, plus anything aimed at their whole class. Every
 * other section in the same year must stay invisible. Filtering on `class_id`
 * alone cannot express that, which is what previously leaked one section's
 * homework to another.
 *
 * Ids are validated rather than escaped. PostgREST decodes the path before
 * parsing a logic tree, so a percent-encoded `)` still closes the tree early
 * (measured against the live project: PGRST100, identical to the unencoded
 * form). Validation does not depend on that ordering. See lib/postgrest.ts.
 */
export function buildAssignmentQuery({
  role,
  classId,
  classOptionId,
  teacherId,
  select = ASSIGNMENT_SELECT,
}: AssignmentQueryInput): string {
  if (role === "student") {
    const section = uuidOrNull(classOptionId);
    const classUuid = uuidOrNull(classId);

    if (section) {
      // Dotted form is mandatory inside or=(...).
      // The `class_id` conjunct stops a same-named section in another year
      // from matching.
      const withinClass = classUuid
        ? `and(class_option_id.eq.${section},class_id.eq.${classUuid})`
        : `class_option_id.eq.${section}`;
      return `Assignment?or=(${withinClass},class_option_id.is.null)&${select}`;
    }
    if (classUuid) {
      // No section assigned yet: fall back to the whole class rather than
      // showing nothing at all.
      return `Assignment?class_id=eq.${classUuid}&${select}`;
    }
    return `Assignment?${select}`;
  }

  if (role === "teacher" && isUuid(teacherId)) {
    return `Assignment?teacher_id=eq.${teacherId}&${select}`;
  }

  return `Assignment?${select}`;
}

export { ASSIGNMENT_SELECT };
