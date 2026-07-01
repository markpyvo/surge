"use client";

import type { DaySummary } from "@/lib/store";
import { todayKey } from "@/lib/store";

type Props = {
  days: DaySummary[];
  activeDate: string;
  onSelect: (date: string) => void;
};

function labelFor(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function Calendar({ days, activeDate, onSelect }: Props) {
  const today = todayKey();

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-1 pb-10">
      <h2 className="mb-1 text-base font-semibold">History</h2>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        Tap a day to open its dashboard.
      </p>

      {days.length === 0 ? (
        <div className="glass rounded-[20px] px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
          No days logged yet. Start logging on the dashboard.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {days.map((d) => {
            const isActive = d.date === activeDate;
            return (
              <li key={d.date}>
                <button
                  onClick={() => onSelect(d.date)}
                  className="glass flex w-full items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-left transition-transform active:scale-[0.99]"
                  style={
                    isActive ? { borderColor: "var(--aqua)", boxShadow: "0 0 0 1px var(--aqua)" } : undefined
                  }
                >
                  <div>
                    <div className="font-medium">{labelFor(d.date, today)}</div>
                    <div className="text-xs text-[var(--ink-muted)]">
                      {d.count} {d.count === 1 ? "entry" : "entries"}
                      {d.burned > 0 && (
                        <span style={{ color: "var(--coral)" }}> · 🔥 {d.burned.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat text-lg" style={{ color: "var(--ink)" }}>
                      {d.calories.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-[var(--ink-muted)]">kcal</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
