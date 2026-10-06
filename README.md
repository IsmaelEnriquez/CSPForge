# CSPForge

**Build AP® CSP-style multiple-choice, flowchart, and logic gate questions. Free for teachers.**

CSPForge is a free web tool for AP Computer Science Principles teachers. Type a question, a Boolean expression, or a few lines of AP pseudocode, and CSPForge draws it in the style students see on the exam. Then print it or export it.

Everything runs in your browser. There are no accounts, and your questions are never sent anywhere.

## What it does

- **Multiple-choice questions** with a code segment (typed, or pasted as an image), formatting tips such as **bold highlights** and bullet points, and four answer choices.
- **Logic gate diagrams from a Boolean expression.** Type `NOT (A AND B) AND C` and get the circuit: input circles on top, AND/OR/NOT gates below them, and the output at the bottom.
- **Flowcharts from AP pseudocode.** Type `IF`/`ELSE` blocks and regular steps, and get diamonds, rectangles, labeled true/false arrows, and Start/End ovals.
- **Answer key.** Mark the correct choice. It shows on screen for you, is never printed, and is added to an export only when you ask for it.
- **Print and export.** Print only the question, or download it as an HTML file.
- **Fine-tune by hand.** Drag shapes in the preview, or edit shapes and arrows directly.

## How to write diagrams

### Logic gates

| You type | You get |
|---|---|
| `A OR B` | one OR gate |
| `(A AND B) OR C` | an AND gate feeding an OR gate with C |
| `NOT (A AND B) AND C` | AND, then NOT, then a final AND with C |
| `(A OR B) AND (C OR D)` | two OR gates side by side feeding one AND |
| `NOT A AND true` | inputs can also be `true` or `false` |

`NOT` applies only to what comes right after it, so `NOT A AND B` means `(NOT A) AND B`. After that, `AND` comes before `OR`. Use parentheses to group things.

### Flowcharts

Write AP pseudocode. Use `{ }` like the AP reference sheet, or just indent:

```
IF (grade ≥ 90)
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
}
```

- `IF` becomes a diamond. The **true** arrow goes down and the **false** arrow goes right.
- Every other line becomes a rectangle, exactly as you typed it.
- `ELSE IF` works.
- Start and End are added for you.
- You can type `<-` for `←`, `>=` for `≥`, `<=` for `≤`, and `!=` for `≠`.
- Loops (`REPEAT`, `FOR EACH`) are not supported yet.

If something is wrong, CSPForge tells you which line to fix and keeps showing the last diagram that worked.

## Run it on your computer

You need [Node.js](https://nodejs.org) (the LTS version) and a code editor such as VS Code. These steps work on Windows, Mac, and Linux.

```
npm install
npm run dev
```

Then open the address it prints, usually http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site on your computer. Changes show up as you save. |
| `npm test` | Runs the tests for the logic gate and flowchart parsers. |
| `npm run build` | Builds the finished site into the `dist` folder. |
| `npm run check` | Checks the TypeScript code for type errors. |


## How the code is organized

```
client/
  index.html                        page shell
  src/
    main.tsx, App.tsx               starts the app
    pages/
      question-creator.tsx          header, multiple-choice builder, export, footer
      flowchart-question-creator.tsx  flowchart and logic gate builder
    components/
      flowchart-diagram.tsx         draws a diagram as SVG and handles dragging
      answer-key-picker.tsx         the A–D correct-answer picker
      ui/                           buttons, cards, and other basic pieces (shadcn/ui)
    lib/
      logic-expression.ts           reads Boolean expressions and lays out the circuit
      pseudocode-flowchart.ts       reads AP pseudocode and lays out the flowchart
      flowchart-model.ts            shared shapes, sizes, and error type
      question-html.ts              formatting, safe HTML, and export files
      *.test.ts                     tests
```

Built with React, TypeScript, Vite, and Tailwind CSS.

## Acknowledgments

CSPForge was inspired by [APML](https://bakerfranke.github.io/apml/) by Baker Franke.

## License

CSPForge © 2026 Ismael Enriquez, licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). You may share and adapt it for non-commercial use, with credit, under the same license. See [LICENSE](LICENSE).

CSPForge is provided as is. Teachers are responsible for reviewing questions before use.

AP® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this project.
