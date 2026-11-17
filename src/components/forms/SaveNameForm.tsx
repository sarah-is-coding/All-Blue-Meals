import { useEffect, useRef, useState } from "react";

type Props = {
  placeholder: string;
  initialName?: string;
  /** Save under the (trimmed) name; throw to show the error under the form. */
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
  /** Shown when `onSave` throws something that isn't an Error. */
  errorFallback?: string;
  /** Extra class for the wrapper, for a page-specific look. */
  className?: string;
};

/**
 * "Name it and save": a name field with Cancel and Save. Enter saves, Escape
 * cancels, and the field is focused when the form opens.
 */
export default function SaveNameForm({
  placeholder,
  initialName = "",
  onSave,
  onCancel,
  errorFallback = "Failed to save.",
  className,
}: Props) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorFallback);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`save-name-form${className ? ` ${className}` : ""}`}>
      <input
        ref={inputRef}
        type="text"
        className="save-name-form__input"
        placeholder={placeholder}
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSave();
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="save-name-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
