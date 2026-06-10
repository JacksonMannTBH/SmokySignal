import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { BASE_URL } from "@/lib/config";
import { IOSInstallPrompt } from "@/components/IOSInstallPrompt";
import { SwRegistrar } from "@/components/SwRegistrar";
import { TooltipProvider } from "@/components/Tooltip";
import { getContrastPref } from "@/lib/user-prefs";
import "./globals.css";

const TITLE = "Out Of Sight — Is the bird up?";
const DESCRIPTION =
  "Live WSP and sheriff aircraft tracker for Washington state riders.";
const SOCIAL_DESCRIPTION =
  "Live aircraft tracker for Washington state riders.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: TITLE, template: "%s · Out Of Sight" },
  description: DESCRIPTION,
  applicationName: "Out Of Sight",
  manifest: "/manifest.json",
  // iOS PWA standalone-mode flags. Without these the home-screen install
  // launches in a degraded "kinda-Safari" shell — wrong status bar, no
  // app-icon label fallback, brand voice broken on first paint.
  appleWebApp: {
    capable: true,
    title: "Out Of Sight",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "mask-icon", url: "/icons/safari-pinned-tab.svg", color: "#f4c430" },
    ],
  },
  openGraph: {
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    type: "website",
    siteName: "Out Of Sight",
    url: "/",
    images: [
      { url: "/icons/washington-eye-logo.svg", alt: "Out Of Sight" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    images: ["/icons/washington-eye-logo.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
    <html lang="en">
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
