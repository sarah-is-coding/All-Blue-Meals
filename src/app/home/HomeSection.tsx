import type { ReactNode } from "react";

type Props = {
  title: string;
  /** The day the section's meals are on ("Today · Mon, Nov 23"), when there's one. */
  dateLabel: string | null;
  /** The page's first section is its h1. */
  headingLevel?: 1 | 2;
  /** The section's HomeMealCards; when there are none, `empty` shows instead. */
  children: ReactNode;
  hasMeals: boolean;
  empty: ReactNode;
};

/**
 * One section of the home page (Today's meals, Next day's meals, Last day's meals), all
 * built the same way: the day, the heading, then the meals as cards, or a
 * message when there are none.
 */
export default function HomeSection({ title, dateLabel, headingLevel = 2, children, hasMeals, empty }: Props) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <article className="workspace-card home-card">
      <header className="home-card__header">
        {dateLabel ? <p className="home-card__eyebrow">{dateLabel}</p> : null}
        <Heading className="home-card__title">{title}</Heading>
      </header>
      {hasMeals ? (
        <ul className="home-meals" aria-label={title}>
          {children}
        </ul>
      ) : (
        <div className="home-card__empty">{empty}</div>
      )}
    </article>
  );
}
