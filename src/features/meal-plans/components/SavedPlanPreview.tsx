import { useSavedPlanPreview } from "../queries";
import MealPreviewDays from "./MealPreviewDays";

/** The meals in a saved plan, by day, with loading, error and empty states. */
export default function SavedPlanPreview({ planId }: { planId: string }) {
  const { preview, loading, error } = useSavedPlanPreview(planId);

  if (error) return <p className="error">{error}</p>;
  if (loading) return <p className="plan-browser__status">Loading preview…</p>;
  if (preview.length === 0) return <p className="plan-browser__status">No meals in this plan.</p>;
  return <MealPreviewDays preview={preview} compact />;
}
