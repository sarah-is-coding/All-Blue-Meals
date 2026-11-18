// A recipe's notes: a dated log ("doubled the garlic"), newest first. Only
// the recipe's owner can read or change them (RLS through the recipe).

import { supabase } from "../../../lib/supabaseClient";
import type { Tables } from "../../../lib/db/database.types";
import { cleanMissingMultilineText } from "../../../lib/utils/text";
import { MAX_NOTE_LENGTH } from "../constants";
import type { RecipeNote } from "../types";

type RecipeNoteRow = Pick<Tables<"recipe_notes">, "id" | "body" | "created_at" | "updated_at">;

const NOTE_COLUMNS = "id,body,created_at,updated_at";

const mapNoteRow = (row: RecipeNoteRow): RecipeNote => ({
  id: row.id,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Line breaks kept, ends trimmed; throws when there's nothing to save or it's too long. */
const cleanBody = (body: string): string => {
  const cleaned = cleanMissingMultilineText(body);
  if (!cleaned) throw new Error("Write something before saving the note.");
  if (cleaned.length > MAX_NOTE_LENGTH) {
    throw new Error(`Notes can be up to ${MAX_NOTE_LENGTH} characters.`);
  }
  return cleaned;
};

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function listRecipeNotes(recipeId: string): Promise<RecipeNote[]> {
  const { data, error } = await supabase
    .from("recipe_notes")
    .select(NOTE_COLUMNS)
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: false })
    .returns<RecipeNoteRow[]>();
  throwIfError(error);
  return (data ?? []).map(mapNoteRow);
}

export async function addRecipeNote(recipeId: string, body: string): Promise<RecipeNote> {
  const { data, error } = await supabase
    .from("recipe_notes")
    .insert({ recipe_id: recipeId, body: cleanBody(body) })
    .select(NOTE_COLUMNS)
    .single<RecipeNoteRow>();
  throwIfError(error);
  if (!data) throw new Error("Couldn't save the note. Try again.");
  return mapNoteRow(data);
}

export async function updateRecipeNote(noteId: string, body: string): Promise<RecipeNote> {
  const { data, error } = await supabase
    .from("recipe_notes")
    .update({ body: cleanBody(body), updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .select(NOTE_COLUMNS)
    .single<RecipeNoteRow>();
  throwIfError(error);
  if (!data) throw new Error("Couldn't save the note. Try again.");
  return mapNoteRow(data);
}

export async function deleteRecipeNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("recipe_notes").delete().eq("id", noteId);
  throwIfError(error);
}
