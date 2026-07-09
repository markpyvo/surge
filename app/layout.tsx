import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import { Providers } from "./providers";

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Surge — Macro Rings",
  description: "Close your rings. Calories, protein, fat & carbs — just say what you ate.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Surge",
  },
  // Next 15 emits `mobile-web-app-capable` but drops the legacy Apple tag that
  // iOS Safari still needs to launch full-screen (no toolbar). Add it back.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6fafa",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${inter.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
