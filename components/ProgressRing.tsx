"use client";

import { useEffect, useState } from "react";

type Props = {
  size: number;
  stroke: number;
  value: number; // filled amount (e.g. calories eaten)
  max: number; // denominator (goal, widened by earned calories)
  fill?: string; // primary arc color (aqua)
  track?: string;
  overColor?: string; // second-lap color once value exceeds max
  centerValue?: number; // big number in the middle (defaults to value)
  centerSuffix?: string;
  label?: string;
  caption?: string;
  onEdit?: () => void; // when set, the center number becomes a tappable editor
};

// Closed 360° circle. Fill sweeps clockwise from the top; once you pass the
// goal, a second lap continues in `overColor` on top of the completed ring.
const PL = 1000;

export default function ProgressRing({
  size,
  stroke,
  value,
  max,
  fill = "var(--ring-fill)",
  track = "var(--ring-track)",
  overColor = "var(--coral)",
  centerValue,
  centerSuffix,
  label,
  caption,
  onEdit,
}: Props) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const safeMax = Math.max(max, 1);

  const over = value > safeMax;
  const fillFrac = Math.min(value / safeMax, 1);
  const overFrac = over ? Math.min((value - safeMax) / safeMax, 1) : 0;

  const [aFill, setAFill] = useState(0);
  const [aOver, setAOver] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setAFill(fillFrac);
      setAOver(overFrac);
    });
    return () => cancelAnimationFrame(id);
  }, [fillFrac, overFrac]);

  const big = centerValue ?? value;
  const transition = "stroke-dasharray 0.6s var(--ease-water), stroke 0.4s";
  const rot = `rotate(-90 ${cx} ${cx})`; // start at 12 o'clock

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          {/* Track — full closed circle */}
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={track} strokeWidth={stroke} />
          {/* Primary fill (up to the goal) */}
          {aFill > 0 && (
            <circle
              cx={cx}
              cy={cx}
              r={r}
              pathLength={PL}
              fill="none"
              stroke={fill}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${aFill * PL} ${PL}`}
              transform={rot}
              style={{ transition }}
            />
          )}
          {/* Overflow — second lap once you pass the goal */}
          {aOver > 0 && (
            <circle
              cx={cx}
              cy={cx}
              r={r}
              pathLength={PL}
              fill="none"
              stroke={overColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${aOver * PL} ${PL}`}
              transform={rot}
              style={{ transition }}
            />
          )}
        </svg>
        {onEdit ? (
          <button
            onClick={onEdit}
            aria-label={`Edit ${label || "value"}`}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <span
              className="stat leading-none rise-in"
              style={{ fontSize: size * 0.21, color: over ? "var(--coral)" : "var(--ink)" }}
            >
              {Math.round(big).toLocaleString()}
            </span>
            {centerSuffix && (
              <span style={{ fontSize: size * 0.082, color: "var(--ink-muted)", marginTop: 2 }}>
                {centerSuffix}
              </span>
            )}
            <span
              className="mt-1 opacity-55"
              style={{ fontSize: size * 0.075, color: "var(--ink-muted)" }}
            >
              ✎ edit
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="stat leading-none rise-in"
              style={{ fontSize: size * 0.21, color: over ? "var(--coral)" : "var(--ink)" }}
            >
              {Math.round(big).toLocaleString()}
            </span>
            {centerSuffix && (
              <span style={{ fontSize: size * 0.082, color: "var(--ink-muted)", marginTop: 2 }}>
                {centerSuffix}
              </span>
            )}
          </div>
        )}
      </div>
      {label && (
        <div className="text-center leading-tight">
          <div className="text-sm font-medium">{label}</div>
          {caption && <div className="text-xs text-[var(--ink-muted)]">{caption}</div>}
        </div>
      )}
    </div>
  );
}
