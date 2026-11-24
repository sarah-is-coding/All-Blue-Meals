import { parseSteps, splitCookingCues } from "../../../../features/recipes/utils/recipeSteps";

describe("parseSteps", () => {
  it("splits numbered steps and drops their numbers", () => {
    expect(parseSteps("1. Preheat the oven.\n2. Mix the dough.\n3) Bake.")).toEqual([
      "Preheat the oven.",
      "Mix the dough.",
      "Bake.",
    ]);
  });

  it("reads 'Step N' and bullet markers too", () => {
    expect(parseSteps("Step 1: Chop.\nStep 2 - Fry.\nSTEP 3. Serve.")).toEqual(["Chop.", "Fry.", "Serve."]);
    expect(parseSteps("- Chop.\n• Fry.\n* Serve.")).toEqual(["Chop.", "Fry.", "Serve."]);
  });

  it("keeps an unnumbered line with the step before it", () => {
    expect(parseSteps("1. Make the sauce.\nStir often so it doesn't burn.\n2. Toss with pasta.")).toEqual([
      "Make the sauce.\nStir often so it doesn't burn.",
      "Toss with pasta.",
    ]);
  });

  it("keeps a first line that has no number as its own step", () => {
    expect(parseSteps("Before you start, soak the skewers.\n1. Grill.")).toEqual([
      "Before you start, soak the skewers.",
      "Grill.",
    ]);
  });

  it("ignores blank lines and Windows line endings between numbered steps", () => {
    expect(parseSteps("1. Chop.\r\n\r\n2. Fry.\r\n")).toEqual(["Chop.", "Fry."]);
  });

  it("doesn't take a number that's part of the step for a marker", () => {
    expect(parseSteps("1. Add 2 cups of flour.\n2. 350°F for 20 minutes.")).toEqual([
      "Add 2 cups of flour.",
      "350°F for 20 minutes.",
    ]);
  });

  it("uses paragraphs, or else lines, when nothing is numbered", () => {
    expect(parseSteps("Chop the onion\nand the garlic.\n\nFry them.")).toEqual([
      "Chop the onion\nand the garlic.",
      "Fry them.",
    ]);
    expect(parseSteps("Chop.\nFry.")).toEqual(["Chop.", "Fry."]);
  });

  it("is empty for empty or blank instructions", () => {
    expect(parseSteps("")).toEqual([]);
    expect(parseSteps("   \n  ")).toEqual([]);
  });
});

const cues = (step: string) => splitCookingCues(step).filter((part) => part.cue).map((part) => part.text);

describe("splitCookingCues", () => {
  it("finds times, including ranges and fractions", () => {
    expect(cues("Simmer 20 minutes, then rest 5-7 min.")).toEqual(["20 minutes", "5-7 min"]);
    expect(cues("Roast 1 1/2 hours, or 1½ hrs on convection.")).toEqual(["1 1/2 hours", "1½ hrs"]);
    expect(cues("Sear 30 seconds per side, 2 to 3 minutes total.")).toEqual(["30 seconds", "2 to 3 minutes"]);
  });

  it("finds temperatures and heat levels", () => {
    expect(cues("Preheat to 350°F (180 °C).")).toEqual(["350°F", "180 °C"]);
    expect(cues("Bake at 400 degrees, or 425 degrees F for crispier.")).toEqual(["400 degrees", "425 degrees F"]);
    expect(cues("Cook over medium-high heat, then low heat.")).toEqual(["medium-high heat", "low heat"]);
  });

  it("finds temperatures written without a degree sign", () => {
    expect(cues("Bake at 350F, or 180 C.")).toEqual(["350F", "180 C"]);
    // Not a temperature: too few digits, or a letter that's part of a word.
    expect(cues("Add 2 C of stock and 350 Fresh basil leaves.")).toEqual([]);
  });

  it("finds overnight", () => {
    expect(cues("Marinate overnight in the fridge.")).toEqual(["overnight"]);
  });

  it("leaves plain amounts alone", () => {
    expect(cues("Add 2 cups of flour and 3 eggs.")).toEqual([]);
    expect(cues("Add a minute amount of salt.")).toEqual([]);
  });

  it("keeps every character, in order", () => {
    const step = "Bake at 350°F for 20 minutes.";
    const parts = splitCookingCues(step);
    expect(parts.map((part) => part.text).join("")).toBe(step);
    expect(parts).toEqual([
      { text: "Bake at ", cue: false },
      { text: "350°F", cue: true },
      { text: " for ", cue: false },
      { text: "20 minutes", cue: true },
      { text: ".", cue: false },
    ]);
  });

  it("is one plain part when there are no cues, and nothing for an empty step", () => {
    expect(splitCookingCues("Serve.")).toEqual([{ text: "Serve.", cue: false }]);
    expect(splitCookingCues("")).toEqual([]);
  });
});
