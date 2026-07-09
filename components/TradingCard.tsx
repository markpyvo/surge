"use client";

import { useEffect, useRef, useState } from "react";
import { Button, toast } from "@heroui/react";
import type { Macros } from "@/lib/store";
import {
  CARD_W,
  CARD_H,
  renderCard,
  ensureCardFonts,
  loadCardBackground,
  canvasToBlob,
  type CardData,
} from "@/lib/card";

type Props = {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  eaten: Macros;
  targets: Macros;
  burned: number;
};

// Cache the branded backdrop across opens so we only fetch it once.
let bgPromise: Promise<HTMLImageElement | null> | null = null;

export default function TradingCard({ open, onClose, dateLabel, eaten, targets, burned }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);
    const data: CardData = {
      dateLabel,
      eaten,
      targets,
      burned,
      fullGoal: targets.calories + burned,
    };
    (async () => {
      await ensureCardFonts();
      if (!bgPromise) bgPromise = loadCardBackground();
      const bg = await bgPromise;
      if (cancelled || !canvasRef.current) return;
      renderCard(canvasRef.current, data, bg);
      setRendering(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateLabel, eaten, targets, burned]);

  const fileName = `surge-${dateLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;

  async function getBlob(): Promise<Blob | null> {
    if (!canvasRef.current) return null;
    return canvasToBlob(canvasRef.current);
  }

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await getBlob();
      if (!blob) throw new Error("no image");
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Surge", text: "Closed my rings on Surge 🌊" });
      } else {
        // No native share (desktop, etc.) — fall back to a download.
        triggerDownload(blob);
        toast("Saved the card to your downloads.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast("Couldn't share the card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await getBlob();
      if (blob) triggerDownload(blob);
    } finally {
      setBusy(false);
    }
  }

  function triggerDownload(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-5 transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={`relative flex w-full max-w-sm flex-col items-center transition-transform duration-200 ${
          open ? "scale-100" : "scale-95"
        }`}
      >
        <div
          className="relative w-full overflow-hidden rounded-[28px] shadow-2xl"
          style={{ aspectRatio: `${CARD_W} / ${CARD_H}`, background: "var(--teal-deep)" }}
        >
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            className="block h-full w-full"
            style={{ opacity: rendering ? 0 : 1, transition: "opacity 0.3s" }}
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70 tide-pulse">
              Painting your card…
            </div>
          )}
        </div>

        <div className="mt-4 flex w-full gap-3">
          <Button variant="primary" size="lg" fullWidth isDisabled={rendering || busy} onPress={handleShare}>
            📲 Share
          </Button>
          <Button variant="secondary" size="lg" fullWidth isDisabled={rendering || busy} onPress={handleDownload}>
            ⬇︎ Save
          </Button>
        </div>
        <button onClick={onClose} className="mt-3 text-sm text-white/70 underline-offset-2 hover:underline">
          Close
        </button>
      </div>
    </div>
  );
}
