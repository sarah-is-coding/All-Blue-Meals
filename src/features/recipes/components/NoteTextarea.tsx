import { useEffect, useRef } from "react";
import { MAX_NOTE_LENGTH } from "../constants";

type NoteTextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** While saving: the text can't change, but focus stays (so you can keep writing). */
  busy?: boolean;
  autoFocus?: boolean;
  /** Esc, e.g. to cancel an edit. */
  onEscape?: () => void;
  /** What Ctrl/⌘ + Enter does, for the hint ("save", "add"). */
  submitVerb?: string;
};

// The counter only appears near the limit, so it isn't noise.
const COUNTER_FROM = MAX_NOTE_LENGTH - 200;

/**
 * The text box for writing a note, inside the note's form: it grows with
 * its text (CSS field-sizing), Ctrl/⌘ + Enter submits the form, Esc calls
 * onEscape, and a character count appears near the limit.
 */
export default function NoteTextarea({
  label,
  value,
  onChange,
  placeholder,
  busy = false,
  autoFocus = false,
  onEscape,
  submitVerb = "save",
}: NoteTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Editing starts with the cursor after the existing text.
  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    const end = ref.current.value.length;
    ref.current.focus();
    ref.current.setSelectionRange(end, end);
  }, [autoFocus]);

  return (
    <div className="note-textarea">
      <textarea
        ref={ref}
        className="note-textarea__field"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        readOnly={busy}
        aria-busy={busy}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (value.trim() && !busy) event.currentTarget.form?.requestSubmit();
          } else if (event.key === "Escape" && onEscape) {
            event.preventDefault();
            onEscape();
          }
        }}
      />
      <div className="note-textarea__footer">
        <span className="note-textarea__hint">Ctrl/⌘ + Enter to {submitVerb}</span>
        {value.length >= COUNTER_FROM ? (
          <span className="note-textarea__count" aria-live="polite">
            {value.length.toLocaleString("en-US")} / {MAX_NOTE_LENGTH.toLocaleString("en-US")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
