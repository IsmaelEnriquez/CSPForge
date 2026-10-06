import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AnswerLetter } from "@/lib/question-html";

/** Width and side padding shared by the header, page body, and footer, so their edges line up. */
export const pageContainer = "mx-auto w-full max-w-[78rem] px-4 sm:px-6 lg:px-10";

/** The two-column page body: the builder on the left, the question sheet (the focus) on the right. */
export function BuilderGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(pageContainer, "pb-20")}>
      <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 xl:gap-20">
        {children}
      </div>
    </div>
  );
}

/** The builder form. It sits directly on the page, with no card around it. */
export function BuilderPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="no-print min-w-0">
      <div className="pb-5">
        <h2 className="text-lg font-semibold leading-tight tracking-[-0.015em]">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** The row of secondary actions at the end of the builder. */
export function BuilderActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t pt-6">{children}</div>;
}

/** A titled group of fields, separated from the previous group by a hairline rule. */
export function BuilderSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className={cn("space-y-6 border-t pb-10 pt-6", className)}>
      <h3 id={headingId} className="section-heading">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A label, an optional hint, and the input it describes.
 *  The hint's id is `${htmlFor}-hint`, for the input's aria-describedby. */
export function Field({
  htmlFor,
  label,
  optional,
  hint,
  children,
}: {
  htmlFor?: string;
  label: React.ReactNode;
  optional?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <Label htmlFor={htmlFor} className="flex items-baseline gap-2 leading-snug">
          {label}
          {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
        </Label>
        {hint && (
          <div id={htmlFor ? `${htmlFor}-hint` : undefined} className="field-hint">
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** The A–D bubble next to each answer-choice box, like the bubbles on an answer sheet. */
export function ChoiceLetter({ letter }: { letter: string }) {
  return (
    <span
      aria-hidden="true"
      className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[hsl(220_10%_45%)] text-[13px] font-semibold tabular-nums text-foreground"
    >
      {letter}
    </span>
  );
}

/** The right-hand column: the question drawn as a sheet of paper, plus the answer key status.
 *  It stays in view while the teacher scrolls through the builder on wide screens. */
export function PreviewPanel({
  aside,
  answer,
  children,
  footer,
}: {
  aside?: React.ReactNode;
  answer: AnswerLetter | "";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="preview-shell space-y-6 lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:px-1 lg:pb-6">
      <section aria-labelledby="preview-heading" className="preview-shell">
        <div className="no-print flex items-end justify-between gap-4 pb-5">
          <div className="min-w-0">
            <h2 id="preview-heading" className="text-lg font-semibold leading-tight tracking-[-0.015em]">
              Live preview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{aside ?? "Exactly what students will see"}</p>
          </div>
          <span className="shrink-0 pb-0.5 text-xs font-medium text-muted-foreground">Student copy</span>
        </div>
        {children}
        <p
          id="answer-key-display"
          data-answer={answer}
          className="no-print mt-4 flex min-h-8 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm"
          data-testid="text-answer-key"
          aria-live="polite"
        >
          {answer ? (
            <>
              <span className="font-medium text-success">Answer key</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-xs font-semibold text-white">
                {answer}
              </span>
              <span className="text-[13px] text-muted-foreground">Visible only to you. Never printed.</span>
            </>
          ) : (
            <span className="text-muted-foreground">No correct answer marked yet.</span>
          )}
        </p>
      </section>
      {footer}
    </div>
  );
}

/** Classes for the white question sheet inside the preview. */
export const previewSheetClass =
  "preview-sheet ap-question-format bg-white px-5 py-7 ring-1 ring-[hsl(220_14%_88%)] shadow-[0_1px_2px_hsl(222_30%_12%/0.04),0_18px_40px_-20px_hsl(222_30%_12%/0.18)] sm:px-12 sm:py-12";

/** Arrow-key, Home, and End support for a role="tablist", as screen reader users expect. */
export function handleTabListKeys<T extends string>(values: readonly T[], current: T, select: (value: T) => void) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    const index = values.indexOf(current);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % values.length
        : event.key === "ArrowLeft"
          ? (index - 1 + values.length) % values.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? values.length - 1
              : -1;
    if (next === -1) return;
    event.preventDefault();
    select(values[next]);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };
}

/** Classes for a text tab with an underline, used for the question type and diagram type switches. */
export const underlineTabClass = (selected: boolean) =>
  cn(
    "relative -mb-px flex min-h-11 items-center gap-2 border-b-2 px-0.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
  );
