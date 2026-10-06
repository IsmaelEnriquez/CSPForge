// Turns a Boolean expression such as "NOT (A AND B) AND C" into an AP-style
// logic gate diagram: input circles on top, gate rectangles below them, and
// straight arrows down to a final "output" label.

import {
  centerDiagram,
  DiagramInputError,
  type Diagram,
  type FlowEdge,
  type FlowNode,
} from "./flowchart-model";

export type LogicExpression =
  | { kind: "input"; label: string }
  | { kind: "not"; operand: LogicExpression }
  | { kind: "gate"; operator: "AND" | "OR"; left: LogicExpression; right: LogicExpression };

type Token =
  | { type: "word"; value: string; position: number }
  | { type: "operator"; value: "AND" | "OR" | "NOT"; position: number }
  | { type: "paren"; value: "(" | ")"; position: number };

const MAX_INPUTS = 10;

const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char, position: index });
      index += 1;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(index));
    if (word) {
      const upper = word[0].toUpperCase();
      if (upper === "AND" || upper === "OR" || upper === "NOT") {
        tokens.push({ type: "operator", value: upper, position: index });
      } else {
        tokens.push({ type: "word", value: word[0], position: index });
      }
      index += word[0].length;
      continue;
    }
    throw new DiagramInputError(
      `"${char}" is not allowed. Use letters or names for inputs, true/false, AND, OR, NOT, and parentheses.`,
    );
  }
  return tokens;
};

const describe = (token: Token | undefined) =>
  token ? `"${token.value}"` : "the end of the expression";

/** Reads an expression. NOT is applied first, then AND, then OR, and
 *  parentheses group anything. "A AND B AND C" means "(A AND B) AND C". */
export const parseLogicExpression = (text: string): LogicExpression => {
  if (!text.trim()) {
    throw new DiagramInputError("Type an expression, such as (A AND B) OR C.");
  }
  const tokens = tokenize(text);
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  const parsePrimary = (): LogicExpression => {
    const token = next();
    if (!token) {
      throw new DiagramInputError("The expression ends too early. Something is missing after the last operator.");
    }
    if (token.type === "word") {
      const lower = token.value.toLowerCase();
      return { kind: "input", label: lower === "true" || lower === "false" ? lower : token.value };
    }
    if (token.type === "paren" && token.value === "(") {
      const inner = parseOr();
      const closing = next();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new DiagramInputError(`A "(" is missing its matching ")". Found ${describe(closing)} instead.`);
      }
      return inner;
    }
    throw new DiagramInputError(`Expected an input like A or true, but found ${describe(token)}.`);
  };

  const parseNot = (): LogicExpression => {
    const token = peek();
    if (token?.type === "operator" && token.value === "NOT") {
      next();
      return { kind: "not", operand: parseNot() };
    }
    return parsePrimary();
  };

  const parseAnd = (): LogicExpression => {
    let left = parseNot();
    while (peek()?.type === "operator" && peek()?.value === "AND") {
      next();
      left = { kind: "gate", operator: "AND", left, right: parseNot() };
    }
    return left;
  };

  const parseOr = (): LogicExpression => {
    let left = parseAnd();
    while (peek()?.type === "operator" && peek()?.value === "OR") {
      next();
      left = { kind: "gate", operator: "OR", left, right: parseAnd() };
    }
    return left;
  };

  const expression = parseOr();
  if (position < tokens.length) {
    const extra = tokens[position];
    throw new DiagramInputError(
      extra.type === "paren" && extra.value === ")"
        ? 'There is a ")" without a matching "(".'
        : `Expected AND or OR before ${describe(extra)}.`,
    );
  }
  if (expression.kind === "input") {
    throw new DiagramInputError("Add at least one AND, OR, or NOT gate.");
  }
  return expression;
};

/** Writes an expression back out with full parentheses, e.g. "(NOT (A AND B)) AND C". */
export const formatLogicExpression = (expression: LogicExpression): string => {
  if (expression.kind === "input") return expression.label;
  if (expression.kind === "not") {
    const inner = formatLogicExpression(expression.operand);
    return expression.operand.kind === "input" ? `NOT ${inner}` : `NOT (${inner})`;
  }
  const side = (part: LogicExpression) =>
    part.kind === "gate" || part.kind === "not" ? `(${formatLogicExpression(part)})` : formatLogicExpression(part);
  return `${side(expression.left)} ${expression.operator} ${side(expression.right)}`;
};

/** Works out the output for given input values. Used by the tests and handy
 *  for checking answer choices. */
export const evaluateLogicExpression = (
  expression: LogicExpression,
  values: Record<string, boolean>,
): boolean => {
  if (expression.kind === "input") {
    if (expression.label === "true") return true;
    if (expression.label === "false") return false;
    if (!(expression.label in values)) {
      throw new Error(`No value given for input ${expression.label}`);
    }
    return values[expression.label];
  }
  if (expression.kind === "not") return !evaluateLogicExpression(expression.operand, values);
  const left = evaluateLogicExpression(expression.left, values);
  const right = evaluateLogicExpression(expression.right, values);
  return expression.operator === "AND" ? left && right : left || right;
};

// Layout sizes, in diagram units.
const ROW_HEIGHT = 95;
const GATE_HALF_HEIGHT = 20;
const GATE_PADDING = 34; // how far a gate extends past its outermost arrow
const NOT_HALF_WIDTH = 34;
const OUTPUT_GAP = 75;

const inputRadius = (label: string) => Math.max(22, Math.min(55, label.length * 5 + 8));

export const logicExpressionToDiagram = (expression: LogicExpression): Diagram => {
  const leaves: string[] = [];
  const collect = (part: LogicExpression) => {
    if (part.kind === "input") leaves.push(part.label);
    else if (part.kind === "not") collect(part.operand);
    else {
      collect(part.left);
      collect(part.right);
    }
  };
  collect(expression);
  if (leaves.length > MAX_INPUTS) {
    throw new DiagramInputError(`Use at most ${MAX_INPUTS} inputs so the diagram stays readable.`);
  }

  const largestRadius = Math.max(...leaves.map(inputRadius));
  const spacing = Math.max(90, largestRadius * 2 + 30);

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let leafIndex = 0;
  let gateCount = 0;
  let notCount = 0;

  // Places a part of the expression and returns the shape that carries its value.
  const place = (part: LogicExpression): { node: FlowNode; level: number } => {
    if (part.kind === "input") {
      const node: FlowNode = {
        id: `input-${leafIndex + 1}`,
        type: "input",
        label: part.label,
        x: leafIndex * spacing,
        y: 0,
      };
      leafIndex += 1;
      nodes.push(node);
      return { node, level: 0 };
    }
    if (part.kind === "not") {
      const child = place(part.operand);
      notCount += 1;
      const level = child.level + 1;
      const node: FlowNode = {
        id: `not-${notCount}`,
        type: "logic",
        label: "NOT",
        x: child.node.x,
        y: level * ROW_HEIGHT,
        w: NOT_HALF_WIDTH,
        h: GATE_HALF_HEIGHT,
      };
      nodes.push(node);
      edges.push({ id: `${child.node.id}-to-${node.id}`, from: child.node.id, to: node.id, label: "" });
      return { node, level };
    }
    const left = place(part.left);
    const right = place(part.right);
    gateCount += 1;
    const level = Math.max(left.level, right.level) + 1;
    const leftX = Math.min(left.node.x, right.node.x);
    const rightX = Math.max(left.node.x, right.node.x);
    const node: FlowNode = {
      id: `gate-${gateCount}`,
      type: "logic",
      label: part.operator,
      x: (leftX + rightX) / 2,
      y: level * ROW_HEIGHT,
      w: (rightX - leftX) / 2 + GATE_PADDING,
      h: GATE_HALF_HEIGHT,
    };
    nodes.push(node);
    edges.push({ id: `${left.node.id}-to-${node.id}`, from: left.node.id, to: node.id, label: "" });
    edges.push({ id: `${right.node.id}-to-${node.id}`, from: right.node.id, to: node.id, label: "" });
    return { node, level };
  };

  const root = place(expression);
  const output: FlowNode = {
    id: "output",
    type: "output",
    label: "output",
    x: root.node.x,
    y: root.node.y + GATE_HALF_HEIGHT + OUTPUT_GAP,
  };
  nodes.push(output);
  edges.push({ id: `${root.node.id}-to-output`, from: root.node.id, to: output.id, label: "" });

  return centerDiagram({ nodes, edges });
};

/** Parse and lay out in one step. Throws DiagramInputError with a friendly message. */
export const diagramFromLogicExpression = (text: string): Diagram =>
  logicExpressionToDiagram(parseLogicExpression(text));
