import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diagramFromLogicExpression,
  evaluateLogicExpression,
  formatLogicExpression,
  parseLogicExpression,
} from "./logic-expression";
import { DiagramInputError, nodeHalfSize } from "./flowchart-model";

test("NOT applies only to the next input, then AND, then OR", () => {
  assert.equal(formatLogicExpression(parseLogicExpression("NOT A AND B")), "(NOT A) AND B");
  assert.equal(formatLogicExpression(parseLogicExpression("A OR B AND C")), "A OR (B AND C)");
  assert.equal(formatLogicExpression(parseLogicExpression("A AND B AND C")), "(A AND B) AND C");
  assert.equal(
    formatLogicExpression(parseLogicExpression("not (a and b) and c")),
    "(NOT (a AND b)) AND c",
  );
});

test("true and false are inputs, written in lowercase", () => {
  const expression = parseLogicExpression("TRUE AND B");
  assert.equal(formatLogicExpression(expression), "true AND B");
  assert.equal(evaluateLogicExpression(expression, { B: true }), true);
  assert.equal(evaluateLogicExpression(expression, { B: false }), false);
});

test("evaluates the AP example NOT (A AND B) AND C", () => {
  const expression = parseLogicExpression("NOT (A AND B) AND C");
  const rows = [
    [true, true, true, false],
    [true, false, true, true],
    [false, false, true, true],
    [false, true, false, false],
  ] as const;
  for (const [A, B, C, expected] of rows) {
    assert.equal(evaluateLogicExpression(expression, { A, B, C }), expected);
  }
});

test("draws NOT (A AND B) AND C in the AP layout", () => {
  const { nodes, edges } = diagramFromLogicExpression("NOT (A AND B) AND C");
  const byLabel = (label: string) => nodes.filter((node) => node.label === label);
  const [a] = byLabel("A");
  const [b] = byLabel("B");
  const [c] = byLabel("C");
  const [not] = byLabel("NOT");
  const ands = byLabel("AND").sort((first, second) => first.y - second.y);
  const [output] = byLabel("output");

  // All inputs share the top row.
  assert.equal(a.y, b.y);
  assert.equal(b.y, c.y);
  // Gates stack downward: AND, then NOT, then the final AND, then output.
  assert.ok(ands[0].y > a.y);
  assert.ok(not.y > ands[0].y);
  assert.ok(ands[1].y > not.y);
  assert.ok(output.y > ands[1].y);
  // The NOT sits right under the first AND, and the final AND reaches C.
  assert.equal(not.x, ands[0].x);
  const finalSize = nodeHalfSize(ands[1]);
  assert.ok(ands[1].x - finalSize.width < not.x);
  assert.ok(ands[1].x + finalSize.width > c.x);

  assert.equal(edges.length, 6);
  const connected = (from: string, to: string) =>
    edges.some((edge) => edge.from === from && edge.to === to);
  assert.ok(connected(a.id, ands[0].id));
  assert.ok(connected(b.id, ands[0].id));
  assert.ok(connected(ands[0].id, not.id));
  assert.ok(connected(not.id, ands[1].id));
  assert.ok(connected(c.id, ands[1].id));
  assert.ok(connected(ands[1].id, output.id));
});

test("every arrow into a gate lands inside that gate's width", () => {
  for (const text of ["(A OR B) AND (C OR D)", "NOT A OR NOT B", "((A AND B) OR C) AND NOT D"]) {
    const { nodes, edges } = diagramFromLogicExpression(text);
    for (const edge of edges) {
      const from = nodes.find((node) => node.id === edge.from)!;
      const to = nodes.find((node) => node.id === edge.to)!;
      if (to.type !== "logic") continue;
      const size = nodeHalfSize(to);
      assert.ok(from.x > to.x - size.width && from.x < to.x + size.width, `${text}: ${from.label} -> ${to.label}`);
      assert.ok(from.y < to.y);
    }
  }
});

test("gates on the same row never overlap", () => {
  const { nodes } = diagramFromLogicExpression("(NOT A AND B) OR (C AND NOT D) OR (E AND F)");
  const gates = nodes.filter((node) => node.type === "logic");
  for (const first of gates) {
    for (const second of gates) {
      if (first === second || first.y !== second.y) continue;
      const gap = Math.abs(first.x - second.x) - nodeHalfSize(first).width - nodeHalfSize(second).width;
      assert.ok(gap > 0, `${first.id} overlaps ${second.id}`);
    }
  }
});

test("explains mistakes in plain words", () => {
  const message = (text: string) => {
    try {
      parseLogicExpression(text);
      return "";
    } catch (error) {
      assert.ok(error instanceof DiagramInputError);
      return error.message;
    }
  };
  assert.match(message(""), /Type an expression/);
  assert.match(message("A AND"), /ends too early/);
  assert.match(message("(A AND B"), /missing its matching/);
  assert.match(message("A AND B)"), /without a matching/);
  assert.match(message("A B"), /Expected AND or OR/);
  assert.match(message("A && B"), /not allowed/);
  assert.match(message("A"), /at least one AND, OR, or NOT/);
});
