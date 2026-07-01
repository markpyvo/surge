"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, toast } from "@heroui/react";
import Dashboard from "@/components/Dashboard";
import Settings from "@/components/Settings";
import LogSheet from "@/components/LogSheet";
import Calendar from "@/components/Calendar";
import {
  DayLog,
  Macros,
  FoodEntry,
  ActivityEntry,
  Profile,
  DaySummary,
  DEFAULT_TARGETS,
  DEFAULT_PROFILE,
  loadDay,
  loadTargets,
  loadProfile,
  saveDay,
  saveTargets,
  saveProfile,
  profileToPrompt,
  listLoggedDays,
  sumBurned,
  sumEaten,
  todayKey,
  makeId,
} from "@/lib/store";

type View = "home" | "settings" | "calendar";
type SheetMode = "food" | "activity";
type RefineTarget = { kind: SheetMode; id: string; text: string; prior: string } | null;

const ZERO: Macros = { calories: 0, protein: 0, fat: 0, carbs: 0 };

export default function Page() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [targets, setTargets] = useState<Macros>(DEFAULT_TARGETS);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [activeDate, setActiveDate] = useState<string>(todayKey());
  const [day, setDay] = useState<DayLog>({ date: todayKey(), entries: [], activities: [] });
  const [historyDays, setHistoryDays] = useState<DaySummary[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("food");
  const [refine, setRefine] = useState<RefineTarget>(null);

  const activeDateRef = useRef(activeDate);
  activeDateRef.current = activeDate;

  const isViewingPast = activeDate !== todayKey();

  useEffect(() => {
    setTargets(loadTargets());
    setProfile(loadProfile());
    setDay(loadDay(todayKey()));
    setReady(true);
    const onVisible = () => {
      // Only auto-roll the day when we're actually viewing today.
      if (activeDateRef.current !== todayKey()) return;
      const key = todayKey();
      setActiveDate(key);
      setDay((d) => (d.date === key ? d : loadDay(key)));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  function goToDate(date: string) {
    setActiveDate(date);
    setDay(loadDay(date));
    setView("home");
  }

  function openCalendar() {
    setHistoryDays(listLoggedDays());
    setView("calendar");
  }

  function dateLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const t = new Date(todayKey() + "T00:00:00");
    const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
    if (diff === 1) return "yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  const eaten = useMemo(() => sumEaten(day), [day]);
  const burned = useMemo(() => sumBurned(day), [day]);

  // Always read the freshest persisted day, mutate, save, and set state.
  function mutateDay(fn: (d: DayLog) => DayLog) {
    const key = todayKey();
    setDay((prev) => {
      const base = prev.date === key ? prev : loadDay(key);
      const next = fn(base);
      saveDay(next);
      return next;
    });
  }

  function openSheet(mode: SheetMode) {
    setRefine(null);
    setSheetMode(mode);
    setSheetOpen(true);
  }

  async function callModel(text: string, mode: SheetMode, history?: any[]) {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mode, history, profile: profileToPrompt(profile) ?? undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Something went wrong");
    return data;
  }

  // ---- New log (optimistic + progress toast) ----
  function handleNewLog(text: string, mode: SheetMode) {
    const id = makeId();
    const now = Date.now();
    if (mode === "food") {
      const pendingEntry: FoodEntry = { id, time: now, text, items: [], totals: { ...ZERO }, pending: true };
      mutateDay((d) => ({ ...d, entries: [pendingEntry, ...d.entries] }));
    } else {
      const pendingEntry: ActivityEntry = { id, time: now, text, name: "Activity", caloriesBurned: 0, pending: true };
      mutateDay((d) => ({ ...d, activities: [pendingEntry, ...d.activities] }));
    }

    const rollback = () =>
      mutateDay((d) =>
        mode === "food"
          ? { ...d, entries: d.entries.filter((en) => en.id !== id) }
          : { ...d, activities: d.activities.filter((a) => a.id !== id) }
      );

    const work = (async () => {
      const data = await callModel(text, mode);
      if (mode === "food") {
        const totals: Macros = data?.totals ?? { ...ZERO };
        if (!totals.calories && !totals.protein && !totals.carbs && !totals.fat) {
          throw new Error("No food detected — try naming the dish or ingredients.");
        }
        mutateDay((d) => ({
          ...d,
          entries: d.entries.map((e) =>
            e.id === id ? { ...e, items: data.items ?? [], totals, explanation: data.explanation, pending: false } : e
          ),
        }));
        return `Logged ${totals.calories} kcal · ${totals.protein}p · ${totals.carbs}c · ${totals.fat}f`;
      } else {
        const burnedNow = Number(data?.totalBurned ?? 0);
        if (!burnedNow) {
          throw new Error("No activity detected — describe the exercise and duration.");
        }
        const name = (data.activities?.[0]?.name as string) || "Activity";
        mutateDay((d) => ({
          ...d,
          activities: d.activities.map((a) =>
            a.id === id ? { ...a, name, caloriesBurned: burnedNow, explanation: data.explanation, pending: false } : a
          ),
        }));
        return `+${burnedNow} kcal earned — ring widened`;
      }
    })();

    work.catch(() => rollback());
    toast.promise(work, {
      loading: mode === "food" ? "Estimating nutrition…" : "Estimating calories burned…",
      success: (msg) => msg as string,
      error: (e: any) => e?.message || "Couldn't log that",
    });
  }

  // ---- Refine an existing entry (multi-turn) ----
  function startRefine(kind: SheetMode, id: string) {
    if (kind === "food") {
      const e = day.entries.find((x) => x.id === id);
      if (!e) return;
      const prior = JSON.stringify({ items: e.items, explanation: e.explanation ?? "" });
      setRefine({ kind, id, text: e.text, prior });
    } else {
      const a = day.activities.find((x) => x.id === id);
      if (!a) return;
      const prior = JSON.stringify({
        activities: [{ name: a.name, caloriesBurned: a.caloriesBurned }],
        explanation: a.explanation ?? "",
      });
      setRefine({ kind, id, text: a.text, prior });
    }
    setSheetMode(kind);
    setSheetOpen(true);
  }

  function handleRefineSubmit(clarification: string, target: RefineTarget) {
    if (!target) return;
    const { kind, id, text, prior } = target;
    const combinedText = `${text} · ${clarification}`;
    // Mark the entry as pending again.
    mutateDay((d) =>
      kind === "food"
        ? { ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, pending: true } : e)) }
        : { ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, pending: true } : a)) }
    );

    const clearPending = () =>
      mutateDay((d) =>
        kind === "food"
          ? { ...d, entries: d.entries.map((en) => (en.id === id ? { ...en, pending: false } : en)) }
          : { ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, pending: false } : a)) }
      );

    const history = [
      { role: "user", content: text },
      { role: "assistant", content: prior },
    ];

    const work = (async () => {
      const data = await callModel(clarification, kind, history);
      if (kind === "food") {
        const totals: Macros = data?.totals ?? { ...ZERO };
        mutateDay((d) => ({
          ...d,
          entries: d.entries.map((e) =>
            e.id === id
              ? { ...e, text: combinedText, items: data.items ?? [], totals, explanation: data.explanation, pending: false }
              : e
          ),
        }));
        return `Updated · ${totals.calories} kcal · ${totals.protein}p · ${totals.carbs}c · ${totals.fat}f`;
      } else {
        const burnedNow = Number(data?.totalBurned ?? 0);
        const name = (data.activities?.[0]?.name as string) || "Activity";
        mutateDay((d) => ({
          ...d,
          activities: d.activities.map((a) =>
            a.id === id
              ? { ...a, text: combinedText, name, caloriesBurned: burnedNow, explanation: data.explanation, pending: false }
              : a
          ),
        }));
        return `Updated · +${burnedNow} kcal earned`;
      }
    })();

    work.catch(() => clearPending());
    toast.promise(work, {
      loading: "Re-estimating…",
      success: (msg) => msg as string,
      error: (e: any) => e?.message || "Couldn't update that",
    });
  }

  function onSheetSubmit(text: string) {
    const target = refine;
    const mode = sheetMode;
    setSheetOpen(false); // close immediately — processing happens in the background
    if (target) {
      setRefine(null);
      handleRefineSubmit(text, target);
    } else {
      handleNewLog(text, mode);
    }
  }

  function saveSettings(t: Macros, p: Profile) {
    setTargets(t);
    saveTargets(t);
    setProfile(p);
    saveProfile(p);
    setView("home");
  }

  return (
    <main className="min-h-dvh pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="mx-auto mb-3 flex w-full max-w-md items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Surge" width={34} height={34} className="rounded-[10px]" />
          <div>
            <h1 className="text-xl font-bold leading-none">Surge</h1>
            <p className="text-[11px] text-[var(--ink-muted)]">
              {view === "settings"
                ? "Targets & profile"
                : view === "calendar"
                ? "History"
                : "Close your rings"}
            </p>
          </div>
        </div>
        {view === "home" ? (
          <div className="flex items-center gap-1">
            <Button variant="tertiary" size="sm" isIconOnly aria-label="History" onPress={openCalendar}>
              📅
            </Button>
            <Button variant="tertiary" size="sm" isIconOnly aria-label="Settings" onPress={() => setView("settings")}>
              ⚙️
            </Button>
          </div>
        ) : (
          <Button variant="tertiary" size="sm" onPress={() => setView("home")}>
            Done
          </Button>
        )}
      </header>

      {!ready ? (
        <div className="mt-24 text-center text-sm text-[var(--ink-muted)] tide-pulse">Loading…</div>
      ) : view === "settings" ? (
        <Settings targets={targets} profile={profile} onSave={saveSettings} />
      ) : view === "calendar" ? (
        <Calendar days={historyDays} activeDate={activeDate} onSelect={goToDate} />
      ) : (
        <Dashboard
          targets={targets}
          eaten={eaten}
          burned={burned}
          day={day}
          readOnly={isViewingPast}
          dateLabel={isViewingPast ? dateLabel(activeDate) : undefined}
          onBack={() => goToDate(todayKey())}
          onLogFood={() => openSheet("food")}
          onLogActivity={() => openSheet("activity")}
          onRemoveFood={(id) => mutateDay((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))}
          onRemoveActivity={(id) => mutateDay((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) }))}
          onRefine={startRefine}
        />
      )}

      <LogSheet
        open={sheetOpen}
        mode={sheetMode}
        refineText={refine?.text ?? null}
        onClose={() => setSheetOpen(false)}
        onSubmit={onSheetSubmit}
      />
    </main>
  );
}
