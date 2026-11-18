import {
  addRecipeNote,
  deleteRecipeNote,
  listRecipeNotes,
  updateRecipeNote,
} from "../../../features/recipes/api";

vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "select", "insert", "update", "delete", "eq", "order"]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.returns = vi.fn().mockResolvedValue({ data: [], error: null });
  builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  return { supabase: builder };
});

import { supabase } from "../../../lib/supabaseClient";

const db = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;
const CHAINED = ["from", "select", "insert", "update", "delete", "eq", "order"];

const ROW = {
  id: "n1",
  body: "Doubled the garlic.\nNeeded 10 more minutes.",
  created_at: "2026-11-03T18:20:00Z",
  updated_at: "2026-11-03T18:20:00Z",
};
const NOTE = {
  id: "n1",
  body: "Doubled the garlic.\nNeeded 10 more minutes.",
  createdAt: "2026-11-03T18:20:00Z",
  updatedAt: "2026-11-03T18:20:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of CHAINED) db[method].mockReturnValue(db);
  db.returns.mockResolvedValue({ data: [], error: null });
  db.single.mockResolvedValue({ data: ROW, error: null });
});

describe("listRecipeNotes", () => {
  it("loads a recipe's notes newest first and maps them", async () => {
    db.returns.mockResolvedValueOnce({ data: [ROW], error: null });

    expect(await listRecipeNotes("r1")).toEqual([NOTE]);
    expect(db.from).toHaveBeenCalledWith("recipe_notes");
    expect(db.select).toHaveBeenCalledWith("id,body,created_at,updated_at");
    expect(db.eq).toHaveBeenCalledWith("recipe_id", "r1");
    expect(db.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("throws on an error", async () => {
    db.returns.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    await expect(listRecipeNotes("r1")).rejects.toThrow("nope");
  });
});

describe("addRecipeNote", () => {
  it("saves the trimmed note, keeping its line breaks", async () => {
    expect(await addRecipeNote("r1", "  Doubled the garlic.\r\nNeeded 10 more minutes.  ")).toEqual(NOTE);
    expect(db.insert).toHaveBeenCalledWith({
      recipe_id: "r1",
      body: "Doubled the garlic.\nNeeded 10 more minutes.",
    });
  });

  it("refuses an empty note without calling the database", async () => {
    await expect(addRecipeNote("r1", "   \n ")).rejects.toThrow("Write something before saving the note.");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("refuses a note over 2000 characters", async () => {
    await expect(addRecipeNote("r1", "a".repeat(2001))).rejects.toThrow("Notes can be up to 2000 characters.");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws on an error", async () => {
    db.single.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(addRecipeNote("r1", "Good")).rejects.toThrow("denied");
  });
});

describe("updateRecipeNote", () => {
  it("saves the new text and when it changed", async () => {
    await updateRecipeNote("n1", "Less salt next time");
    expect(db.update).toHaveBeenCalledWith({ body: "Less salt next time", updated_at: expect.any(String) });
    expect(db.eq).toHaveBeenCalledWith("id", "n1");
  });

  it("refuses an empty note", async () => {
    await expect(updateRecipeNote("n1", "")).rejects.toThrow("Write something before saving the note.");
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("deleteRecipeNote", () => {
  it("deletes the note by id", async () => {
    db.eq.mockResolvedValueOnce({ data: null, error: null });
    await deleteRecipeNote("n1");
    expect(db.delete).toHaveBeenCalled();
    expect(db.eq).toHaveBeenCalledWith("id", "n1");
  });

  it("throws on an error", async () => {
    db.eq.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(deleteRecipeNote("n1")).rejects.toThrow("denied");
  });
});
