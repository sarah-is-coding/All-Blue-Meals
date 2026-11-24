import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePlannedMealsBetween } from "../../features/meal-plans/queries";
import { addDays, createDateFromIso, toIsoDate } from "../../lib/utils/dates";
import HomeMealCard from "../home/HomeMealCard";
import HomeSection from "../home/HomeSection";
import RateMealForm from "../home/RateMealForm";
import { dayLabel, mealsOn, nearestMealDay } from "../home/homeMeals";
import { useHomeReady } from "../home/useHomeReady";

// How far back to look for the last day's meals to rate, and ahead for the next day's.
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 30;

/**
 * Home: today's planned meals and the next day's that has any (with the meat
 * and seafood they use, their tags, and their latest note), and the last day's
 * before today, to rate and leave notes on. One request for the plan: the
 * planned meals from 30 days back to 30 days ahead.
 *
 * `onReady` is called once everything on the page has loaded (see
 * useHomeReady), so the sign-in loading modal can wait for it.
 */
export default function AppHomePage({ onReady }: { onReady?: () => void }) {
  const todayIso = toIsoDate(new Date());
  const startIso = toIsoDate(addDays(createDateFromIso(todayIso), -LOOKBACK_DAYS));
  const endIso = toIsoDate(addDays(createDateFromIso(todayIso), LOOKAHEAD_DAYS));
  const { items, loading, error } = usePlannedMealsBetween(startIso, endIso);
  const today = mealsOn(items, todayIso);
  const nextDay = nearestMealDay(items, todayIso, "next");
  const next = nextDay ? mealsOn(items, nextDay) : [];
  const lastDay = nearestMealDay(items, todayIso, "last");
  const last = lastDay ? mealsOn(items, lastDay) : [];
  const ready = useHomeReady({ planLoading: loading, meals: [...today, ...next, ...last] });

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  if (error) {
    return (
      <section className="workspace-route home">
        <p className="error">{error}</p>
      </section>
    );
  }

  // While the plan loads, each section says so instead of "nothing planned".
  const emptyOr = (message: ReactNode) => (loading ? <p>Loading meals…</p> : message);

  return (
    <section className="workspace-route home">
      <HomeSection
        title="Today's meals"
        headingLevel={1}
        dateLabel={dayLabel(todayIso, todayIso)}
        hasMeals={today.length > 0}
        empty={emptyOr(
          <>
            <p>Nothing planned for today.</p>
            <Link className="btn btn--primary" to="/meal-plans">
              Plan a meal
            </Link>
          </>
        )}
      >
        {today.map((meal) => (
          <HomeMealCard key={meal.id} meal={meal} />
        ))}
      </HomeSection>

      <HomeSection
        title="Next day's meals"
        dateLabel={nextDay ? dayLabel(nextDay, todayIso) : null}
        hasMeals={next.length > 0}
        empty={emptyOr(<p>Nothing planned in the next {LOOKAHEAD_DAYS} days.</p>)}
      >
        {next.map((meal) => (
          <HomeMealCard key={meal.id} meal={meal} />
        ))}
      </HomeSection>

      <HomeSection
        title="Last day's meals"
        dateLabel={lastDay ? dayLabel(lastDay, todayIso) : null}
        hasMeals={last.length > 0}
        empty={emptyOr(
          <p>No meals planned in the last {LOOKBACK_DAYS} days. Once you've cooked one, you can rate it here.</p>
        )}
      >
        {/* Already eaten: no cooking details, but each can be rated and noted
            (a meal whose recipe was deleted has nothing to rate). */}
        {last.map((meal) => (
          <HomeMealCard key={meal.id} meal={meal} showCookingDetails={false}>
            {meal.recipeId ? <RateMealForm meal={meal} /> : null}
          </HomeMealCard>
        ))}
      </HomeSection>
    </section>
  );
}
