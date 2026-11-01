import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { APP } from "@/lib/constants";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP.name} — ${APP.tagline}`,
    template: `%s · ${APP.name}`,
  },
  description: APP.description,
  applicationName: APP.name,
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#080c0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <TooltipProvider delayDuration={180}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
