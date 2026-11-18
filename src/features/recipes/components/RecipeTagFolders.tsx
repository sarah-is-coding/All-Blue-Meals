import type { RecipeTagFolder } from "../utils/recipeTagFolders";

type RecipeTagFoldersProps = {
  folders: RecipeTagFolder[];
  loading: boolean;
  error: string | null;
  /** True when the search box narrowed the folders down to none. */
  filtered: boolean;
  onOpen: (folder: RecipeTagFolder) => void;
};

/** The "Tag folders" view: a folder per tag; opening one shows its recipes. */
export default function RecipeTagFolders({ folders, loading, error, filtered, onOpen }: RecipeTagFoldersProps) {
  if (error) {
    return (
      <article className="workspace-card">
        <p className="error">{error}</p>
      </article>
    );
  }
  if (loading) {
    return (
      <article className="workspace-card">
        <p>Loading tags...</p>
      </article>
    );
  }
  if (folders.length === 0) {
    return (
      <article className="workspace-card">
        <h2>{filtered ? "No tags match" : "No tags yet"}</h2>
        <p>{filtered ? "Try a different search." : "Tags you add to recipes show up here as folders."}</p>
      </article>
    );
  }

  return (
    <ul className="recipe-tag-folders" aria-label="Tag folders">
      {folders.map((folder) => (
        <li key={folder.key}>
          <button type="button" className="recipe-tag-folder" onClick={() => onOpen(folder)}>
            <span className="recipe-tag-folder__icon" aria-hidden="true">
              📁
            </span>
            <span className="recipe-tag-folder__name">{folder.label}</span>
            <span className="recipe-tag-folder__count">
              {folder.count === 1 ? "1 recipe" : `${folder.count} recipes`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
