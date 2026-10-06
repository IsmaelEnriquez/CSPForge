// Shared shapes and sizing rules for flowchart and logic gate diagrams.
// Kept free of React so the parsers and their tests can use it directly.

export type FlowNodeType =
  | "start"
  | "end"
  | "process"
  | "decision"
  | "logic"
  | "input"
  | "output";

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  label: string;
  /** Center of the shape. */
  x: number;
  y: number;
  /** Optional fixed half-width and half-height. Generated logic gates use these
   *  so a gate can stretch across all of the arrows that feed into it. */
  w?: number;
  h?: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  /** For arrows leaving a decision diamond: the x position of the vertical part
   *  of the arrow. Used when a "false" path has to go around a branch. */
  bendX?: number;
};

export type Diagram = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowchartTemplate = Diagram & {
  questionText?: string;
  followUpText?: string;
  options?: [string, string, string, string];
};

/** A parsing problem the teacher can fix. `line` is 1-based when known. */
export class DiagramInputError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(line ? `Line ${line}: ${message}` : message);
    this.name = "DiagramInputError";
    this.line = line;
  }
}

export const wrapNodeLabel = (node: Pick<FlowNode, "type" | "label">) => {
  const maxCharacters =
    node.type === "decision" ? 18 : node.type === "start" || node.type === "end" ? 16 : 24;
  const words = node.label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > maxCharacters) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxCharacters) {
        lines.push(word.slice(index, index + maxCharacters));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharacters) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** Half of a shape's width and height, in diagram units. */
export const nodeHalfSize = (node: Pick<FlowNode, "type" | "label" | "w" | "h">) => {
  const lines = wrapNodeLabel(node);
  const longestLine = Math.max(...lines.map((line) => line.length), 5);
  let size: { width: number; height: number };
  if (node.type === "input") {
    const radius = Math.max(22, Math.min(55, node.label.trim().length * 5 + 8));
    size = { width: radius, height: radius };
  } else if (node.type === "output") {
    size = { width: Math.max(32, longestLine * 5), height: Math.max(14, lines.length * 9) };
  } else if (node.type === "logic") {
    size = {
      width: Math.max(72, Math.min(115, longestLine * 6 + 24)),
      height: Math.max(28, lines.length * 11 + 17),
    };
  } else if (node.type === "decision") {
    size = {
      width: Math.max(100, Math.min(135, longestLine * 5 + 28)),
      height: Math.max(52, lines.length * 12 + 34),
    };
  } else if (node.type === "start" || node.type === "end") {
    size = {
      width: Math.max(62, Math.min(105, longestLine * 5 + 24)),
      height: Math.max(29, lines.length * 10 + 20),
    };
  } else {
    size = {
      width: Math.max(100, Math.min(135, longestLine * 5 + 24)),
      height: Math.max(34, lines.length * 10 + 18),
    };
  }
  return {
    width: node.w ?? size.width,
    height: node.h ?? size.height,
  };
};

/** Smallest and largest x and y covered by the shapes (and bent arrows) in a diagram. */
export const diagramBounds = (nodes: FlowNode[], edges: FlowEdge[] = []) => {
  if (!nodes.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const size = nodeHalfSize(node);
    minX = Math.min(minX, node.x - size.width);
    maxX = Math.max(maxX, node.x + size.width);
    minY = Math.min(minY, node.y - size.height);
    maxY = Math.max(maxY, node.y + size.height);
  }
  for (const edge of edges) {
    if (edge.bendX === undefined) continue;
    minX = Math.min(minX, edge.bendX - 10);
    maxX = Math.max(maxX, edge.bendX + 10);
  }
  return { minX, maxX, minY, maxY };
};

/** Moves a diagram so its left edge sits at `margin` and it is centered on a
 *  canvas at least `minWidth` wide. Returns the moved diagram. */
export const centerDiagram = (diagram: Diagram, minWidth = 640, margin = 30): Diagram => {
  const { minX, maxX, minY } = diagramBounds(diagram.nodes, diagram.edges);
  const width = maxX - minX;
  const canvasWidth = Math.max(minWidth, width + margin * 2);
  const dx = (canvasWidth - width) / 2 - minX;
  const dy = margin - minY;
  return {
    nodes: diagram.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy })),
    edges: diagram.edges.map((edge) =>
      edge.bendX === undefined ? edge : { ...edge, bendX: edge.bendX + dx },
    ),
  };
};
