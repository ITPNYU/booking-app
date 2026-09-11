import { readFileSync } from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Stately Studio imports a machine by parsing the source statically, so the
 * `createMachine({...})` argument in mcBookingMachine.ts has to be a plain
 * object literal. Anything that needs evaluation (functions, calls, spreads,
 * template strings, computed keys) is invisible to Stately and silently drops
 * whole regions from the diagram. This test fails the build instead.
 *
 * The one allowed non-literal is `context: buildMcInitialContext` — an
 * identifier reference to the initial-context factory in the impl file.
 */
const MACHINE_FILE = path.resolve(
  __dirname,
  "../../lib/stateMachines/mcBookingMachine.ts",
);
const ALLOWED_IDENTIFIER_VALUES: Record<string, string> = {
  context: "buildMcInitialContext",
};

type Violation = { line: number; kind: string; text: string };

function findCreateMachineArgument(source: ts.SourceFile): ts.Node | undefined {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "createMachine" &&
      node.arguments.length === 1
    ) {
      found = node.arguments[0];
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function collectViolations(source: ts.SourceFile, root: ts.Node): Violation[] {
  const violations: Violation[] = [];
  const report = (node: ts.Node, kind: string) => {
    const { line } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    violations.push({
      line: line + 1,
      kind,
      text: node.getText(source).split("\n")[0].slice(0, 80),
    });
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node)
    ) {
      report(node, "function");
      return;
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      report(node, "call");
      return;
    }
    if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) {
      report(node, "spread");
      return;
    }
    if (ts.isTemplateExpression(node)) {
      report(node, "template string");
      return;
    }
    if (ts.isComputedPropertyName(node)) {
      report(node, "computed key");
      return;
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      report(node, "type assertion");
      return;
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      report(node, "shorthand identifier");
      return;
    }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.initializer)) {
      const key = node.name.getText(source).replace(/^["']|["']$/g, "");
      const allowed = ALLOWED_IDENTIFIER_VALUES[key];
      if (allowed !== node.initializer.text) {
        report(node, "identifier value");
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return violations;
}

describe("mcBookingMachine stays importable by Stately Studio", () => {
  const source = ts.createSourceFile(
    MACHINE_FILE,
    readFileSync(MACHINE_FILE, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const argument = findCreateMachineArgument(source);

  it("passes a single object literal to createMachine()", () => {
    expect(argument).toBeDefined();
    expect(ts.isObjectLiteralExpression(argument!)).toBe(true);
  });

  it("contains no functions, calls, spreads, template strings, or computed keys", () => {
    const violations = collectViolations(source, argument!);
    expect(
      violations,
      violations.map((v) => `line ${v.line} (${v.kind}): ${v.text}`).join("\n"),
    ).toEqual([]);
  });

  it("does not inline implementations in setup()", () => {
    // setup({ actions: mcBookingActions, guards: mcBookingGuards }) — the
    // objects come from mcBookingMachineImpl.ts so a Stately export (which
    // stubs every implementation) can never overwrite real code here.
    const text = source.getFullText();
    expect(text).toMatch(/actions:\s*mcBookingActions/);
    expect(text).toMatch(/guards:\s*mcBookingGuards/);
  });
});
