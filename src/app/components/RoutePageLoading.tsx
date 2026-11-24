/**
 * Shown in the page area while a page's code loads, which only happens when
 * a page is opened straight from a link (moving between pages keeps the
 * current page up instead). Most loads finish before it would be noticed, so
 * it fades in only after the same ~280 ms LoadingModal waits (in CSS, so
 * there's no timer here).
 */
export default function RoutePageLoading() {
  return (
    <section className="workspace-route route-page-loading" role="status" aria-live="polite">
      <p className="route-page-loading__text">Loading…</p>
    </section>
  );
}
