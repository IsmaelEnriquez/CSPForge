// Helpers for turning a question into HTML: the formatting tips (**bold** and
// bullet points), the stand-alone HTML file used by Export and Copy, and the
// file download itself.

export type AnswerLetter = "A" | "B" | "C" | "D";
export const ANSWER_LETTERS: AnswerLetter[] = ["A", "B", "C", "D"];

/** Makes text safe to put inside HTML, so typing "<" shows a "<". */
export const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Applies the formatting tips shown in the editor:
 *  **text** gets a grey highlight, and lines starting with * or - become bullets. */
export const formatQuestionText = (text: string) => {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => {
      const highlighted = escapeHtml(line).replace(
        /\*\*(.+?)\*\*/g,
        '<span class="highlight">$1</span>',
      );
      const trimmed = line.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        return `<div class="bullet-point">• ${highlighted.trim().slice(2)}</div>`;
      }
      if (trimmed) return `<div>${highlighted}</div>`;
      return '<div class="line-spacer"></div>';
    })
    .join("");
};

const QUESTION_STYLES = `
  body { margin: 0; background: white; color: #111; }
  .ap-question-format { font-family: "Times New Roman", serif; line-height: 1.4; max-width: 800px; margin: 0 auto; padding: 20px; }
  .ap-code-segment { border: 1px solid #d9dce1; border-radius: 6px; padding: 14px 16px; margin: 16px auto; max-width: 400px; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.4; background: #f6f7f9; white-space: pre-wrap; overflow-wrap: anywhere; }
  .ap-code-image-segment { max-width: 100%; border: 0; border-radius: 0; padding: 0; background: none; }
  .ap-code-image { display: block; max-width: 100%; height: auto; margin: 0 auto; }
  .flowchart-diagram { display: block; width: 100%; height: auto; }
  .ap-choice { border: 2px solid #000; border-radius: 20px; padding: 8px 16px; margin: 8px 0; font-family: "Times New Roman", serif; font-size: 14px; display: flex; align-items: flex-start; background: white; }
  .ap-choice-letter { font-weight: bold; margin-right: 12px; min-width: 20px; flex-shrink: 0; }
  .ap-choice-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.4; flex: 1; }
  .highlight { background-color: #e5e5e5; color: #000; padding: 1px 2px; }
  .bullet-point { margin-left: 20px; margin-bottom: 2px; }
  div:not(.bullet-point) + .bullet-point { margin-top: 8px; }
  .line-spacer { height: 0.5em; }
  .answer-key { font-family: "Times New Roman", serif; max-width: 800px; margin: 24px auto 0; padding: 12px 20px; border-top: 1px dashed #999; }
`;

/** Builds a complete HTML page around the question preview.
 *  The answer key is added at the bottom only when one is given. */
export const buildQuestionDocument = (previewHtml: string, answer?: AnswerLetter | "") => {
  const answerKey = answer
    ? `\n  <div class="answer-key"><strong>Answer key:</strong> ${answer}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AP CSP-style Question</title>
  <style>${QUESTION_STYLES}</style>
</head>
<body>
  ${previewHtml}${answerKey}
</body>
</html>`;
};

export const downloadHtmlFile = (html: string, fileName: string) => {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
