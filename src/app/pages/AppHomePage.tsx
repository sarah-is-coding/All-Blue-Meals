import { Link } from "react-router-dom";
import { usePlannedMealsBetween } from "../../features/meal-plans/queries";
import { addDays, createDateFromIso, toIsoDate } from "../../lib/utils/dates";
import LastMealCard from "../home/LastMealCard";
import TodayMealCard from "../home/TodayMealCard";
import { lastMealBefore, todaysMeals } from "../home/homeMeals";

// How far back to look for the last meal to rate.
const LOOKBACK_DAYS = 30;

const todayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

/**
 * Home: today's planned meals (with the meat and seafood they use), and the
 * last meal before today to rate and leave a note on. One request: the
 * planned meals from the last 30 days through today.
 */
export default function AppHomePage() {
  const todayIso = toIsoDate(new Date());
  const startIso = toIsoDate(addDays(createDateFromIso(todayIso), -LOOKBACK_DAYS));
  const { items, loading, error } = usePlannedMealsBetween(startIso, todayIso);
  const today = todaysMeals(items, todayIso);
  const lastMeal = lastMealBefore(items, todayIso);

  return (
    <section className="workspace-route home">
      <article className="workspace-card home-card">
        <div className="home-card__header">
          <div>
            <p className="home-card__eyebrow">{todayFormatter.format(createDateFromIso(todayIso))}</p>
            <h1>Today's meals</h1>
          </div>
          <Link className="btn btn--ghost" to="/app/meal-plans">
            Open planner
          </Link>
        </div>

        {error ? (
          <p className="error">{error}</p>
        ) : loading ? (
          <p className="home-card__empty">Loading today's meals…</p>
        ) : today.length === 0 ? (
          <div className="home-card__empty">
            <p>Nothing planned for today.</p>
            <Link className="btn btn--primary" to="/app/meal-plans">
              Plan a meal
            </Link>
          </div>
        ) : (
          <ul className="home-meals">
            {today.map((meal) => (
              <TodayMealCard key={meal.id} meal={meal} />
            ))}
          </ul>
        )}
      </article>

      {!loading && !error ? (
        <article className="workspace-card home-card">
          <h2>Last meal</h2>
          {lastMeal ? (
            <LastMealCard meal={lastMeal} todayIso={todayIso} />
          ) : (
            <p className="home-card__empty">
              No meals planned in the last {LOOKBACK_DAYS} days. Once you've cooked one, you can rate it here.
            </p>
          )}
        </article>
      ) : null}
    </section>
  );
}
