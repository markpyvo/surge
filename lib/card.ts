"use client";

// Renders a shareable "daily trading card" for a day's rings onto a canvas.
// Everything is drawn in code at a fixed high resolution (1080×1350, a 4:5
// share-friendly collectible proportion) so the exported PNG is crisp and the
// exact numbers are always legible — the Higgsfield-generated art is used only
// as the branded backdrop, with the live stats composited on top.

import type { Macros } from "./store";

export const CARD_W = 1080;
export const CARD_H = 1350;

export type CardData = {
  dateLabel: string; // e.g. "Mon, Jul 7"
  eaten: Macros;
  targets: Macros;
  burned: number;
  fullGoal: number; // targets.calories + burned
};

// Brand palette — kept in sync with app/globals.css (the "Tide" system).
const C = {
  teal: "#0C5A66",
  tealShadow: "#16707C",
  aqua: "#34D1BE",
  aquaSoft: "#8FE7DC",
  coral: "#FF7E5F",
  ink: "#EAF6F5",
  inkMuted: "#9FC0C2",
  white: "#FFFFFF",
  track: "rgba(255,255,255,0.14)",
} as const;

// next/font exposes the real (hashed) family names on these CSS vars; read them
// so canvas text matches the app. Falls back to sensible system stacks.
function fam(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function fonts() {
  return {
    display: fam("--font-sora", "ui-sans-serif, system-ui, sans-serif"),
    body: fam("--font-inter", "ui-sans-serif, system-ui, sans-serif"),
  };
}

// Ensure the web fonts are actually rasterizable before we paint to canvas.
export async function ensureCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const f = fonts();
  try {
    await Promise.all([
      (document as any).fonts.load(`700 120px ${f.display}`),
      (document as any).fonts.load(`600 40px ${f.display}`),
      (document as any).fonts.load(`500 32px ${f.body}`),
      (document as any).fonts.ready,
    ]);
  } catch {
    /* best-effort: fall back to whatever is available */
  }
}

// Load the branded backdrop; resolves null if the asset is missing so the card
// still renders (with a drawn gradient) rather than failing.
export function loadCardBackground(src = "/card-bg.jpg"): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A closed-circle progress ring matching ProgressRing.tsx: faint track, a fill
// arc sweeping clockwise from 12 o'clock, and a coral second lap once over goal.
function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stroke: number,
  value: number,
  max: number,
  fill: string
) {
  const safeMax = Math.max(max, 1);
  const frac = Math.min(value / safeMax, 1);
  const over = value > safeMax ? Math.min((value - safeMax) / safeMax, 1) : 0;
  const start = -Math.PI / 2;

  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  // Track
  ctx.beginPath();
  ctx.strokeStyle = C.track;
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Primary fill
  if (frac > 0) {
    ctx.beginPath();
    ctx.strokeStyle = fill;
    ctx.arc(cx, cy, radius, start, start + frac * Math.PI * 2);
    ctx.stroke();
  }
  // Overflow lap
  if (over > 0) {
    ctx.beginPath();
    ctx.strokeStyle = C.coral;
    ctx.arc(cx, cy, radius, start, start + over * Math.PI * 2);
    ctx.stroke();
  }
}

// The little Surge mark (ring + coral sun + waves), drawn so the card is
// self-contained and doesn't depend on loading the icon asset.
function mark(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.lineCap = "round";
  // three-quarter ring
  ctx.beginPath();
  ctx.strokeStyle = C.aqua;
  ctx.lineWidth = s * 0.13;
  ctx.arc(cx, cy, s * 0.42, -Math.PI * 0.5, Math.PI * 1.0);
  ctx.stroke();
  // sun
  ctx.beginPath();
  ctx.fillStyle = C.coral;
  ctx.arc(cx, cy - s * 0.12, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // wave
  ctx.beginPath();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = s * 0.07;
  ctx.moveTo(cx - s * 0.26, cy + s * 0.16);
  ctx.quadraticCurveTo(cx - s * 0.08, cy + s * 0.06, cx + s * 0.02, cy + s * 0.16);
  ctx.quadraticCurveTo(cx + s * 0.14, cy + s * 0.26, cx + s * 0.28, cy + s * 0.16);
  ctx.stroke();
  ctx.restore();
}

export function renderCard(canvas: HTMLCanvasElement, data: CardData, bg: HTMLImageElement | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const f = fonts();
  const { eaten, targets, burned, fullGoal, dateLabel } = data;

  // ---- Backdrop ----
  if (bg) {
    // cover-fit
    const scale = Math.max(CARD_W / bg.width, CARD_H / bg.height);
    const w = bg.width * scale;
    const h = bg.height * scale;
    ctx.drawImage(bg, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  } else {
    const g = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.34, 80, CARD_W / 2, CARD_H * 0.34, CARD_H * 0.8);
    g.addColorStop(0, C.tealShadow);
    g.addColorStop(1, C.teal);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  // The branded backdrop already carries its own bezel; only draw one for the
  // gradient fallback so the fallback still reads as a "card".
  if (!bg) {
    ctx.strokeStyle = "rgba(143,231,220,0.35)";
    ctx.lineWidth = 2;
    roundRect(ctx, 28, 28, CARD_W - 56, CARD_H - 56, 44);
    ctx.stroke();
  }

  // ---- Header: mark + wordmark (left), date (right) ----
  const padX = 72;
  mark(ctx, padX + 26, 92, 52);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = C.white;
  ctx.font = `700 46px ${f.display}`;
  // letter-spaced wordmark
  drawTracked(ctx, "SURGE", padX + 64, 92, 4);

  ctx.textAlign = "right";
  ctx.fillStyle = C.inkMuted;
  ctx.font = `500 30px ${f.body}`;
  ctx.fillText(dateLabel, CARD_W - padX, 92);

  // ---- Hero calorie ring ----
  const heroCx = CARD_W / 2;
  const heroCy = 470;
  const heroR = 210;
  ring(ctx, heroCx, heroCy, heroR, 34, eaten.calories, fullGoal, C.aqua);

  const over = eaten.calories > fullGoal;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = over ? C.coral : C.white;
  ctx.font = `700 130px ${f.display}`;
  ctx.fillText(eaten.calories.toLocaleString(), heroCx, heroCy + 26);
  ctx.fillStyle = C.inkMuted;
  ctx.font = `500 34px ${f.body}`;
  ctx.fillText(`of ${fullGoal.toLocaleString()} kcal`, heroCx, heroCy + 84);

  // completion pill under the hero
  const pct = Math.round((eaten.calories / Math.max(fullGoal, 1)) * 100);
  const pillText = over ? `${(eaten.calories - fullGoal).toLocaleString()} kcal over` : `${pct}% of goal`;
  pill(ctx, heroCx, heroCy + heroR + 74, pillText, over ? C.coral : C.aqua, f.body);

  // ---- Macro rings row ----
  const macros: { key: keyof Macros; label: string; color: string }[] = [
    { key: "protein", label: "Protein", color: C.aqua },
    { key: "carbs", label: "Carbs", color: C.tealShadow },
    { key: "fat", label: "Fat", color: C.aquaSoft },
  ];
  const rowY = 940;
  const colGap = CARD_W / 3;
  macros.forEach((m, i) => {
    const cx = colGap * i + colGap / 2;
    ring(ctx, cx, rowY, 96, 16, eaten[m.key], targets[m.key], m.color);
    ctx.fillStyle = C.white;
    ctx.textAlign = "center";
    ctx.font = `600 52px ${f.display}`;
    ctx.textBaseline = "middle";
    ctx.fillText(`${eaten[m.key]}`, cx, rowY - 6);
    ctx.fillStyle = C.inkMuted;
    ctx.font = `500 24px ${f.body}`;
    ctx.fillText("g", cx, rowY + 34);
    // label + target below
    ctx.fillStyle = C.ink;
    ctx.font = `600 30px ${f.body}`;
    ctx.fillText(m.label, cx, rowY + 148);
    ctx.fillStyle = C.inkMuted;
    ctx.font = `500 26px ${f.body}`;
    ctx.fillText(`${eaten[m.key]} / ${targets[m.key]} g`, cx, rowY + 186);
  });

  // ---- Footer ----
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (burned > 0) {
    ctx.fillStyle = C.coral;
    ctx.font = `600 32px ${f.body}`;
    ctx.fillText(`🔥 +${burned.toLocaleString()} kcal earned back`, CARD_W / 2, CARD_H - 150);
  }
  ctx.fillStyle = C.inkMuted;
  ctx.font = `500 28px ${f.body}`;
  drawTracked(ctx, "CLOSE YOUR RINGS", CARD_W / 2, CARD_H - 96, 3, "center");
}

function pill(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, color: string, family: string) {
  ctx.font = `600 30px ${family}`;
  const w = ctx.measureText(text).width + 56;
  const h = 60;
  ctx.fillStyle = "rgba(52,209,190,0.14)";
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(143,231,220,0.4)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 1);
}

// Canvas has no letter-spacing pre-2023 everywhere; emulate for the wordmark.
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "left" | "center" = "left"
) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let cursor = align === "center" ? x - total / 2 : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += widths[i];
  });
  ctx.textAlign = prevAlign;
}

// Export the current canvas as a PNG blob for share/download.
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
