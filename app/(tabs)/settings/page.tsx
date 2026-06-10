import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight for how you ride.",
};

export const dynamic = "force-static";

const HUB_LINKS = [
  {
    href: "/settings/alerts",
    eyebrow: "Alerts",
    title: "Push, region, voice",
    body: "Arm push notifications for tails or roles. Pick your time format, contrast, region. Reset every preference.",
  },
  {
    href: "/settings/zones",
    eyebrow: "Zones",
    title: "Your geofences",
    body: "Draw circles around home, work, or favorite roads. Smokey passing through any armed zone gets called out.",
  },
] as const;

export default function SettingsHub() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "12px 18px 180px",
        maxWidth: 460,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 4,
          marginBottom: 4,
        }}
      >
        <span className="ss-eyebrow">Out Of Sight · Settings</span>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-.02em",
            margin: 0,
            color: SS_TOKENS.fg0,
          }}
        >
          Tune Out Of Sight.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: SS_TOKENS.fg1,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          Every preference lives on your device. Nothing rides home to the
          server.
        </p>
      </header>

      <nav
        aria-label="Settings sections"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {HUB_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: "block",
              padding: "16px 18px",
              borderRadius: 24,
              border: `.5px solid ${SS_TOKENS.hairline2}`,
              background: SS_TOKENS.surface,
              boxShadow: SS_TOKENS.shadowSm,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              textDecoration: "none",
              minHeight: 44,
            }}
          >
            <div
              className="ss-eyebrow"
              style={{ marginBottom: 6, color: SS_TOKENS.fg2 }}
            >
              {link.eyebrow}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: SS_TOKENS.fg0,
                marginBottom: 4,
              }}
            >
              {link.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: SS_TOKENS.fg1,
                lineHeight: 1.5,
              }}
            >
              {link.body}
            </div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
