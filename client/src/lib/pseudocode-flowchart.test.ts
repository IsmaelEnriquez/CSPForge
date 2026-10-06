import assert from "node:assert/strict";
import { test } from "node:test";
import { diagramFromPseudocode, parsePseudocode } from "./pseudocode-flowchart";
import { DiagramInputError, nodeHalfSize, type FlowNode } from "./flowchart-model";

const HONOR_ROLL_BRACES = `IF (grade >= 90)
{
  IF (absences < 3)
  {
    honorRoll <- true
  }
  ELSE
  {
    honorRoll <- false
  }
}
ELSE
{
  honorRoll <- false
}`;

const HONOR_ROLL_INDENTED = `IF (grade ≥ 90)
  IF (absences < 3)
    honorRoll ← true
  ELSE
    honorRoll ← false
ELSE
  honorRoll ← false`;

test("braces and indentation give the same result", () => {
  assert.deepEqual(
    stripLines(parsePseudocode(HONOR_ROLL_BRACES)),
    stripLines(parsePseudocode(HONOR_ROLL_INDENTED)),
  );
});

test("reads nested IF/ELSE and converts keyboard symbols", () => {
  const [outer] = parsePseudocode(HONOR_ROLL_BRACES);
  assert.equal(outer.kind, "if");
  if (outer.kind !== "if") return;
  assert.equal(outer.condition, "grade ≥ 90");
  assert.equal(outer.whenTrue.length, 1);
  assert.deepEqual(stripLines(outer.whenFalse ?? []), [{ kind: "step", text: "honorRoll ← false" }]);
  const inner = outer.whenTrue[0];
  assert.equal(inner.kind === "if" && inner.condition, "absences < 3");
});

test("ELSE IF becomes an IF inside the ELSE", () => {
  const [statement] = parsePseudocode(`IF (score ≥ 90)
{
  DISPLAY("A")
}
ELSE IF (score ≥ 80)
{
  DISPLAY("B")
}
ELSE
{
  DISPLAY("C")
}`);
  assert.equal(statement.kind, "if");
  if (statement.kind !== "if") return;
  const nested = statement.whenFalse?.[0];
  assert.equal(nested?.kind === "if" && nested.condition, "score ≥ 80");
  assert.equal(nested?.kind === "if" && nested.whenFalse?.length, 1);
});

test("keeps conditions like (a) AND (b) whole", () => {
  const [statement] = parsePseudocode("IF ((x > 1) AND (y > 2))\n{\n  z ← 3\n}");
  assert.equal(statement.kind === "if" && statement.condition, "(x > 1) AND (y > 2)");
  const [other] = parsePseudocode("IF (x > 1) AND (y > 2)\n{\n  z ← 3\n}");
  assert.equal(other.kind === "if" && other.condition, "(x > 1) AND (y > 2)");
});

test("draws the honor roll flowchart with Start, End, and labeled paths", () => {
  const { nodes, edges } = diagramFromPseudocode(HONOR_ROLL_BRACES);
  const find = (label: string) => nodes.filter((node) => node.label === label);
  assert.equal(find("Start").length, 1);
  assert.equal(find("End").length, 1);
  assert.equal(nodes.filter((node) => node.type === "decision").length, 2);
  assert.equal(find("honorRoll ← false").length, 2);

  const [start] = find("Start");
  const [end] = find("End");
  for (const node of nodes) {
    if (node !== start) assert.ok(node.y > start.y, `${node.label} is below Start`);
    if (node !== end) assert.ok(node.y < end.y, `${node.label} is above End`);
  }
  const labels = edges.map((edge) => edge.label).filter(Boolean).sort();
  assert.deepEqual(labels, ["false", "false", "true", "true"]);
  // Every shape except End has a way out, and every shape except Start has a way in.
  for (const node of nodes) {
    if (node !== end) assert.ok(edges.some((edge) => edge.from === node.id), `${node.label} has an arrow out`);
    if (node !== start) assert.ok(edges.some((edge) => edge.to === node.id), `${node.label} has an arrow in`);
  }
  assertNoOverlap(nodes);
});

test("an IF without ELSE sends the false arrow around the true steps", () => {
  const { nodes, edges } = diagramFromPseudocode("IF (x > 5)\n{\n  DISPLAY(x)\n}\nDISPLAY(\"done\")");
  const decision = nodes.find((node) => node.type === "decision")!;
  const shown = nodes.find((node) => node.label === "DISPLAY(x)")!;
  const done = nodes.find((node) => node.label === 'DISPLAY("done")')!;
  const falseEdge = edges.find((edge) => edge.from === decision.id && edge.label === "false")!;
  assert.equal(falseEdge.to, done.id);
  assert.ok(falseEdge.bendX! > shown.x + nodeHalfSize(shown).width);
  assert.ok(edges.some((edge) => edge.from === shown.id && edge.to === done.id));
  assertNoOverlap(nodes);
});

test("deep nesting in both paths does not overlap", () => {
  const { nodes } = diagramFromPseudocode(`IF (a > 1)
  IF (b > 2)
    x ← 1
  ELSE
    x ← 2
  y ← 3
ELSE
  IF (c > 3)
    IF (d > 4)
      x ← 4
    ELSE
      x ← 5
  ELSE
    x ← 6
DISPLAY(x)`);
  assertNoOverlap(nodes);
});

test("explains mistakes with line numbers", () => {
  const message = (source: string) => {
    try {
      parsePseudocode(source);
      return "";
    } catch (error) {
      assert.ok(error instanceof DiagramInputError);
      return error.message;
    }
  };
  assert.match(message(""), /Type some pseudocode/);
  assert.match(message("IF (x > 1)\ny ← 2"), /^Line 1: .*inside \{ \} or indented/);
  assert.match(message("x ← 1\nELSE\n  y ← 2"), /^Line 2: .*does not follow an IF/);
  assert.match(message("REPEAT 3 TIMES\n{\n  x ← x + 1\n}"), /^Line 1: Loops/);
  assert.match(message("IF (x > 1)\n{\n  y ← 2"), /missing its matching "}"/);
  assert.match(message("x ← 1\n}"), /^Line 2: .*without a matching/);
  assert.match(message("IF ()\n{\n  y ← 2\n}"), /missing its condition/);
});

function stripLines(statements: ReturnType<typeof parsePseudocode>): unknown[] {
  return statements.map((statement) =>
    statement.kind === "step"
      ? { kind: "step", text: statement.text }
      : {
          kind: "if",
          condition: statement.condition,
          whenTrue: stripLines(statement.whenTrue),
          whenFalse: statement.whenFalse ? stripLines(statement.whenFalse) : null,
        },
  );
}

function assertNoOverlap(nodes: FlowNode[]) {
  for (const first of nodes) {
    for (const second of nodes) {
      if (first === second) continue;
      const a = nodeHalfSize(first);
      const b = nodeHalfSize(second);
      const apartX = Math.abs(first.x - second.x) >= a.width + b.width;
      const apartY = Math.abs(first.y - second.y) >= a.height + b.height;
      assert.ok(apartX || apartY, `"${first.label}" overlaps "${second.label}"`);
    }
  }
}
