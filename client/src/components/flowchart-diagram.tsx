import React, { useMemo, useRef, useState } from "react";
import {
  diagramBounds,
  nodeHalfSize,
  wrapNodeLabel,
  type FlowEdge,
  type FlowNode,
} from "@/lib/flowchart-model";

type Point = { x: number; y: number };

/** How far above a shape several incoming arrows join together. */
const JOIN_OFFSET = 22;

type Route = {
  path: string;
  label?: { x: number; y: number; anchor: "start" | "middle" };
};

const pathThrough = (points: Point[]) =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

/** Works out the line for one arrow, and where its label goes. */
const routeEdge = (edge: FlowEdge, from: FlowNode, to: FlowNode, allEdges: FlowEdge[], nodeMap: Map<string, FlowNode>): Route => {
  const fromSize = nodeHalfSize(from);
  const toSize = nodeHalfSize(to);
  const targetTop = to.y - toSize.height - (to.type === "output" ? 5 : 0);
  const fromBottom = from.y + fromSize.height;
  const below = to.y > from.y;

  // Arrows into a logic gate come straight down from above.
  if (to.type === "logic" && below) {
    const insideGate = from.x > to.x - toSize.width + 4 && from.x < to.x + toSize.width - 4;
    if (insideGate) {
      return { path: pathThrough([{ x: from.x, y: fromBottom }, { x: from.x, y: targetTop }]) };
    }
    // Shapes placed by hand: spread the arrows across the top of the gate.
    const gateInputs = allEdges
      .filter((item) => item.to === to.id)
      .map((item) => ({ id: item.id, x: nodeMap.get(item.from)?.x ?? 0 }))
      .sort((a, b) => a.x - b.x);
    const inputIndex = gateInputs.findIndex((item) => item.id === edge.id);
    const portX = gateInputs.length > 1 && inputIndex !== -1
      ? to.x + (inputIndex - (gateInputs.length - 1) / 2) * Math.min(80, toSize.width * 1.2)
      : to.x;
    const midY = (fromBottom + targetTop) / 2;
    return {
      path: pathThrough(
        Math.abs(from.x - portX) < 8
          ? [{ x: from.x, y: fromBottom }, { x: portX, y: targetTop }]
          : [{ x: from.x, y: fromBottom }, { x: from.x, y: midY }, { x: portX, y: midY }, { x: portX, y: targetTop }],
      ),
    };
  }

  // Arrows out of a decision diamond: straight down, or out a side corner.
  if (from.type === "decision" && to.y > from.y + 10) {
    if (edge.bendX === undefined && Math.abs(to.x - from.x) < 8) {
      return {
        path: pathThrough([{ x: from.x, y: fromBottom }, { x: from.x, y: targetTop }]),
        label: { x: from.x + 8, y: fromBottom + 16, anchor: "start" },
      };
    }
    const runX = edge.bendX ?? to.x;
    const direction = runX >= from.x ? 1 : -1;
    const corner = { x: from.x + direction * fromSize.width, y: from.y };
    const points: Point[] = [corner, { x: runX, y: from.y }];
    if (Math.abs(runX - to.x) < 8) {
      points.push({ x: to.x, y: targetTop });
    } else {
      points.push({ x: runX, y: targetTop - JOIN_OFFSET }, { x: to.x, y: targetTop - JOIN_OFFSET }, { x: to.x, y: targetTop });
    }
    return {
      path: pathThrough(points),
      label: { x: corner.x + direction * 24, y: from.y - 8, anchor: "middle" },
    };
  }

  // A shape that is clearly lower: go down, then across just above it.
  if (to.y - from.y > fromSize.height + toSize.height) {
    if (Math.abs(to.x - from.x) < 8) {
      return {
        path: pathThrough([{ x: from.x, y: fromBottom }, { x: from.x, y: targetTop }]),
        label: { x: from.x + 8, y: (fromBottom + targetTop) / 2, anchor: "start" },
      };
    }
    const joinY = targetTop - JOIN_OFFSET;
    return {
      path: pathThrough([
        { x: from.x, y: fromBottom },
        { x: from.x, y: joinY },
        { x: to.x, y: joinY },
        { x: to.x, y: targetTop },
      ]),
      label: { x: from.x + 8, y: (fromBottom + joinY) / 2, anchor: "start" },
    };
  }

  // Anything else (side by side, or pointing upward).
  const mostlyVertical = Math.abs(to.y - from.y) >= Math.abs(to.x - from.x);
  const start = mostlyVertical
    ? { x: from.x, y: from.y + (below ? fromSize.height : -fromSize.height) }
    : { x: from.x + (to.x >= from.x ? fromSize.width : -fromSize.width), y: from.y };
  const end = mostlyVertical
    ? { x: to.x, y: to.y + (below ? -toSize.height : toSize.height) }
    : { x: to.x + (to.x >= from.x ? -toSize.width : toSize.width), y: to.y };
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const points = Math.abs(start.x - end.x) < 8
    ? [start, end]
    : mostlyVertical
      ? [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
      : [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  return { path: pathThrough(points), label: { x: midX, y: midY - 7, anchor: "middle" } };
};

export function FlowchartDiagram({
  nodes,
  edges,
  onMoveNode,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onMoveNode?: (id: string, x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const bounds = diagramBounds(nodes, edges);
  const canvasWidth = Math.max(640, Math.ceil(bounds.maxX + 30));
  const canvasHeight = Math.max(200, Math.ceil(bounds.maxY + 30));
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const moveFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId || !onMoveNode || !svgRef.current) return;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svgRef.current.getScreenCTM()?.inverse();
    if (!matrix) return;
    const position = point.matrixTransform(matrix);
    onMoveNode(
      draggingId,
      Math.max(20, Math.min(canvasWidth - 20, position.x)),
      Math.max(20, Math.min(canvasHeight - 20, position.y)),
    );
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      width={canvasWidth}
      height={canvasHeight}
      className="flowchart-diagram block h-auto w-full select-none"
      style={{ display: "block", width: "100%", height: "auto" }}
      role="img"
      aria-label="Diagram"
      onPointerMove={moveFromPointer}
      onPointerUp={() => setDraggingId(null)}
      onPointerLeave={() => setDraggingId(null)}
    >
      <defs>
        <marker
          id="flow-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        const route = routeEdge(edge, from, to, edges, nodeMap);
        return (
          <g key={edge.id}>
            <path
              d={route.path}
              fill="none"
              stroke="#111"
              strokeWidth="2"
              strokeLinejoin="round"
              markerEnd="url(#flow-arrow)"
            />
            {edge.label && route.label && (
              <text
                x={route.label.x}
                y={route.label.y}
                textAnchor={route.label.anchor}
                fontFamily="'Courier New', monospace"
                fontSize="15"
                fill="#111"
                stroke="white"
                strokeWidth="5"
                paintOrder="stroke"
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((node) => {
        const size = nodeHalfSize(node);
        const lines = wrapNodeLabel(node);
        const firstLineY = -((lines.length - 1) * 9);
        const serif = node.type === "logic" || node.type === "input";
        return (
          <g
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
            className={onMoveNode ? "cursor-move" : undefined}
            onPointerDown={(event) => {
              if (!onMoveNode) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDraggingId(node.id);
            }}
          >
            {node.type === "decision" ? (
              <polygon
                points={`0,-${size.height} ${size.width},0 0,${size.height} -${size.width},0`}
                fill="white"
                stroke="#111"
                strokeWidth="2"
              />
            ) : node.type === "input" ? (
              <circle r={size.width} fill="white" stroke="#111" strokeWidth="2" />
            ) : node.type === "start" || node.type === "end" ? (
              <ellipse rx={size.width} ry={size.height} fill="white" stroke="#111" strokeWidth="2" />
            ) : node.type === "output" ? null : (
              <rect
                x={-size.width}
                y={-size.height}
                width={size.width * 2}
                height={size.height * 2}
                rx="2"
                fill="white"
                stroke="#111"
                strokeWidth="2"
              />
            )}
            <text
              x="0"
              y={firstLineY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={serif ? "Arial, Helvetica, sans-serif" : "'Courier New', monospace"}
              fontWeight="400"
              fontSize={node.type === "output" ? "18" : serif ? "16" : "14"}
              fill="#111"
              pointerEvents="none"
            >
              {lines.map((line, index) => (
                <tspan key={`${node.id}-line-${index}`} x="0" dy={index === 0 ? 0 : 18}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
