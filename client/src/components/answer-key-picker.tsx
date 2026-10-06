import { Check, EyeOff } from "lucide-react";
import { ANSWER_LETTERS, type AnswerLetter } from "@/lib/question-html";

/** Lets the teacher mark the correct choice. Clicking the chosen letter again clears it.
 *  This never appears on the student copy. */
export function AnswerKeyPicker({
  value,
  onChange,
}: {
  value: AnswerLetter | "";
  onChange: (value: AnswerLetter | "") => void;
}) {
  return (
    <div className="border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id="answer-key-label" className="flex items-center gap-2 text-sm font-medium">
          <Check className="h-4 w-4 text-success" aria-hidden="true" />
          Correct answer
        </span>
        <div className="flex gap-1.5" role="radiogroup" aria-labelledby="answer-key-label">
          {ANSWER_LETTERS.map((letter) => {
            const selected = value === letter;
            return (
              <button
                key={letter}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(selected ? "" : letter)}
                className={`h-9 w-9 rounded-full border text-sm font-semibold transition-[color,background-color,border-color,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selected
                    ? "border-success bg-success text-white"
                    : "border-input bg-card text-foreground hover:border-success hover:bg-success-soft"
                }`}
                data-testid={`answer-${letter.toLowerCase()}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>
      <p className="field-hint mt-2 flex gap-1.5">
        <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          For your eyes only. It is never printed, and it is added to an export only if you check
          "Include answer key."
        </span>
      </p>
    </div>
  );
}
