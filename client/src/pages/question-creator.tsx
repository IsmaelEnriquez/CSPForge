import React, { useState } from "react";
import { ChevronDown, Copy, FileDown, Hammer, ImagePlus, ListChecks, Printer, RotateCcw, Workflow, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  pageContainer,
  previewSheetClass,
  underlineTabClass,
} from "@/components/builder-layout";
import FlowchartQuestionCreator from "@/pages/flowchart-question-creator";
import {
  ANSWER_LETTERS,
  buildQuestionDocument,
  downloadHtmlFile,
  formatQuestionText,
  type AnswerLetter,
} from "@/lib/question-html";

const AUTHOR_NAME = "Ismael Enriquez";
const COPYRIGHT_YEAR = 2026;

type MultipleChoiceQuestion = {
  questionText: string;
  codeSegment: string;
  codeSegmentImage: string;
  followUpText: string;
  options: [string, string, string, string];
  answer: AnswerLetter | "";
};

// An original example question, so the page never starts empty.
const exampleQuestion: MultipleChoiceQuestion = {
  questionText: "Consider the following code segment.",
  codeSegment: "x ← 4\ny ← 7\nx ← x + y\ny ← x - y",
  codeSegmentImage: "",
  followUpText: "What are the values of x and y after the code segment is executed?",
  options: [
    "The value of x is 11, and the value of y is 4.",
    "The value of x is 11, and the value of y is 7.",
    "The value of x is 4, and the value of y is 7.",
    "The value of x is 7, and the value of y is 4.",
  ],
  answer: "A",
};

const emptyQuestion: MultipleChoiceQuestion = {
  questionText: "",
  codeSegment: "",
  codeSegmentImage: "",
  followUpText: "",
  options: ["", "", "", ""],
  answer: "",
};

export default function QuestionCreator() {
  const { toast } = useToast();
  const [builderMode, setBuilderMode] = useState<"multiple-choice" | "diagram">(() =>
    new URLSearchParams(window.location.search).get("mode") === "diagram" ? "diagram" : "multiple-choice",
  );
  const [question, setQuestion] = useState<MultipleChoiceQuestion>(exampleQuestion);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);

  const update = (changes: Partial<MultipleChoiceQuestion>) =>
    setQuestion((current) => ({ ...current, ...changes }));

  const updateOption = (index: number, value: string) =>
    setQuestion((current) => {
      const options = [...current.options] as MultipleChoiceQuestion["options"];
      options[index] = value;
      return { ...current, options };
    });

  const readCodeSegmentImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "That is not an image",
        description: "Copy an image, then paste it into the code image box.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image is too large",
        description: "Please copy an image smaller than 5 MB.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") update({ codeSegmentImage: reader.result });
    };
    reader.onerror = () => {
      toast({
        title: "Paste failed",
        description: "The image could not be read. Please copy it and try again.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCodeSegmentImagePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    const file = imageItem?.getAsFile();
    if (!file) return;
    event.preventDefault();
    readCodeSegmentImage(file);
  };

  /** The HTML of whichever question is on screen (multiple choice or diagram). */
  const currentPreviewHtml = () => document.getElementById("question-preview")?.outerHTML ?? "";

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(buildQuestionDocument(currentPreviewHtml()));
      toast({ title: "Copied!", description: "Question HTML copied to your clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser did not allow clipboard access.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    const previewHtml = currentPreviewHtml();
    if (!previewHtml) return;
    const answer = (document.getElementById("answer-key-display")?.dataset.answer ?? "") as AnswerLetter | "";
    if (includeAnswerKey && !answer) {
      toast({
        title: "No answer marked",
        description: "The file was exported without an answer key. Pick the correct answer to include one.",
      });
    }
    downloadHtmlFile(
      buildQuestionDocument(previewHtml, includeAnswerKey ? answer : ""),
      builderMode === "diagram" ? "cspforge-diagram-question.html" : "cspforge-question.html",
    );
    toast({ title: "Exported!", description: "Your question was downloaded as an HTML file." });
  };

  const showCode = Boolean(question.codeSegmentImage.trim() || question.codeSegment.trim());

  const modes = ["multiple-choice", "diagram"] as const;
  const modeTabs: {
    value: (typeof modes)[number];
    label: string;
    shortLabel?: string;
    icon: typeof ListChecks;
    testId: string;
  }[] = [
    { value: "multiple-choice", label: "Multiple choice", icon: ListChecks, testId: "tab-multiple-choice" },
    { value: "diagram", label: "Flowcharts & logic gates", shortLabel: "Diagrams", icon: Workflow, testId: "tab-diagram" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#builder"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to the question builder
      </a>
      <header className="no-print z-40 bg-background sm:sticky sm:top-0">
        <div
          className={`${pageContainer} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b py-3 sm:h-16 sm:flex-nowrap sm:py-0`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Hammer className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-base font-semibold tracking-[-0.015em]">CSPForge</span>
            <span className="hidden text-[13px] text-muted-foreground lg:block">
              <span className="mx-2 text-border" aria-hidden="true">/</span>
              Free question builder for AP® CSP
            </span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <label className="mr-auto flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap pr-2 text-sm text-foreground sm:mr-2">
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(event) => setIncludeAnswerKey(event.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-include-answer-key"
              />
              Include answer key
            </label>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="px-3 sm:px-4"
              data-testid="button-print"
            >
              <Printer aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Print</span>
            </Button>
            <Button onClick={handleExport} data-testid="button-export">
              <FileDown aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <section className={`${pageContainer} no-print pt-10 sm:pt-14`}>
        <h1 className="text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.025em] sm:text-[2.125rem]">
          Build AP® <span className="whitespace-nowrap">CSP-style</span> questions
        </h1>
        <p className="mt-3 max-w-[58ch] text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Multiple-choice, flowchart, and logic gate questions in the style students see on the exam. Free for
          teachers, and nothing you write leaves your browser.
        </p>
        <div
          className="mb-10 mt-8 flex gap-7 border-b sm:mb-12 sm:mt-10 sm:gap-9"
          role="tablist"
          aria-label="Question type"
          onKeyDown={handleTabListKeys(modes, builderMode, setBuilderMode)}
        >
          {modeTabs.map(({ value, label, shortLabel, icon: Icon, testId }) => {
            const selected = builderMode === value;
            return (
              <button
                key={value}
                type="button"
                id={`tab-${value}`}
                role="tab"
                aria-selected={selected}
                aria-controls="builder"
                tabIndex={selected ? 0 : -1}
                onClick={() => setBuilderMode(value)}
                className={underlineTabClass(selected)}
                data-testid={testId}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {shortLabel ? (
                  <>
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </>
                ) : (
                  label
                )}
              </button>
            );
          })}
        </div>
      </section>

      <main id="builder" role="tabpanel" aria-labelledby={`tab-${builderMode}`} className="flex-1" tabIndex={-1}>
        {builderMode === "diagram" ? (
          <FlowchartQuestionCreator />
        ) : (
          <BuilderGrid>
            <BuilderPanel title="Question builder" description="The preview updates as you type.">

              <BuilderSection title="Question">
                <Field
                  htmlFor="question-text"
                  label="Question text"
                  hint={
                    <>
                      Wrap words in <code className="hint-code">**text**</code> to highlight them in grey. Start a line
                      with <code className="hint-code">*</code> or <code className="hint-code">-</code> for a bullet
                      point.
                    </>
                  }
                >
                  <Textarea
                    id="question-text"
                    value={question.questionText}
                    onChange={(event) => update({ questionText: event.target.value })}
                    placeholder="Enter your question text here..."
                    className="resize-vertical min-h-[80px]"
                    aria-describedby="question-text-hint"
                    data-testid="input-question-text"
                  />
                </Field>

                <Field
                  htmlFor="code-segment"
                  label="Code segment"
                  optional
                  hint={
                    <>
                      Type <code className="hint-code">←</code> for assignment (or copy one from here: ←). Leave it
                      empty to hide the code box.
                    </>
                  }
                >
                  <Textarea
                    id="code-segment"
                    value={question.codeSegment}
                    onChange={(event) => update({ codeSegment: event.target.value })}
                    placeholder={"x ← 4\ny ← 7\nx ← x + y"}
                    className="code-input resize-vertical min-h-[120px]"
                    spellCheck={false}
                    aria-describedby="code-segment-hint"
                    data-testid="input-code-segment"
                  />
                </Field>

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <ImagePlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Or paste a code image
                      </p>
                      <p id="code-image-hint" className="field-hint mt-1">
                        Copy a screenshot of your own code, click the box below, and press{" "}
                        <span className="whitespace-nowrap">
                          <kbd>Ctrl</kbd>+<kbd>V</kbd>
                        </span>{" "}
                        (<span className="whitespace-nowrap">
                          <kbd>Cmd</kbd>+<kbd>V</kbd>
                        </span>{" "}
                        on a Mac). The image is used instead of the typed
                        code.
                      </p>
                    </div>
                    {question.codeSegmentImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => update({ codeSegmentImage: "" })}
                        aria-label="Remove code segment image"
                        data-testid="button-remove-code-image"
                      >
                        <X aria-hidden="true" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onPaste={handleCodeSegmentImagePaste}
                    aria-label="Code image paste area"
                    aria-describedby="code-image-hint"
                    className={`mt-3 flex min-h-16 cursor-text items-center justify-center rounded-md border border-dashed px-3 py-4 text-center text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[hsl(224_64%_45%/0.18)] ${
                      question.codeSegmentImage
                        ? "border-[hsl(152_35%_70%)] bg-success-soft text-success"
                        : "border-input bg-card text-muted-foreground hover:border-[hsl(220_10%_60%)]"
                    }`}
                    data-testid="input-code-segment-image"
                  >
                    {question.codeSegmentImage
                      ? "Image pasted. Paste again to replace it."
                      : "Click here, then paste your copied image"}
                  </div>
                </div>

                <Field
                  htmlFor="follow-up"
                  label="Follow-up question"
                  hint={
                    <>
                      Wrap words in <code className="hint-code">**text**</code> to highlight them in grey.
                    </>
                  }
                >
                  <Textarea
                    id="follow-up"
                    value={question.followUpText}
                    onChange={(event) => update({ followUpText: event.target.value })}
                    placeholder="What is displayed as a result of executing the code segment?"
                    className="resize-vertical min-h-[60px]"
                    aria-describedby="follow-up-hint"
                    data-testid="input-follow-up"
                  />
                </Field>
              </BuilderSection>

              <BuilderSection title="Answer choices">
                <p id="choices-hint" className="field-hint -mt-2">
                  Wrap words in <code className="hint-code">**text**</code> to highlight them in grey. Press{" "}
                  <kbd>Enter</kbd> for multi-line answers.
                </p>
                <div className="space-y-3">
                  {ANSWER_LETTERS.map((letter, index) => (
                    <div key={letter} className="flex items-start gap-3">
                      <ChoiceLetter letter={letter} />
                      <Textarea
                        value={question.options[index]}
                        onChange={(event) => updateOption(index, event.target.value)}
                        placeholder={`Choice ${letter}`}
                        className="flex-1 resize-vertical min-h-[40px]"
                        rows={2}
                        aria-label={`Choice ${letter}`}
                        aria-describedby="choices-hint"
                        data-testid={`input-option-${letter.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
                <AnswerKeyPicker value={question.answer} onChange={(answer) => update({ answer })} />
              </BuilderSection>

              <BuilderActions>
                <Button type="button" variant="outline" onClick={handleCopyPreview} data-testid="button-copy">
                  <Copy aria-hidden="true" />
                  Copy preview HTML
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setQuestion(emptyQuestion)}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-clear"
                >
                  <RotateCcw aria-hidden="true" />
                  Clear form
                </Button>
              </BuilderActions>
            </BuilderPanel>

            <PreviewPanel
              answer={question.answer}
              footer={
                <details className="plain-disclosure no-print group text-sm">
                  <summary>
                    How printing and exporting work
                    <ChevronDown
                      className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <ul className="field-hint list-disc space-y-1.5 pb-4 pl-5">
                    <li>"Print" prints only the question, never the answer key.</li>
                    <li>"Export" downloads an HTML file you can open, print, or paste into other tools.</li>
                    <li>Check "Include answer key" to add the answer at the bottom of the exported file.</li>
                    <li>Code keeps your exact spacing and line breaks.</li>
                    <li>Empty code and follow-up boxes are hidden.</li>
                  </ul>
                </details>
              }
            >
              <div id="question-preview" className={previewSheetClass} data-testid="preview-question">
                <div
                  className="mb-4"
                  data-testid="preview-question-text"
                  dangerouslySetInnerHTML={{
                    __html: formatQuestionText(question.questionText) || "Enter your question text...",
                  }}
                />

                {showCode && (
                  <div
                    className={`ap-code-segment${question.codeSegmentImage ? " ap-code-image-segment" : ""}`}
                    data-testid="preview-code-segment"
                  >
                    {question.codeSegmentImage ? (
                      <img src={question.codeSegmentImage} alt="Code segment" className="ap-code-image" />
                    ) : (
                      question.codeSegment
                    )}
                  </div>
                )}

                {question.followUpText.trim() && (
                  <div
                    className="mb-6"
                    data-testid="preview-follow-up"
                    dangerouslySetInnerHTML={{ __html: formatQuestionText(question.followUpText) }}
                  />
                )}

                <div className="space-y-3">
                  {ANSWER_LETTERS.map((letter, index) => (
                    <div key={letter} className="ap-choice" data-testid={`preview-option-${letter.toLowerCase()}`}>
                      <span className="ap-choice-letter">{letter}</span>
                      <span
                        className="ap-choice-text"
                        dangerouslySetInnerHTML={{
                          __html: formatQuestionText(question.options[index]) || `Choice ${letter}...`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </PreviewPanel>
          </BuilderGrid>
        )}
      </main>

      <footer className="no-print mt-auto">
        <div className={`${pageContainer} flex flex-col items-center gap-3 border-t py-10 text-center sm:py-12`}>
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Hammer className="h-4 w-4 text-primary" aria-hidden="true" />
            CSPForge
          </div>
          <div className="mx-auto max-w-[72ch] space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              CSPForge © {COPYRIGHT_YEAR} {AUTHOR_NAME}. This work is licensed under a{" "}
              <a
                href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                target="_blank"
                rel="license noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </p>
            <p>
              AP® is a trademark registered by the College Board, which is not affiliated with, and does not endorse,
              this website.
            </p>
            <p>
              Provided as is, without warranty. Teachers are responsible for reviewing questions before use. Questions
              you make stay in your browser and are never sent anywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
