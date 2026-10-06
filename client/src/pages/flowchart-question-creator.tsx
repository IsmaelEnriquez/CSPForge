import React, { useState } from "react";
import { ChevronDown, CircuitBoard, Copy, GitBranch, Plus, RotateCcw, SlidersHorizontal, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FlowchartDiagram } from "@/components/flowchart-diagram";
import { AnswerKeyPicker } from "@/components/answer-key-picker";
import {
  BuilderActions,
  BuilderGrid,
  BuilderPanel,
  BuilderSection,
  ChoiceLetter,
  Field,
  PreviewPanel,
  handleTabListKeys,
  previewSheetClass,
  underlineTabClass,
} from "@/components/builder-layout";
import { useToast } from "@/hooks/use-toast";
import { DiagramInputError, type Diagram, type FlowEdge, type FlowNode, type FlowNodeType } from "@/lib/flowchart-model";
import { diagramFromLogicExpression } from "@/lib/logic-expression";
import { diagramFromPseudocode } from "@/lib/pseudocode-flowchart";
import { ANSWER_LETTERS, buildQuestionDocument, type AnswerLetter } from "@/lib/question-html";

type DiagramKind = "logic" | "flowchart";

type Example = {
  source: string;
  questionText: string;
  followUpText: string;
  options: [string, string, string, string];
  answer: AnswerLetter;
};

// Original example questions. Answers are marked so teachers can see how the answer key works.
const EXAMPLES: Record<DiagramKind, Example> = {
  logic: {
    source: "(A AND B) OR C",
    questionText:
      "The circuit below is made of an AND gate and an OR gate. The output of the AND gate and input C are the two inputs to the OR gate.",
    followUpText:
      "Suppose input C is false. Which of the following best describes the output of the circuit?",
    options: [
      "The output is true only when inputs A and B are both true.",
      "The output is true when at least one of inputs A and B is true.",
      "The output is always true, no matter the values of A and B.",
      "The output is always false, no matter the values of A and B.",
    ],
    answer: "A",
  },
  flowchart: {
    source: `IF (grade ≥ 90)
{
  IF (absences < 3)
  {
    honorRoll ← true
  }
  ELSE
  {
    honorRoll ← false
  }
}
ELSE
{
  honorRoll ← false
}`,
    questionText:
      "A school uses the flowchart below to decide whether a student is placed on the honor roll. The variable honorRoll is set to true or false for each student.",
    followUpText:
      "Which of the following statements sets honorRoll to the same value as the flowchart?",
    options: [
      "honorRoll ← (grade ≥ 90) AND (absences < 3)",
      "honorRoll ← (grade ≥ 90) OR (absences < 3)",
      "honorRoll ← (grade < 90) AND (absences ≥ 3)",
      "honorRoll ← (grade < 90) OR (absences < 3)",
    ],
    answer: "A",
  },
};

const HELP: Record<DiagramKind, { label: string; tips: string[]; placeholder: string }> = {
  logic: {
    label: "Type a Boolean expression",
    tips: [
      "Use AND, OR, NOT, and parentheses. Inputs can be letters or names, true, or false.",
      "NOT applies only to what comes right after it: NOT A AND B means (NOT A) AND B.",
      "Examples: NOT (A AND B) AND C  ·  (A OR B) AND (C OR D)",
    ],
    placeholder: "NOT (A AND B) AND C",
  },
  flowchart: {
    label: "Type AP pseudocode",
    tips: [
      "IF becomes a diamond and every other line becomes a rectangle. Start and End are added for you.",
      "Put the steps under IF and ELSE inside { } or indent them. ELSE IF works too.",
      "You can type <- for ←, >= for ≥, <= for ≤, and != for ≠. Loops are not supported yet.",
    ],
    placeholder: "IF (score ≥ 70)\n{\n  DISPLAY(\"Pass\")\n}\nELSE\n{\n  DISPLAY(\"Try again\")\n}",
  },
};

const draw = (kind: DiagramKind, source: string): Diagram =>
  kind === "logic" ? diagramFromLogicExpression(source) : diagramFromPseudocode(source);

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const initialDiagram = draw("logic", EXAMPLES.logic.source);

export default function FlowchartQuestionCreator() {
  const { toast } = useToast();
  const [kind, setKind] = useState<DiagramKind>("logic");
  const [sources, setSources] = useState<Record<DiagramKind, string>>({
    logic: EXAMPLES.logic.source,
    flowchart: EXAMPLES.flowchart.source,
  });
  const [inputError, setInputError] = useState("");
  const [nodes, setNodes] = useState<FlowNode[]>(initialDiagram.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialDiagram.edges);
  const [questionText, setQuestionText] = useState(EXAMPLES.logic.questionText);
  const [followUpText, setFollowUpText] = useState(EXAMPLES.logic.followUpText);
  const [options, setOptions] = useState<[string, string, string, string]>(EXAMPLES.logic.options);
  const [answer, setAnswer] = useState<AnswerLetter | "">(EXAMPLES.logic.answer);
  const [newNodeType, setNewNodeType] = useState<FlowNodeType>("process");
  const [edgeDraft, setEdgeDraft] = useState({ from: "", to: "", label: "" });

  /** Redraws the diagram. Returns false (and shows why) if the text has a mistake. */
  const redraw = (nextKind: DiagramKind, source: string) => {
    try {
      const diagram = draw(nextKind, source);
      setNodes(diagram.nodes);
      setEdges(diagram.edges);
      setInputError("");
      return true;
    } catch (error) {
      setInputError(
        error instanceof DiagramInputError ? error.message : "Something went wrong drawing this diagram.",
      );
      return false;
    }
  };

  const loadExample = (exampleKind: DiagramKind) => {
    const example = EXAMPLES[exampleKind];
    setSources((current) => ({ ...current, [exampleKind]: example.source }));
    redraw(exampleKind, example.source);
    setQuestionText(example.questionText);
    setFollowUpText(example.followUpText);
    setOptions(example.options);
    setAnswer(example.answer);
  };

  const switchKind = (nextKind: DiagramKind) => {
    if (nextKind === kind) return;
    // If nothing has been edited yet (the question is still the other example, and the
    // new tab's text is still its example), bring in the matching example question.
    const previous = EXAMPLES[kind];
    const untouched =
      questionText === previous.questionText &&
      followUpText === previous.followUpText &&
      options.every((option, index) => option === previous.options[index]) &&
      sources[nextKind] === EXAMPLES[nextKind].source;
    setKind(nextKind);
    if (untouched) loadExample(nextKind);
    else redraw(nextKind, sources[nextKind]);
  };

  const handleSourceChange = (value: string) => {
    setSources((current) => ({ ...current, [kind]: value }));
    redraw(kind, value);
  };

  const handleClear = () => {
    setSources((current) => ({ ...current, [kind]: "" }));
    setNodes([]);
    setEdges([]);
    setInputError("");
    setQuestionText("");
    setFollowUpText("");
    setOptions(["", "", "", ""]);
    setAnswer("");
  };

  const addNode = () => {
    const id = makeId("node");
    const nextY = Math.max(50, ...nodes.map((node) => node.y + 100));
    const label =
      newNodeType === "decision"
        ? "condition"
        : newNodeType === "start"
          ? "Start"
          : newNodeType === "end"
            ? "End"
            : newNodeType === "logic"
              ? "AND"
              : newNodeType === "input"
                ? "A"
                : newNodeType === "output"
                  ? "output"
                  : "step";
    setNodes((current) => [...current, { id, type: newNodeType, label, x: 320, y: nextY }]);
  };

  const updateNode = (id: string, updates: Partial<FlowNode>) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...updates } : node)));
  };

  const removeNode = (id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.from !== id && edge.to !== id));
  };

  const updateEdge = (id: string, updates: Partial<FlowEdge>) => {
    setEdges((current) => current.map((edge) => (edge.id === id ? { ...edge, ...updates } : edge)));
  };

  const addEdge = () => {
    const exists = (id: string) => nodes.some((node) => node.id === id);
    const from = exists(edgeDraft.from) ? edgeDraft.from : nodes[0]?.id;
    const to = exists(edgeDraft.to) ? edgeDraft.to : nodes[1]?.id;
    if (!from || !to || from === to) {
      toast({
        title: "Choose two different shapes",
        description: "A connection needs a starting shape and an ending shape.",
        variant: "destructive",
      });
      return;
    }
    setEdges((current) => [...current, { id: makeId("edge"), from, to, label: edgeDraft.label }]);
    setEdgeDraft((current) => ({ ...current, label: "" }));
  };

  const handleCopy = async () => {
    const preview = document.getElementById("question-preview");
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(buildQuestionDocument(preview.outerHTML));
      toast({ title: "Copied", description: "The question HTML is on your clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser did not allow clipboard access.",
        variant: "destructive",
      });
    }
  };

  const help = HELP[kind];
  const nodeOptions = nodes.map((node) => (
    <option key={node.id} value={node.id}>
      {node.label || "(blank)"}
    </option>
  ));

  const kinds = ["logic", "flowchart"] as const;
  const kindTabs: { value: DiagramKind; label: string; icon: typeof Workflow; testId: string }[] = [
    { value: "logic", label: "Logic gates", icon: CircuitBoard, testId: "tab-logic" },
    { value: "flowchart", label: "Flowchart", icon: Workflow, testId: "tab-pseudocode" },
  ];

  return (
    <BuilderGrid>
      <BuilderPanel
        title="Diagram question builder"
        description="Describe the diagram in text, and CSPForge draws it in AP exam style."
      >
        <BuilderSection title="Diagram">
          <div
            className="flex gap-6 border-b"
            role="tablist"
            aria-label="Diagram type"
            onKeyDown={handleTabListKeys(kinds, kind, switchKind)}
          >
            {kindTabs.map(({ value, label, icon: Icon, testId }) => {
              const selected = kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  id={`kind-tab-${value}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls="diagram-source-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => switchKind(value)}
                  className={underlineTabClass(selected)}
                  data-testid={testId}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          <div id="diagram-source-panel" role="tabpanel" aria-labelledby={`kind-tab-${kind}`}>
            <Field
              htmlFor="diagram-source"
              label={help.label}
              hint={
                <ul className="list-disc space-y-1 pl-4">
                  {help.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              }
            >
              <Textarea
                id="diagram-source"
                value={sources[kind]}
                onChange={(event) => handleSourceChange(event.target.value)}
                className={`code-input ${kind === "logic" ? "min-h-16" : "min-h-[19rem]"} ${
                  inputError ? "border-amber-500 focus-visible:ring-amber-500" : ""
                }`}
                placeholder={help.placeholder}
                spellCheck={false}
                aria-describedby="diagram-source-hint diagram-source-status"
                aria-invalid={Boolean(inputError)}
                data-testid="input-diagram-source"
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                {inputError ? (
                  <p
                    id="diagram-source-status"
                    className="flex-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    role="status"
                    data-testid="text-diagram-error"
                  >
                    {inputError} The preview shows the last diagram that worked.
                  </p>
                ) : (
                  <p id="diagram-source-status" className="field-hint pt-1.5" role="status">
                    The diagram updates as you type.
                  </p>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => loadExample(kind)}>
                  Load example question
                </Button>
              </div>
            </Field>
          </div>
        </BuilderSection>

        <BuilderSection title="Question">
          <Field htmlFor="flowchart-intro" label="Question introduction">
            <Textarea
              id="flowchart-intro"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
              className="min-h-20"
            />
          </Field>

          <Field htmlFor="flowchart-question" label="Question under the diagram">
            <Textarea
              id="flowchart-question"
              value={followUpText}
              onChange={(event) => setFollowUpText(event.target.value)}
              className="min-h-20"
            />
          </Field>
        </BuilderSection>

        <BuilderSection title="Answer choices">
          <div className="space-y-3">
            {ANSWER_LETTERS.map((letter, index) => (
              <div key={letter} className="flex items-start gap-3">
                <ChoiceLetter letter={letter} />
                <Textarea
                  value={options[index]}
                  onChange={(event) =>
                    setOptions((current) => {
                      const next = [...current] as [string, string, string, string];
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                  className="min-h-12"
                  rows={2}
                  aria-label={`Option ${letter}`}
                />
              </div>
            ))}
          </div>
          <AnswerKeyPicker value={answer} onChange={setAnswer} />
        </BuilderSection>

        <div className="pb-4">
          <details className="plain-disclosure group border-b-0">
            <summary>
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Fine-tune shapes and arrows by hand
              </span>
              <ChevronDown
                className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-6 pb-6 pt-1">
              <p className="field-hint">
                Changes here are replaced the next time you edit the text above. You can also drag shapes in the
                preview.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={newNodeType}
                  onChange={(event) => setNewNodeType(event.target.value as FlowNodeType)}
                  className="native-select min-w-0 flex-1"
                  aria-label="New shape type"
                >
                  <option value="start">Start oval</option>
                  <option value="end">End oval</option>
                  <option value="process">Step rectangle</option>
                  <option value="decision">Decision diamond</option>
                  <option value="logic">Logic gate rectangle</option>
                  <option value="input">Input circle</option>
                  <option value="output">Output label</option>
                </select>
                <Button type="button" variant="outline" onClick={addNode}>
                  <Plus aria-hidden="true" />
                  Add shape
                </Button>
              </div>

              {nodes.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_64px_64px_32px] gap-2 text-xs font-medium text-muted-foreground">
                    <span>Shape text</span>
                    <span>X</span>
                    <span>Y</span>
                    <span className="sr-only">Delete</span>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {nodes.map((node) => (
                      <div
                        key={node.id}
                        className="grid grid-cols-[1fr_64px_64px_32px] items-center gap-2"
                      >
                        <Input
                          value={node.label}
                          onChange={(event) => updateNode(node.id, { label: event.target.value })}
                          aria-label="Shape text"
                          className="h-8"
                        />
                        <Input
                          type="number"
                          value={Math.round(node.x)}
                          onChange={(event) => updateNode(node.id, { x: Number(event.target.value) })}
                          aria-label={`Horizontal position for ${node.label}`}
                          title="Horizontal position"
                          className="h-8 px-2"
                        />
                        <Input
                          type="number"
                          value={Math.round(node.y)}
                          onChange={(event) => updateNode(node.id, { y: Number(event.target.value) })}
                          aria-label={`Vertical position for ${node.label}`}
                          title="Vertical position"
                          className="h-8 px-2"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeNode(node.id)}
                          aria-label={`Delete ${node.label}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nodes.length >= 2 && (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium">Add an arrow</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={nodes.some((node) => node.id === edgeDraft.from) ? edgeDraft.from : nodes[0]?.id}
                      onChange={(event) => setEdgeDraft((current) => ({ ...current, from: event.target.value }))}
                      className="native-select"
                      aria-label="Arrow starts at"
                    >
                      {nodeOptions}
                    </select>
                    <select
                      value={nodes.some((node) => node.id === edgeDraft.to) ? edgeDraft.to : nodes[1]?.id}
                      onChange={(event) => setEdgeDraft((current) => ({ ...current, to: event.target.value }))}
                      className="native-select"
                      aria-label="Arrow ends at"
                    >
                      {nodeOptions}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={edgeDraft.label}
                      onChange={(event) => setEdgeDraft((current) => ({ ...current, label: event.target.value }))}
                      placeholder="Arrow label, such as true or false"
                      aria-label="New arrow label"
                    />
                    <Button type="button" variant="outline" onClick={addEdge}>
                      <GitBranch aria-hidden="true" />
                      Connect
                    </Button>
                  </div>
                </fieldset>
              )}

              {edges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Arrows</p>
                  <div className="space-y-1.5">
                    {edges.map((edge) => (
                      <div
                        key={edge.id}
                        className="grid grid-cols-[1fr_1fr_80px_32px] items-center gap-2"
                      >
                        <select
                          value={edge.from}
                          onChange={(event) => updateEdge(edge.id, { from: event.target.value })}
                          className="native-select h-8 min-w-0 px-2 text-xs"
                          aria-label="Arrow starts at"
                        >
                          {nodeOptions}
                        </select>
                        <select
                          value={edge.to}
                          onChange={(event) => updateEdge(edge.id, { to: event.target.value })}
                          className="native-select h-8 min-w-0 px-2 text-xs"
                          aria-label="Arrow ends at"
                        >
                          {nodeOptions}
                        </select>
                        <Input
                          value={edge.label}
                          onChange={(event) => updateEdge(edge.id, { label: event.target.value })}
                          placeholder="Label"
                          aria-label="Arrow label"
                          className="h-8 px-2"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setEdges((current) => current.filter((item) => item.id !== edge.id))}
                          aria-label="Delete arrow"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        <BuilderActions>
          <Button type="button" variant="outline" onClick={handleCopy}>
            <Copy aria-hidden="true" />
            Copy preview HTML
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-clear-diagram"
          >
            <RotateCcw aria-hidden="true" />
            Clear
          </Button>
        </BuilderActions>
      </BuilderPanel>

      <PreviewPanel answer={answer} aside="Drag shapes to move them">
        <div id="question-preview" className={previewSheetClass} data-testid="preview-flowchart-question">
          {questionText.trim() && (
            <div className="mb-4 whitespace-pre-wrap" style={{ marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
              {questionText}
            </div>
          )}
          {nodes.length > 0 && (
            <div className="mx-auto mb-5 max-w-2xl" style={{ maxWidth: "42rem", margin: "0 auto 1.25rem" }}>
              <FlowchartDiagram
                nodes={nodes}
                edges={edges}
                onMoveNode={(id, x, y) => updateNode(id, { x, y })}
              />
            </div>
          )}
          {followUpText.trim() && (
            <div className="mb-6 whitespace-pre-wrap" style={{ marginBottom: "1.5rem", whiteSpace: "pre-wrap" }}>
              {followUpText}
            </div>
          )}
          <div className="space-y-3">
            {ANSWER_LETTERS.map((letter, index) => (
              <div key={letter} className="ap-choice">
                <span className="ap-choice-letter">{letter}</span>
                <span className="ap-choice-text">{options[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </PreviewPanel>
    </BuilderGrid>
  );
}
