"use client";

// Shared cross-link row — gives every (tabs) page a path to /, /about,
// /help, /legal without typing a URL. Renders in normal flow as a
// sibling of the page <main>, so it scrolls with content and appears
// just above the TabBar overlay when the rider reaches the bottom of
// the page. Each rider page already reserves 180 px bottom padding
// (post-PROMPT_23) to clear the TabBar + iOS install prompt overlay,
// so this footer slots in cleanly above that region.
//
// Hidden on /radar specifically — RadarShell uses `position: fixed;
// inset: 0` for the map, so a flow-positioned footer would render
// off-screen below the map. The radar's own header + bottom toolbar
// already covers nav needs on that page.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/legal", label: "Legal" },
] as const;

export function SecondaryFooter() {
  const pathname = usePathname();
  if (pathname === "/radar") return null;

  return (
    <footer
      aria-label="Site footer"
      style={{
        padding: "12px 16px 16px",
        display: "flex",
        gap: 24,
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="ss-mono"
          style={{
            color: SS_TOKENS.fg2,
            fontSize: 11,
            letterSpacing: ".08em",
            textDecoration: "none",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 4px",
          }}
        >
          {label}
        </Link>
      ))}
    </footer>
  );
}
