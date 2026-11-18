import { useSavedPlanPreview } from "../queries";
import MealPreviewDays from "./MealPreviewDays";

type Props = {
  planId: string;
  showLoading?: boolean;
};

/** The meals in a saved plan, by day. */
export default function SavedPlanPreview({ planId, showLoading = true }: Props) {
  const { preview, loading, error } = useSavedPlanPreview(planId);
  if (loading && !showLoading) return null;

  let content;
  if (error) {
    content = <p className="error">{error}</p>;
  } else if (loading) {
    content = <p className="plan-browser__status">Loading preview…</p>;
  } else if (preview.length === 0) {
    content = <p className="plan-browser__status">No meals in this plan.</p>;
  } else {
    content = <MealPreviewDays preview={preview} compact />;
  }

  return <div className="saved-plan-list__detail">{content}</div>;
}
