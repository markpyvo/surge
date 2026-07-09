"use client";

import { useState } from "react";
import { Button, Spinner } from "@heroui/react";
import ProgressRing from "./ProgressRing";
import type { DayLog, Macros } from "@/lib/store";

type Props = {
  targets: Macros;
  eaten: Macros;
  burned: number;
  day: DayLog;
  onLogFood: () => void;
  onLogActivity: () => void;
  onRemoveFood: (id: string) => void;
  onRemoveActivity: (id: string) => void;
  onRefine: (kind: "food" | "activity", id: string) => void;
  onEditRing: (metric: keyof Macros) => void;
  onShareCard: () => void;
  adjusted?: boolean;
  onResetAdjust: () => void;
  readOnly?: boolean; // viewing a past day
  dateLabel?: string;
  onBack?: () => void;
};

const MACROS: { key: "protein" | "carbs" | "fat"; label: string; color: string }[] = [
  { key: "protein", label: "Protein", color: "var(--ring-protein)" },
  { key: "carbs", label: "Carbs", color: "var(--ring-carbs)" },
  { key: "fat", label: "Fat", color: "var(--ring-fat)" },
];

export default function Dashboard({
  targets,
  eaten,
  burned,
  day,
  onLogFood,
  onLogActivity,
  onRemoveFood,
  onRemoveActivity,
  onRefine,
  onEditRing,
  onShareCard,
  adjusted = false,
  onResetAdjust,
  readOnly = false,
  dateLabel,
  onBack,
}: Props) {
  const base = targets.calories;
  const fullGoal = base + burned;
  const over = eaten.calories - fullGoal;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const feed = [
    ...day.entries.map((e) => ({ kind: "food" as const, time: e.time, e })),
    ...day.activities.map((a) => ({ kind: "activity" as const, time: a.time, a })),
  ].sort((x, y) => y.time - x.time);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5">
      {readOnly && dateLabel && (
        <div
          className="mb-1 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "var(--aqua-tint)", color: "var(--teal-deep)" }}
        >
          📅 Viewing {dateLabel}
        </div>
      )}

      {/* Hero calorie ring */}
      <div className="relative mt-3 flex flex-col items-center">
        <ProgressRing
          size={216}
          stroke={18}
          value={eaten.calories}
          max={fullGoal}
          fill="var(--ring-fill)"
          centerValue={eaten.calories}
          centerSuffix={`of ${fullGoal.toLocaleString()} kcal`}
          onEdit={readOnly ? undefined : () => onEditRing("calories")}
        />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <span className="text-[var(--ink-muted)]">
            {base.toLocaleString()} base
          </span>
          {burned > 0 && (
            <span className="font-medium" style={{ color: "var(--coral)" }}>
              🔥 +{burned.toLocaleString()} earned
            </span>
          )}
          {over > 0 && (
            <span className="font-semibold" style={{ color: "var(--coral)" }}>
              {over.toLocaleString()} over
            </span>
          )}
        </div>
      </div>

      {/* Macro rings */}
      <div className="mt-9 grid w-full grid-cols-3 gap-3">
        {MACROS.map((m) => (
          <ProgressRing
            key={m.key}
            size={94}
            stroke={9}
            value={eaten[m.key]}
            max={targets[m.key]}
            fill={m.color}
            label={m.label}
            caption={`${eaten[m.key]} / ${targets[m.key]} g`}
            centerSuffix="g"
            onEdit={readOnly ? undefined : () => onEditRing(m.key)}
          />
        ))}
      </div>

      {/* Share the day as a collectible card */}
      <button
        onClick={onShareCard}
        className="glass mt-8 flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold transition-transform active:scale-[0.98]"
        style={{ color: "var(--teal-deep)" }}
      >
        <span aria-hidden>🎴</span>
        {readOnly ? "Share this day's card" : "Share today's card"}
      </button>

      {/* Today's log */}
      <div className="mt-10 w-full">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--ink-muted)]">
            {readOnly ? "Entries" : "Today"}
          </h3>
          {feed.length > 0 && (
            <span className="text-xs text-[var(--ink-muted)]">{feed.length} entries</span>
          )}
        </div>

        {adjusted && !readOnly && (
          <button
            onClick={onResetAdjust}
            className="glass mb-2 flex w-full items-center justify-between rounded-[20px] px-4 py-2.5 text-left"
          >
            <span className="text-sm text-[var(--ink-muted)]">
              ✎ Rings manually adjusted
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--aqua)" }}>
              Reset
            </span>
          </button>
        )}

        {feed.length === 0 ? (
          <div className="glass rounded-[20px] px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
            Nothing logged yet. Tap <b>Log food</b> or <b>Log activity</b> below.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {feed.map((row) => {
              const isFood = row.kind === "food";
              const id = isFood ? row.e.id : row.a.id;
              const pending = isFood ? row.e.pending : row.a.pending;
              const isOpen = expanded.has(id);
              const explanation = isFood ? row.e.explanation : row.a.explanation;
              return (
                <li
                  key={id}
                  className="glass overflow-hidden rounded-[20px]"
                  style={
                    isFood
                      ? undefined
                      : { borderColor: "color-mix(in srgb, var(--coral) 30%, var(--line))" }
                  }
                >
                  {/* Header row (tap to expand) */}
                  <button
                    onClick={() => !pending && toggle(id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {!isFood && <span className="mr-1">🔥</span>}
                        {isFood ? row.e.text : row.a.text}
                      </div>
                      {pending ? (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-muted)] tide-pulse">
                          <Spinner size="sm" /> Estimating…
                        </div>
                      ) : isFood ? (
                        <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                          {row.e.totals.calories} kcal · {row.e.totals.protein}p ·{" "}
                          {row.e.totals.carbs}c · {row.e.totals.fat}f
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs" style={{ color: "var(--coral)" }}>
                          +{row.a.caloriesBurned} kcal earned
                        </div>
                      )}
                    </div>
                    {!pending && (
                      <span
                        className="mt-0.5 shrink-0 text-[var(--ink-muted)] transition-transform"
                        style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                        aria-hidden
                      >
                        ⌄
                      </span>
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && !pending && (
                    <div className="border-t border-[var(--line)] px-4 py-3">
                      <p className="text-sm leading-relaxed text-[var(--ink)]">
                        {explanation || "No explanation was recorded for this entry."}
                      </p>

                      {isFood && row.e.items.length > 1 && (
                        <ul className="mt-2.5 flex flex-col gap-1">
                          {row.e.items.map((it, i) => (
                            <li key={i} className="flex justify-between text-xs text-[var(--ink-muted)]">
                              <span className="truncate pr-2">{it.name}</span>
                              <span className="shrink-0 tabular-nums">
                                {it.calories} kcal · {it.protein}p · {it.carbs}c · {it.fat}f
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {!readOnly && (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => onRefine(row.kind, id)}
                          >
                            💬 Not quite? Tell it more
                          </Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            onPress={() => (isFood ? onRemoveFood(id) : onRemoveActivity(id))}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="h-28" />

      {/* Sticky action bar: Food (left) / Activity (right) */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t px-5 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 78%, transparent)" }}
      >
        <div className="mx-auto flex w-full max-w-md gap-3">
          {readOnly ? (
            <Button variant="primary" size="lg" fullWidth onPress={onBack}>
              ← Back to today
            </Button>
          ) : (
            <>
              <Button variant="primary" size="lg" fullWidth onPress={onLogFood}>
                🍽️ Log food
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onPress={onLogActivity}
                style={{ borderColor: "var(--coral)", color: "var(--coral)" }}
              >
                🏄 Log activity
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
