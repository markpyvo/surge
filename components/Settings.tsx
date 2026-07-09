"use client";

import { useState } from "react";
import { Button, NumberField, toast } from "@heroui/react";
import { cmToFtIn, ftInToCm } from "@/lib/store";
import type { Macros, Profile, WeightUnit, HeightUnit } from "@/lib/store";

type Props = {
  targets: Macros;
  profile: Profile;
  onSave: (t: Macros, p: Profile) => void;
};

const TARGET_FIELDS: { key: keyof Macros; label: string; unit: string; step: number; color: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal", step: 50, color: "var(--ring-fill)" },
  { key: "protein", label: "Protein", unit: "grams", step: 5, color: "var(--ring-protein)" },
  { key: "carbs", label: "Carbs", unit: "grams", step: 5, color: "var(--ring-carbs)" },
  { key: "fat", label: "Fat", unit: "grams", step: 5, color: "var(--ring-fat)" },
];

export default function Settings({ targets, profile, onSave }: Props) {
  const [t, setT] = useState<Macros>(targets);
  const [p, setP] = useState<Profile>(profile);

  const setTarget = (key: keyof Macros, v: number) =>
    setT((d) => ({ ...d, [key]: Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0 }));

  const setNum = (key: "weight" | "heightCm" | "age", v: number) =>
    setP((d) => ({ ...d, [key]: Number.isFinite(v) ? Math.max(0, Math.round(v)) : null }));

  const setHeightFt = (v: number) => {
    const cur = p.heightCm ? cmToFtIn(p.heightCm) : { ft: 0, in: 0 };
    const ft = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    const cm = ftInToCm(ft, cur.in);
    setP((d) => ({ ...d, heightCm: cm > 0 ? cm : null }));
  };
  const setHeightIn = (v: number) => {
    const cur = p.heightCm ? cmToFtIn(p.heightCm) : { ft: 0, in: 0 };
    const inch = Number.isFinite(v) ? Math.min(11, Math.max(0, Math.round(v))) : 0;
    const cm = ftInToCm(cur.ft, inch);
    setP((d) => ({ ...d, heightCm: cm > 0 ? cm : null }));
  };

  function save() {
    onSave(t, p);
    toast.success("Saved", { description: "Targets and profile updated." });
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-1 pb-10">
      {/* Targets */}
      <h2 className="mb-1 text-base font-semibold">Your targets</h2>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        The daily goal for each ring. Calories can be earned back through activity.
      </p>
      <div className="flex flex-col gap-3">
        {TARGET_FIELDS.map((f) => (
          <div key={f.key} className="glass flex items-center justify-between gap-3 rounded-[20px] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-9 w-1.5 rounded-full" style={{ background: f.color }} />
              <div>
                <div className="font-medium">{f.label}</div>
                <div className="text-xs text-[var(--ink-muted)]">{f.unit} / day</div>
              </div>
            </div>
            <NumberField
              value={t[f.key]}
              onChange={(v) => setTarget(f.key, v)}
              minValue={0}
              step={f.step}
              className="w-36"
              aria-label={`${f.label} target`}
            >
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          </div>
        ))}
      </div>

      {/* Profile */}
      <h2 className="mb-1 mt-8 text-base font-semibold">About you</h2>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        Saved on your device and sent with each estimate so activity burn uses your real
        bodyweight — you only enter it once.
      </p>

      <div className="glass flex flex-col gap-4 rounded-[20px] px-4 py-4">
        {/* Weight + unit */}
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Weight</div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-[var(--line)]">
              {(["kg", "lb"] as WeightUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setP((d) => ({ ...d, weightUnit: u }))}
                  className="px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--aqua)] focus-visible:ring-inset"
                  style={
                    p.weightUnit === u
                      ? { background: "var(--aqua)", color: "#04302b", fontWeight: 600 }
                      : { color: "var(--ink-muted)" }
                  }
                >
                  {u}
                </button>
              ))}
            </div>
            <NumberField
              value={p.weight ?? NaN}
              onChange={(v) => setNum("weight", v)}
              minValue={0}
              step={1}
              className="w-32"
              aria-label="Weight"
            >
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          </div>
        </div>

        {/* Height */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Height</div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border border-[var(--line)]">
                {(["cm", "ft"] as HeightUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setP((d) => ({ ...d, heightUnit: u }))}
                    className="px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--aqua)] focus-visible:ring-inset"
                    style={
                      p.heightUnit === u
                        ? { background: "var(--aqua)", color: "#04302b", fontWeight: 600 }
                        : { color: "var(--ink-muted)" }
                    }
                  >
                    {u}
                  </button>
                ))}
              </div>

              {p.heightUnit === "cm" && (
                <NumberField
                  value={p.heightCm ?? NaN}
                  onChange={(v) => setNum("heightCm", v)}
                  minValue={0}
                  step={1}
                  className="w-32"
                  aria-label="Height in cm"
                >
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              )}
            </div>
          </div>

          {p.heightUnit === "ft" && (
            <div className="flex items-center justify-end gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={p.heightCm ? cmToFtIn(p.heightCm).ft : ""}
                onChange={(e) => setHeightFt(e.target.value === "" ? NaN : parseInt(e.target.value, 10))}
                aria-label="Height feet"
                className="w-16 rounded-xl border border-[var(--line)] bg-[var(--card)] py-2.5 text-center text-base text-[var(--ink)] outline-none focus:border-[var(--aqua)]"
              />
              <span className="text-sm text-[var(--ink-muted)]">ft</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={11}
                value={p.heightCm ? cmToFtIn(p.heightCm).in : ""}
                onChange={(e) => setHeightIn(e.target.value === "" ? NaN : parseInt(e.target.value, 10))}
                aria-label="Height inches"
                className="w-16 rounded-xl border border-[var(--line)] bg-[var(--card)] py-2.5 text-center text-base text-[var(--ink)] outline-none focus:border-[var(--aqua)]"
              />
              <span className="text-sm text-[var(--ink-muted)]">in</span>
            </div>
          )}
        </div>

        {/* Age */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Age</div>
            <div className="text-xs text-[var(--ink-muted)]">years</div>
          </div>
          <NumberField
            value={p.age ?? NaN}
            onChange={(v) => setNum("age", v)}
            minValue={0}
            step={1}
            className="w-32"
            aria-label="Age"
          >
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
        </div>

        {/* Sex */}
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Sex</div>
          <div className="flex overflow-hidden rounded-full border border-[var(--line)]">
            {([
              { v: "male", label: "Male" },
              { v: "female", label: "Female" },
              { v: "", label: "—" },
            ] as { v: Profile["sex"]; label: string }[]).map((o) => (
              <button
                key={o.label}
                onClick={() => setP((d) => ({ ...d, sex: o.v }))}
                className="px-3.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--aqua)] focus-visible:ring-inset"
                style={
                  p.sex === o.v
                    ? { background: "var(--aqua)", color: "#04302b", fontWeight: 600 }
                    : { color: "var(--ink-muted)" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button variant="primary" size="lg" fullWidth className="mt-6" onPress={save}>
        Save
      </Button>
    </div>
  );
}
