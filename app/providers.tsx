"use client";

import { useEffect } from "react";
import { Toast } from "@heroui/react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Register after load so it never blocks first paint.
      const onLoad = () =>
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  useEffect(() => {
    // HeroUI/react-aria animate some components with the View Transitions API.
    // When a transition is interrupted (e.g. a toast is replaced mid-animation)
    // the browser rejects with a benign InvalidStateError: "Transition was
    // aborted because of invalid state". Swallow ONLY that specific case so it
    // doesn't surface as a runtime error; everything else propagates normally.
    const isBenign = (r: any) =>
      r &&
      (r.name === "InvalidStateError" || /Transition was aborted/i.test(r.message || "")) &&
      /Transition was aborted/i.test(r.message || "");

    const onRejection = (e: PromiseRejectionEvent) => {
      if (isBenign(e.reason)) e.preventDefault();
    };
    const onError = (e: ErrorEvent) => {
      if (isBenign(e.error)) e.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return (
    <>
      <Toast.Provider placement="top" />
      {children}
    </>
  );
}
