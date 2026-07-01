import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MINIMAX_URL = "https://api.minimax.io/v1/chat/completions";
const MODEL = "MiniMax-M2.5";

const FOOD_PROMPT = `You are a nutrition estimation engine. The user describes food they ate in natural language (possibly messy, dictated, or vague). Estimate the nutrition and respond with ONLY a JSON object — no prose, no markdown, no code fences.

Schema:
{
  "items": [
    { "name": string, "calories": number, "protein": number, "fat": number, "carbs": number }
  ],
  "explanation": string
}

Rules:
- protein, fat, carbs are in GRAMS. calories in kcal. Round every number to a whole integer.
- Break the input into individual food items when possible.
- Estimate realistic portions when the user is vague (use typical serving sizes).
- "explanation": 2-3 short sentences, friendly and specific, describing exactly what you assumed — portion sizes, and any guessed specifics (e.g. "assumed whole milk", "assumed a medium banana ~120g"). If anything was ambiguous or you were unsure, say so plainly so the user knows what to correct.
- If the input contains no food, return an empty items array and explain that.
- Never include any text outside the JSON object.`;

const ACTIVITY_PROMPT = `You are an exercise calorie-burn estimation engine. The user describes physical activity in natural language (e.g. "surfed for 3 hours"). Estimate calories burned and respond with ONLY a JSON object — no prose, no markdown, no code fences.

Assume an average adult (~75kg / 165lb) unless the user states otherwise.

Schema:
{
  "activities": [ { "name": string, "caloriesBurned": number } ],
  "explanation": string
}

Rules:
- caloriesBurned is in kcal, a whole integer, using realistic MET-based estimates for the activity, its duration and intensity.
- "explanation": 2-3 short sentences describing exactly what you assumed — the intensity level, MET value, duration, and bodyweight assumption. If anything was ambiguous, say so plainly.
- If the input contains no physical activity, return an empty activities array and explain that.
- Never include any text outside the JSON object.`;

type Mode = "food" | "activity";
type Msg = { role: "system" | "user" | "assistant"; content: string };

// ---- Best-effort in-memory rate limiting (per warm serverless instance) ----
const RL_WINDOW_MS = 60_000; // 1 minute
const RL_MAX = 12; // requests per IP per window
const TEXT_MAX = 400; // max chars of user input we forward to the model
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (recent.length >= RL_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RL_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

function clampNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function stripThink(text: string): string {
  // MiniMax-M2.5 is a reasoning model; drop <think>…</think> before parsing.
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();
}

function extractJson(text: string): any {
  const trimmed = stripThink(text);
  try {
    return JSON.parse(trimmed);
  } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {}
  }
  throw new Error("Could not parse model output as JSON");
}

function sanitizeFood(raw: any) {
  const items = Array.isArray(raw?.items)
    ? raw.items.map((it: any) => ({
        name: String(it?.name ?? "food").slice(0, 80),
        calories: clampNum(it?.calories),
        protein: clampNum(it?.protein),
        fat: clampNum(it?.fat),
        carbs: clampNum(it?.carbs),
      }))
    : [];
  const totals = items.reduce(
    (acc: any, it: any) => ({
      calories: acc.calories + it.calories,
      protein: acc.protein + it.protein,
      fat: acc.fat + it.fat,
      carbs: acc.carbs + it.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  return { kind: "food", items, totals, explanation: String(raw?.explanation ?? "").slice(0, 600) };
}

function sanitizeActivity(raw: any) {
  const activities = Array.isArray(raw?.activities)
    ? raw.activities.map((a: any) => ({
        name: String(a?.name ?? "activity").slice(0, 80),
        caloriesBurned: clampNum(a?.caloriesBurned),
      }))
    : [];
  const totalBurned = activities.reduce((acc: number, a: any) => acc + a.caloriesBurned, 0);
  return {
    kind: "activity",
    activities,
    totalBurned,
    explanation: String(raw?.explanation ?? "").slice(0, 600),
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing MINIMAX_API_KEY." },
      { status: 500 }
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Slow down a moment — too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "30" } }
    );
  }

  let text = "";
  let mode: Mode = "food";
  let history: Msg[] = [];
  let profile = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
    mode = body?.mode === "activity" ? "activity" : "food";
    profile = String(body?.profile ?? "").slice(0, 200).trim();
    if (Array.isArray(body?.history)) {
      history = body.history
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && m.content)
        .slice(-6)
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json(
      { error: mode === "activity" ? "Describe your activity." : "Describe what you ate." },
      { status: 400 }
    );
  }
  // Cap input length so nobody can send huge prompts through the model.
  if (text.length > TEXT_MAX) text = text.slice(0, TEXT_MAX);

  let systemPrompt = mode === "activity" ? ACTIVITY_PROMPT : FOOD_PROMPT;
  if (profile) {
    systemPrompt +=
      `\n\nUser profile (use this for personalization — especially use their bodyweight for MET-based calorie-burn math instead of assuming an average adult): ${profile}.`;
  }
  const messages: Msg[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: text },
  ];

  let upstream: Response;
  try {
    upstream = await fetch(MINIMAX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 1200 }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Could not reach MiniMax: " + (e?.message ?? "network error") },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `MiniMax error (${upstream.status})`, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = await upstream.json().catch(() => null);
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "MiniMax returned no content", detail: JSON.stringify(data).slice(0, 500) },
      { status: 502 }
    );
  }

  try {
    const parsed = extractJson(content);
    return NextResponse.json(mode === "activity" ? sanitizeActivity(parsed) : sanitizeFood(parsed));
  } catch {
    return NextResponse.json(
      { error: "Could not understand the estimate.", detail: stripThink(content).slice(0, 300) },
      { status: 502 }
    );
  }
}
