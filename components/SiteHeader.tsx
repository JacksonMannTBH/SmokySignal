"use client";

import { LogoMark } from "@/components/brand/Logo";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const hidden =
    pathname === "/radar" ||
    pathname === "/ride" ||
    pathname.startsWith("/radar/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/qa-dashboard");

  if (hidden) return null;

  return (
    <header
      style={{
        width: "100%",
        background: "#000000",
        color: "#ffffff",
        borderBottom: "0.5px solid rgba(244, 196, 48, 0.34)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          height: "calc(env(safe-area-inset-top, 0px) + clamp(80px, 20vw, 104px))",
          padding: "env(safe-area-inset-top, 0px) clamp(14px, 4vw, 18px) 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            color: "inherit",
          }}
        >
          <LogoMark
            height="clamp(30px, 7.6vw, 42px)"
            width="clamp(45px, 11.4vw, 63px)"
            style={{
              justifySelf: "start",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontSize: "clamp(28px, 6.4vw, 38px)",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: 0,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            Out Of Sight
          </span>
        </div>
      </div>
    </header>
  );
}
