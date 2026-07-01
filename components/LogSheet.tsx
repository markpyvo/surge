"use client";

import { useEffect, useRef, useState } from "react";
import { Button, TextArea } from "@heroui/react";

type Mode = "food" | "activity";

type Props = {
  open: boolean;
  mode: Mode;
  refineText?: string | null;
  onClose: () => void;
  onSubmit: (text: string) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: SpeechRecognitionLike = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}

export default function LogSheet({ open, mode, refineText, onClose, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");

  const isRefine = !!refineText;

  useEffect(() => {
    const ok = getRecognition() !== null;
    setSupported(ok);
    if (!ok) setInputMode("text");
  }, []);

  useEffect(() => {
    if (open) {
      setText("");
      setListening(false);
      setInputMode(getRecognition() ? "voice" : "text");
    } else {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopListening() {
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
    setListening(false);
  }

  function toggleListening() {
    if (listening) {
      stopListening();
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      setSupported(false);
      setInputMode("text");
      return;
    }
    baseRef.current = text ? text.trim() + " " : "";
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(baseRef.current + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    stopListening();
    onSubmit(t);
  }

  const isFood = mode === "food";
  const accent = isFood ? "var(--aqua)" : "var(--coral)";
  const title = isRefine ? "Tell it more" : isFood ? "What did you eat?" : "What did you do?";
  const placeholder = isRefine
    ? isFood
      ? "e.g. the milk was oat, and it was a large portion"
      : "e.g. it was high intensity"
    : isFood
    ? "e.g. two eggs, avocado toast, and a flat white"
    : "e.g. surfed for 3 hours, then a 20 min jog";
  const submitLabel = isRefine ? "Update estimate" : isFood ? "Add to rings" : "Log activity";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        tabIndex={open ? 0 : -1}
      />

      <div
        className={`glass relative w-full max-w-md rounded-t-3xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ borderBottom: "none" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        {isRefine && (
          <p
            className="mb-3 rounded-xl px-3 py-2 text-xs"
            style={{ background: "color-mix(in srgb, var(--aqua) 16%, transparent)", color: "var(--ink)" }}
          >
            Refining: <span className="font-medium">{refineText}</span>
          </p>
        )}

        {inputMode === "voice" ? (
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="relative flex items-center">
              {/* Pencil — switch to manual typing (on the side) */}
              <button
                aria-label="Type instead"
                onClick={() => {
                  stopListening();
                  setInputMode("text");
                }}
                className="absolute -right-24 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-lg"
                style={{ color: "var(--ink-muted)" }}
              >
                ✏️
              </button>

              {/* Main mic button */}
              <button
                aria-label={listening ? "Stop" : "Tap to speak"}
                onClick={toggleListening}
                className="relative flex h-24 w-24 items-center justify-center rounded-full text-4xl text-white shadow-lg transition-transform active:scale-95"
                style={{ background: accent }}
              >
                {listening && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 0 8px color-mix(in srgb, ${accent} 30%, transparent)`, animation: "tidepulse 1.2s ease-in-out infinite" }}
                  />
                )}
                <span>{listening ? "■" : "🎤"}</span>
              </button>
            </div>

            <p className="text-sm text-[var(--ink-muted)]">
              {listening ? "Listening… tap to stop" : "Tap the mic and just talk"}
            </p>

            {text && (
              <p
                className="max-h-24 w-full overflow-y-auto rounded-xl px-3 py-2 text-center text-sm"
                style={{ background: "color-mix(in srgb, var(--aqua) 18%, transparent)", color: "var(--ink)" }}
              >
                {text}
              </p>
            )}
          </div>
        ) : (
          <div className="py-1">
            <div className="relative">
              <TextArea
                value={text}
                onChange={(e) => setText((e.target as HTMLTextAreaElement).value)}
                placeholder={placeholder}
                rows={3}
                autoFocus
                className="w-full resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
              />
            </div>
            {supported && (
              <button
                onClick={() => setInputMode("voice")}
                className="mt-2 flex items-center gap-1.5 text-sm font-medium"
                style={{ color: accent }}
              >
                🎤 Use voice instead
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button variant="tertiary" size="lg" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" fullWidth onPress={submit} isDisabled={text.trim().length === 0}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
