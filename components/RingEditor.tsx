"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";

type Props = {
  open: boolean;
  label: string;
  unit: string;
  color: string;
  value: number;
  onClose: () => void;
  onSave: (value: number) => void;
};

export default function RingEditor({ open, label, unit, color, value, onClose, onSave }: Props) {
  const [text, setText] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText(String(Math.round(value)));
      // Focus + select shortly after the modal appears.
      const id = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    const n = parseInt(text, 10);
    onSave(Number.isFinite(n) && n >= 0 ? n : 0);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-6 transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className={`glass relative w-full max-w-xs rounded-[24px] p-5 shadow-2xl transition-transform duration-200 ${
          open ? "scale-100" : "scale-95"
        }`}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: color }} />
          <h2 className="text-lg font-semibold">Set {label.toLowerCase()}</h2>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={0}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className="stat w-full rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-2xl text-[var(--ink)] outline-none focus:border-[var(--aqua)]"
          />
          <span className="text-sm text-[var(--ink-muted)]">{unit}</span>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="tertiary" size="lg" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" fullWidth onPress={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
