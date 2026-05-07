import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { BASE_URL } from "@/lib/config";
import { IOSInstallPrompt } from "@/components/IOSInstallPrompt";
import { SwRegistrar } from "@/components/SwRegistrar";
import { TooltipProvider } from "@/components/Tooltip";
import { getContrastPref } from "@/lib/user-prefs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const TITLE = "SmokySignal — Is the bird up?";
const DESCRIPTION =
  "Live WSP and sheriff aircraft tracker for Washington state riders. Know when Smokey's watching.";
const SOCIAL_DESCRIPTION =
  "Live aircraft tracker for Washington state riders.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: TITLE, template: "%s · SmokySignal" },
  description: DESCRIPTION,
  applicationName: "SmokySignal",
  manifest: "/manifest.json",
  // iOS PWA standalone-mode flags. Without these the home-screen install
  // launches in a degraded "kinda-Safari" shell — wrong status bar, no
  // app-icon label fallback, brand voice broken on first paint.
  appleWebApp: {
    capable: true,
    title: "SmokySignal",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "mask-icon", url: "/icons/safari-pinned-tab.svg", color: "#f5b840" },
    ],
  },
  openGraph: {
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    type: "website",
    siteName: "SmokySignal",
    url: "/",
    images: [
      { url: "/icons/og-image.png", width: 1200, height: 630, alt: "SmokySignal" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    images: ["/icons/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0D10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contrast = getContrastPref();
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body
        className="ss-app bg-ss-bg0 text-ss-fg0"
        data-contrast={contrast}
      >
        <TooltipProvider>
          {children}
          <IOSInstallPrompt />
          <SwRegistrar />
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
