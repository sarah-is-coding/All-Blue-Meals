import AdSlot from "../ads/AdSlot";
import { useLoadingGate } from "./useLoadingGate";

type LoadingModalProps = {
  /** Whether work is in progress. The modal itself decides when to appear:
   *  it stays hidden for quick work and, once shown, stays up briefly so it
   *  doesn't flicker. Keep it mounted and toggle `open` rather than mounting
   *  it only while loading, or the minimum display time can't apply. */
  open: boolean;
  title?: string;
  message?: string;
};

export default function LoadingModal({
  open,
  title = "Working on your request...",
  message = "Please wait a moment.",
}: LoadingModalProps) {
  const visible = useLoadingGate(open);

  if (!visible) {
    return null;
  }

  return (
    <div className="loading-modal" role="alertdialog" aria-modal="true" aria-live="assertive">
      <div className="loading-modal__backdrop" />
      <div className="loading-modal__panel">
        <div className="loading-modal__spinner" aria-hidden="true" />
        <h2>{title}</h2>
        <p>{message}</p>
        <AdSlot
          size="rectangle"
          label="Sponsored"
          className="loading-modal__ad loading-modal__ad--desktop"
          interactive={false}
        />
        <AdSlot
          size="banner"
          label="Sponsored"
          className="loading-modal__ad loading-modal__ad--mobile"
          interactive={false}
        />
      </div>
    </div>
  );
}
