// Turns AP-style pseudocode into a flowchart.
//
//   IF (grade ≥ 90)
//   {
//     honorRoll ← true
//   }
//   ELSE
//   {
//     honorRoll ← false
//   }
//
// Blocks can use { } like the AP reference sheet, or just be indented.
// IF becomes a diamond, every other line becomes a rectangle, and Start/End
// ovals are added automatically. The "true" path goes down and the "false"
// path goes to the right.

import {
  centerDiagram,
  DiagramInputError,
  nodeHalfSize,
  type Diagram,
  type FlowEdge,
  type FlowNode,
} from "./flowchart-model";

export type PseudocodeStatement =
  | { kind: "step"; text: string; line: number }
  | {
      kind: "if";
      condition: string;
      line: number;
      whenTrue: PseudocodeStatement[];
      whenFalse: PseudocodeStatement[] | null;
    };

type Token =
  | { kind: "text"; text: string; line: number }
  | { kind: "open"; line: number }
  | { kind: "close"; line: number };

/** Lets teachers type plain keyboard symbols. */
export const normalizeSymbols = (text: string) =>
  text
    .replace(/<-/g, "←")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠");

const isHeader = (text: string) => /^(IF\b|ELSE\b)/i.test(text);

const UNSUPPORTED = /^(REPEAT|FOR\s+EACH|PROCEDURE|WHILE|FOR)\b/i;

const tokenize = (source: string): Token[] => {
  const rawLines = source.replace(/\t/g, "    ").split(/\r?\n/);
  const usesBraces = /[{}]/.test(source);
  const tokens: Token[] = [];

  if (usesBraces) {
    rawLines.forEach((raw, index) => {
      const line = index + 1;
      let text = raw.trim();
      while (text.startsWith("}")) {
        tokens.push({ kind: "close", line });
        text = text.slice(1).trim();
      }
      let opens = 0;
      while (text.endsWith("{")) {
        opens += 1;
        text = text.slice(0, -1).trim();
      }
      if (text.includes("{") || text.includes("}")) {
        throw new DiagramInputError("Put { and } at the start or end of a line, not in the middle.", line);
      }
      if (text) tokens.push({ kind: "text", text, line });
      for (let count = 0; count < opens; count += 1) tokens.push({ kind: "open", line });
    });
    return tokens;
  }

  // No braces: use indentation. A line indented more than the IF or ELSE
  // above it belongs inside that IF or ELSE.
  const indentStack = [0];
  let previous: { text: string; indent: number } | null = null;
  rawLines.forEach((raw, index) => {
    const line = index + 1;
    const text = raw.trim();
    if (!text) return;
    const indent = raw.length - raw.trimStart().length;
    const current = indentStack[indentStack.length - 1];
    if (indent > current) {
      if (previous && isHeader(previous.text)) {
        indentStack.push(indent);
        tokens.push({ kind: "open", line });
      }
      // Extra indentation that does not follow IF/ELSE is ignored.
    } else if (indent < current) {
      while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
        indentStack.pop();
        tokens.push({ kind: "close", line });
      }
      if (indent > indentStack[indentStack.length - 1]) {
        throw new DiagramInputError("This line's indentation does not line up with the lines above it.", line);
      }
    }
    tokens.push({ kind: "text", text, line });
    previous = { text, indent };
  });
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ kind: "close", line: rawLines.length });
  }
  return tokens;
};

/** Removes one pair of parentheses that wraps the whole condition. */
const stripOuterParentheses = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) return trimmed;
  let depth = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] === "(") depth += 1;
    if (trimmed[index] === ")") depth -= 1;
    if (depth === 0 && index < trimmed.length - 1) return trimmed; // e.g. "(a) AND (b)"
  }
  return trimmed.slice(1, -1).trim();
};

export const parsePseudocode = (source: string): PseudocodeStatement[] => {
  if (!source.trim()) {
    throw new DiagramInputError("Type some pseudocode, such as an IF statement.");
  }
  const tokens = tokenize(normalizeSymbols(source));
  let position = 0;
  const peek = () => tokens[position];

  const parseIf = (conditionText: string, line: number): PseudocodeStatement => {
    const condition = stripOuterParentheses(conditionText);
    if (!condition) throw new DiagramInputError("This IF is missing its condition.", line);
    const whenTrue = parseBody("IF", line);
    let whenFalse: PseudocodeStatement[] | null = null;
    const after = peek();
    if (after?.kind === "text" && /^ELSE\b/i.test(after.text)) {
      position += 1;
      const rest = after.text.replace(/^ELSE\b/i, "").trim();
      if (/^IF\b/i.test(rest)) {
        whenFalse = [parseIf(rest.replace(/^IF\b/i, ""), after.line)];
      } else if (rest) {
        throw new DiagramInputError('Put the steps for ELSE on the lines below it, not on the same line.', after.line);
      } else {
        whenFalse = parseBody("ELSE", after.line);
      }
    }
    return { kind: "if", condition, line, whenTrue, whenFalse };
  };

  const parseBody = (keyword: string, line: number): PseudocodeStatement[] => {
    const next = peek();
    if (next?.kind !== "open") {
      throw new DiagramInputError(
        `The steps under ${keyword} need to be inside { } or indented under it.`,
        line,
      );
    }
    position += 1;
    return parseStatements(true, line);
  };

  const parseStatements = (insideBlock: boolean, openedOn = 0): PseudocodeStatement[] => {
    const statements: PseudocodeStatement[] = [];
    while (position < tokens.length) {
      const token = tokens[position];
      if (token.kind === "close") {
        if (!insideBlock) throw new DiagramInputError('There is a "}" without a matching "{".', token.line);
        position += 1;
        return statements;
      }
      if (token.kind === "open") {
        throw new DiagramInputError('A "{" should come right after an IF or ELSE line.', token.line);
      }
      position += 1;
      const text = token.text;
      if (/^IF\b/i.test(text)) {
        statements.push(parseIf(text.replace(/^IF\b/i, ""), token.line));
      } else if (/^ELSE\b/i.test(text)) {
        throw new DiagramInputError("This ELSE does not follow an IF block.", token.line);
      } else if (UNSUPPORTED.test(text)) {
        throw new DiagramInputError(
          "Loops and procedures are not supported yet. Use IF, ELSE, and regular steps.",
          token.line,
        );
      } else if (/^(start|end|begin|stop)$/i.test(text)) {
        // Start and End are added automatically.
      } else {
        statements.push({ kind: "step", text, line: token.line });
      }
    }
    if (insideBlock) throw new DiagramInputError('A "{" is missing its matching "}".', openedOn);
    return statements;
  };

  const statements = parseStatements(false);
  if (!statements.length) {
    throw new DiagramInputError("Add at least one step or IF statement.");
  }
  return statements;
};

// Layout sizes, in diagram units.
const VERTICAL_GAP = 50; // between the bottom of one shape and the top of the next
const BRANCH_GAP = 50; // between the true path and the false path

type Exit = { from: string; label: string; bendX?: number };

type Block = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  entry: string | null;
  exits: Exit[];
  minX: number;
  maxX: number;
  height: number;
};

const shift = (block: Block, dx: number, dy: number): Block => ({
  ...block,
  nodes: block.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy })),
  edges: block.edges.map((edge) =>
    edge.bendX === undefined ? edge : { ...edge, bendX: edge.bendX + dx },
  ),
  exits: block.exits.map((exit) =>
    exit.bendX === undefined ? exit : { ...exit, bendX: exit.bendX + dx },
  ),
  minX: block.minX + dx,
  maxX: block.maxX + dx,
});

export const pseudocodeToDiagram = (statements: PseudocodeStatement[]): Diagram => {
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${++counter}`;

  const connect = (exits: Exit[], to: string): FlowEdge[] =>
    exits.map((exit) => ({
      id: `${exit.from}-to-${to}${exit.label ? `-${exit.label}` : ""}`,
      from: exit.from,
      to,
      label: exit.label,
      ...(exit.bendX === undefined ? {} : { bendX: exit.bendX }),
    }));

  const layoutStep = (text: string): Block => {
    const node: FlowNode = { id: nextId("step"), type: "process", label: text, x: 0, y: 0 };
    const size = nodeHalfSize(node);
    node.y = size.height;
    return {
      nodes: [node],
      edges: [],
      entry: node.id,
      exits: [{ from: node.id, label: "" }],
      minX: -size.width,
      maxX: size.width,
      height: size.height * 2,
    };
  };

  const layoutSequence = (items: PseudocodeStatement[]): Block => {
    const block: Block = { nodes: [], edges: [], entry: null, exits: [], minX: 0, maxX: 0, height: 0 };
    let y = 0;
    for (const item of items) {
      const placed = shift(item.kind === "step" ? layoutStep(item.text) : layoutIf(item), 0, y);
      block.nodes.push(...placed.nodes);
      block.edges.push(...placed.edges);
      if (block.entry === null) block.entry = placed.entry;
      else if (placed.entry) block.edges.push(...connect(block.exits, placed.entry));
      block.exits = placed.exits;
      block.minX = Math.min(block.minX, placed.minX);
      block.maxX = Math.max(block.maxX, placed.maxX);
      y += placed.height + VERTICAL_GAP;
    }
    block.height = items.length ? y - VERTICAL_GAP : 0;
    return block;
  };

  const layoutIf = (statement: Extract<PseudocodeStatement, { kind: "if" }>): Block => {
    const diamond: FlowNode = {
      id: nextId("decision"),
      type: "decision",
      label: statement.condition,
      x: 0,
      y: 0,
    };
    const size = nodeHalfSize(diamond);
    diamond.y = size.height;
    const branchTop = size.height * 2 + VERTICAL_GAP;

    const block: Block = {
      nodes: [diamond],
      edges: [],
      entry: diamond.id,
      exits: [],
      minX: -size.width,
      maxX: size.width,
      height: size.height * 2,
    };

    // True path: straight down from the bottom of the diamond.
    const whenTrue = shift(layoutSequence(statement.whenTrue), 0, branchTop);
    if (whenTrue.entry) {
      block.nodes.push(...whenTrue.nodes);
      block.edges.push(...whenTrue.edges);
      block.edges.push(...connect([{ from: diamond.id, label: "true" }], whenTrue.entry));
      block.exits.push(...whenTrue.exits);
      block.minX = Math.min(block.minX, whenTrue.minX);
      block.maxX = Math.max(block.maxX, whenTrue.maxX);
      block.height = Math.max(block.height, branchTop + whenTrue.height);
    } else {
      block.exits.push({ from: diamond.id, label: "true" });
    }

    // False path: out the right corner, past everything on the true path.
    const clearX = Math.max(size.width, whenTrue.entry ? whenTrue.maxX : 0) + BRANCH_GAP;
    const falseItems = statement.whenFalse ?? [];
    const whenFalseLocal = layoutSequence(falseItems);
    if (whenFalseLocal.entry) {
      const whenFalse = shift(whenFalseLocal, clearX - whenFalseLocal.minX, branchTop);
      block.nodes.push(...whenFalse.nodes);
      block.edges.push(...whenFalse.edges);
      block.edges.push(...connect([{ from: diamond.id, label: "false" }], whenFalse.entry!));
      block.exits.push(...whenFalse.exits);
      block.maxX = Math.max(block.maxX, whenFalse.maxX);
      block.height = Math.max(block.height, branchTop + whenFalse.height);
    } else {
      block.exits.push({ from: diamond.id, label: "false", bendX: clearX });
      block.maxX = Math.max(block.maxX, clearX + 10);
    }
    return block;
  };

  const body = layoutSequence(statements);
  const start: FlowNode = { id: "start", type: "start", label: "Start", x: 0, y: 0 };
  const startSize = nodeHalfSize(start);
  start.y = -VERTICAL_GAP - startSize.height;
  const end: FlowNode = { id: "end", type: "end", label: "End", x: 0, y: 0 };
  const endSize = nodeHalfSize(end);
  end.y = body.height + VERTICAL_GAP + endSize.height;

  const nodes = [start, ...body.nodes, end];
  const edges = [
    ...connect([{ from: start.id, label: "" }], body.entry ?? end.id),
    ...body.edges,
    ...connect(body.exits, end.id),
  ];
  return centerDiagram({ nodes, edges });
};

/** Parse and lay out in one step. Throws DiagramInputError with a friendly message. */
export const diagramFromPseudocode = (source: string): Diagram =>
  pseudocodeToDiagram(parsePseudocode(source));
