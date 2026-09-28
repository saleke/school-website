import { describe, expect, it } from "vitest";
import { ASSIGNMENT_SELECT, buildAssignmentQuery } from "@/lib/queries/assignments";

const CLASS = "11111111-1111-1111-1111-111111111111";
const SECTION_A = "22222222-2222-2222-2222-222222222222";
const SECTION_B = "33333333-3333-3333-3333-333333333333";
const TEACHER = "44444444-4444-4444-4444-444444444444";

/**
 * Extracts the `or=(...)` expression from a query, including both of its own
 * parentheses.
 *
 * Hand-rolled `indexOf` slicing is easy to get wrong here — cutting at
 * `")&select"` drops the closing paren and makes a correct query look
 * unbalanced. This walks the nesting depth instead, so it stays correct for
 * nested `and(...)` groups.
 */
function logicTree(query: string): string {
  const start = query.indexOf("or=(");
  if (start === -1) return "";
  let depth = 0;
  for (let i = start + "or=".length; i < query.length; i += 1) {
    if (query[i] === "(") depth += 1;
    else if (query[i] === ")") {
      depth -= 1;
      if (depth === 0) return query.slice(start, i + 1);
    }
  }
  return query.slice(start);
}

/** The logic tree with any nested and(...) group removed, for comma counting. */
function topLevelTree(query: string): string {
  return logicTree(query).replace(/and\([^)]*\)/, "GROUP");
}

/**
 * These tests are the regression guard for a bug that shipped to production:
 * the student filter used `column=eq.value` inside an `or=(...)` logic tree,
 * which PostgREST rejects with PGRST100. Because that error surfaces in the UI
 * as an empty list rather than a crash, nothing else in the toolchain caught
 * it. `tsc`, ESLint and `next build` all passed on the broken query.
 */

describe("buildAssignmentQuery", () => {
  describe("logic-tree syntax", () => {
    // The single most important assertion in this file. A logic tree must use
    // the dotted form; the `=` form is a parse error inside or=/and=.
    it("uses the dotted filter form inside or()", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(query).toContain("or=(");
      expect(query).toContain(`class_option_id.eq.${SECTION_A}`);
      expect(query).toContain("class_option_id.is.null");
    });

    it("never uses the =eq. form inside a logic tree", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      const tree = logicTree(query);
      expect(tree).not.toContain("=eq.");
      expect(tree).not.toContain("=is.");
    });

    it("emits exactly one top-level comma between or() arguments", () => {
      // The comma inside and(...) is expected; what must not appear is an
      // extra one at the top level, which is what produced the parse error.
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      // Two top-level arguments => exactly one separating comma.
      expect(topLevelTree(query).split(",").length - 1).toBe(1);
    });

    it("produces a balanced or() expression", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(logicTree(query).endsWith(")")).toBe(true);
      // Every or=( contributes an or( and and( an extra one; each is closed.
      const tree = logicTree(query);
      expect((tree.match(/\(/g) ?? []).length).toBe(2);
      expect((tree.match(/\)/g) ?? []).length).toBe(2);
    });
  });

  describe("student scoping", () => {
    it("scopes a sectioned student to their own section plus class-wide work", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(query).toContain(SECTION_A);
      expect(query).toContain(`class_id.eq.${CLASS}`);
      // Class-wide posts have a null section and must still be visible.
      expect(query).toContain("class_option_id.is.null");
    });

    it("does not leak another section's identifier", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(query).not.toContain(SECTION_B);
    });

    it("narrows to the class as well as the section", () => {
      // Guards the original leak: matching on class_id alone let every
      // section in a year see the same homework.
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      const tree = logicTree(query);
      expect(tree).toContain("and(");
      expect(tree).toContain(`class_id.eq.${CLASS}`);
    });

    it("omits the class filter when the student has no class", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: null,
        classOptionId: SECTION_A,
      });
      expect(query).toContain(`or=(class_option_id.eq.${SECTION_A},class_option_id.is.null)`);
      expect(query).not.toContain("and(");
    });

    it("falls back to the class when no section is assigned", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: null,
      });
      // A plain filter, so the `=` form is correct here.
      expect(query).toBe(
        `Assignment?class_id=eq.${CLASS}&select=id,title,description,subject_id,class_id,class_option_id,teacher_id,due_date,max_score,created_at,Subject(name),User(name)&order=due_date.desc&limit=20`,
      );
    });

    it("returns an unscoped query when the student has neither id", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: null,
        classOptionId: null,
      });
      expect(query).not.toContain("or=(");
      expect(query.startsWith("Assignment?select=")).toBe(true);
    });
  });

  describe("other roles", () => {
    it("scopes a teacher to their own assignments", () => {
      const query = buildAssignmentQuery({
        role: "teacher",
        classId: null,
        classOptionId: null,
        teacherId: TEACHER,
      });
      expect(query).toBe(`Assignment?teacher_id=eq.${TEACHER}&select=id,title,description,subject_id,class_id,class_option_id,teacher_id,due_date,max_score,created_at,Subject(name),User(name)&order=due_date.desc&limit=20`);
    });

    it("never sends the student branch for a teacher", () => {
      const query = buildAssignmentQuery({
        role: "teacher",
        classId: CLASS,
        classOptionId: SECTION_A,
        teacherId: TEACHER,
      });
      // A teacher must not be filtered by student scoping rules.
      expect(query).toContain("teacher_id=eq.");
      expect(query).not.toContain("or=(");
    });

    it("falls back to unscoped for an unknown role", () => {
      const query = buildAssignmentQuery({
        role: "alumni",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(query).not.toContain("or=(");
      expect(query).not.toContain("teacher_id=");
    });
  });

  describe("identifier validation", () => {
    // These replaced an earlier set of escaping tests. Escaping was the wrong
    // control inside a logic tree: PostgREST URL-decodes the path before
    // parsing the filter grammar, so a percent-encoded ')' is a ')' by the
    // time the tree is built and still closes the expression early. Measured
    // against the live project, the encoded and raw forms fail identically
    // with PGRST100. Validation does not depend on that ordering.
    it("rejects a non-uuid section and does not build a logic tree", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: "not-a-uuid",
      });
      // Falls back to the class filter rather than emitting a broken tree.
      expect(query).toBe(`Assignment?class_id=eq.${CLASS}&${ASSIGNMENT_SELECT}`);
      expect(query).not.toContain("or=(");
    });

    it("rejects a hostile value that tries to close the tree", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: "x)or(class_id.not.is.null(",
      });
      expect(query).not.toContain("or=(");
      expect(query).not.toContain("not.is.null");
    });

    it("emits no logic tree at all when neither id is a uuid", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: "also-not-a-uuid",
        classOptionId: "x)or(",
      });
      expect(query).toBe(`Assignment?${ASSIGNMENT_SELECT}`);
    });

    it("still scopes normally when both ids are valid uuids", () => {
      // The guard must not reject legitimate input.
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(query).toContain(
        `or=(and(class_option_id.eq.${SECTION_A},class_id.eq.${CLASS}),class_option_id.is.null)`,
      );
    });

    it("rejects a non-uuid teacher id", () => {
      const query = buildAssignmentQuery({
        role: "teacher",
        classId: null,
        classOptionId: null,
        teacherId: "nope",
      });
      expect(query).not.toContain("teacher_id=");
    });
  });

  describe("select clause", () => {
    it("always requests the embedded subject and author names", () => {
      const query = buildAssignmentQuery({
        role: "student",
        classId: CLASS,
        classOptionId: SECTION_A,
      });
      expect(query).toContain("Subject(name)");
      expect(query).toContain("User(name)");
      expect(query).toContain("order=due_date.desc");
      expect(query).toContain("limit=20");
    });
  });
});
