// Turning a recipe's instructions (one text field) into steps to show one by
// one, and finding the cooking cues in a step (times, temperatures, heat) to
// make them easy to spot. Pure, so it's easy to test.

/** "1. ", "2) ", "Step 3: ", "Step 4 - ", "- ", "• ": the marker a step starts with. */
const STEP_MARKER = /^\s*(?:step\s*\d+\s*[.):-]?|\d+\s*[.)]|[-•*])\s+/i;

/**
 * The steps in `instructions`, without their "1." / "Step 1:" markers.
 * - When lines start with a marker, each marked line starts a step, and an
 *   unmarked line belongs to the step before it (a wrapped or extra line).
 * - Otherwise, paragraphs (separated by a blank line) are steps; with no
 *   blank lines, each line is.
 */
export function parseSteps(instructions: string): string[] {
  const text = instructions.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");

  if (lines.some((line) => STEP_MARKER.test(line))) {
    const steps: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (STEP_MARKER.test(line) || steps.length === 0) {
        steps.push(trimmed.replace(STEP_MARKER, "").trim());
      } else {
        steps[steps.length - 1] = `${steps[steps.length - 1]}\n${trimmed}`;
      }
    }
    return steps.filter(Boolean);
  }

  const paragraphs = /\n\s*\n/.test(text) ? text.split(/\n\s*\n/) : lines;
  return paragraphs.map((part) => part.trim()).filter(Boolean);
}

export type StepPart = { text: string; cue: boolean };

const NUMBER = String.raw`\d+(?:[.,]\d+)?(?:\s+\d\/\d|\/\d)?|[½¼¾⅓⅔]|\d+[½¼¾⅓⅔]`;
const RANGE = String.raw`(?:${NUMBER})(?:\s*(?:-|–|to|or)\s*(?:${NUMBER}))?`;

// Times ("20 minutes", "1 1/2 hours", "5-7 min", "30 sec"), temperatures
// ("350°F", "180 °C", "400 degrees", "425 degrees F", "350F"), heat levels
// ("medium-high heat", "low heat"), and "overnight".
const CUES = new RegExp(
  [
    String.raw`(?:${RANGE})\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\b`,
    String.raw`(?:${RANGE})\s*(?:°\s*[FC]?|degrees?(?:\s*(?:F|C|fahrenheit|celsius)\b)?)`,
    // No degree sign: only three digits then F or C on its own ("350F", "200 C").
    String.raw`\b\d{3}\s?[FC]\b`,
    String.raw`\b(?:medium[- ]high|medium[- ]low|high|medium|low)\s+heat\b`,
    String.raw`\bovernight\b`,
  ].join("|"),
  "gi"
);

/** `step` split into plain text and cues (times, temperatures, heat), in order. */
export function splitCookingCues(step: string): StepPart[] {
  const parts: StepPart[] = [];
  let last = 0;
  for (const match of step.matchAll(CUES)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: step.slice(last, start), cue: false });
    parts.push({ text: match[0], cue: true });
    last = start + match[0].length;
  }
  if (last < step.length) parts.push({ text: step.slice(last), cue: false });
  return parts;
}
