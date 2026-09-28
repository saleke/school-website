import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enforces the escaping convention across every query built in the app.
 *
 * WHY THIS IS A TEST AND NOT A LINT RULE
 * -------------------------------------
 * The contract suite in contract.test.ts pins the *wire format* of each query
 * as a literal string. That catches a query whose shape is wrong, but it does
 * not follow the component code, so reverting `filterValue` back to a raw
 * `${id}` in a component would leave the contract suite green.
 *
 * This closes that gap by scanning the source, which means it also covers
 * call sites added after this file was written — the case that hand-review
 * reliably misses.
 *
 * THE RULE
 * --------
 * A value interpolated into a PostgREST request path must go through one of:
 *
 *   filterValue(v)  - for a plain `eq.` filter, where escaping does hold
 *   filterList(v)   - for an `in.(...)` list, encoding each element
 *   uuidOrNull(v) / isUuid(v) - for anything inside a logic tree, where
 *                     escaping does NOT hold and validation is required
 *   encodeURIComponent(v)     - the pre-existing convention, also acceptable
 *
 * The measured reason for the logic-tree carve-out is in lib/postgrest.ts:
 * PostgREST URL-decodes the path before parsing the filter grammar, so a
 * percent-encoded ')' still closes an or=(...) expression early.
 */

const SRC = join(process.cwd(), "src");

/** Only TypeScript sources; styles and json cannot build a query. */
const EXTENSIONS = [".ts", ".tsx"];

/** Matches a `${...}` interpolation inside a template that also holds a filter. */
const INTERPOLATION = /\$\{([^{}]+)\}/g;

/** A template literal that looks like a PostgREST path or query. */
const QUERY_TEMPLATE = /`[^`]*(?:select=|\?[a-z_]+=|\?$)/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (EXTENSIONS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Names that make an interpolated value acceptable.
 *
 * A value must be wrapped in one of the sanitising helpers, or be a structural
 * fragment that is not a filter value at all.
 */
const SANITISERS = ["filterValue", "filterList", "uuidOrNull", "isUuid", "encodeURIComponent"];

/**
 * Interpolated fragments that carry no user data: the base URL, a select
 * clause, a pre-built path. These are safe by construction, and a syntactic
 * rule cannot tell them apart from a raw identifier.
 */
const STRUCTURAL = [
  "url",
  "select",
  "path",
  "Path",
  "PATH",
  "query",
  "savePath",
  "saveQuery",
  "dayQuery",
  "ANNOUNCEMENTS_PATH",
  "isActive",
  "table",
  "endpoint",
];

function isAllowed(expression: string): boolean {
  return [...SANITISERS, ...STRUCTURAL].some((name) => expression.includes(name));
}

describe("PostgREST escaping convention", () => {
  // Scoped to components and route handlers.
  //
  // src/lib/queries/* is deliberately excluded: those modules are covered by
  // direct unit tests that assert their exact output, and a scanner cannot
  // help there because it sees `${classUuid}` — already validated by
  // uuidOrNull upstream — and cannot distinguish it from a raw `${id}`. The
  // place this rule adds real value is a component reverting a fix, which is
  // exactly where a raw identifier arrives from props or state.
  const files = walk(SRC).filter(
    (file) => !file.includes("/lib/queries/") && !file.includes("/lib/postgrest"),
  );
  const violations: string[] = [];

  for (const file of files) {
    // Tests construct deliberately hostile paths, so they are exempt.
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      for (const template of line.matchAll(/`[^`]*`/g)) {
        const text = template[0];
        if (!QUERY_TEMPLATE.test(text)) continue;
        for (const match of text.matchAll(INTERPOLATION)) {
          if (!isAllowed(match[1])) {
            violations.push(
              `${file.replace(SRC + "/", "")}:${index + 1}  ${match[0]}  in  ${text.slice(0, 90)}`,
            );
          }
        }
      }
    });
  }

  it("scans a meaningful number of files", () => {
    // Guards against the walker silently matching nothing, which would make
    // every assertion below pass vacuously.
    expect(files.length).toBeGreaterThan(10);
  });

  it("wraps every interpolated query value", () => {
    expect(
      violations,
      `Unescaped interpolation into a PostgREST path:\n  ${violations.join("\n  ")}\n\n` +
        `Wrap the value in filterValue(), or use uuidOrNull()/isUuid() inside a logic tree.`,
    ).toEqual([]);
  });

  it("actually detects an unwrapped value", () => {
    // The rule is only worth having if it fails on a bad input. Verified by
    // mutating a real call site during development; this keeps that honest.
    const bad = "`ClassOption?id=eq.${id}`";
    expect(QUERY_TEMPLATE.test(bad)).toBe(true);
    expect(isAllowed("id")).toBe(false);
    expect(isAllowed("filterValue(id)")).toBe(true);
  });
});
