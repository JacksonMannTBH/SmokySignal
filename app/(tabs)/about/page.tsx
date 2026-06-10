import Link from "next/link";
import { fleetHex } from "@/lib/seed";
import { getRegistry } from "@/lib/registry";
import { SS_TOKENS } from "@/lib/tokens";
import { Tooltip } from "@/components/Tooltip";
import { Logo } from "@/components/brand/Logo";
import { roleBadgeStyle, roleBadgeText, roleTooltip } from "@/lib/role-display";
import type { FleetEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About",
  description:
    "What Out Of Sight is, where the data comes from, and which tails are tracked.",
};

export default async function AboutPage() {
  const fleet = await getRegistry();
  return (
    <main
      className="ss-page-narrow"
      style={{
        minHeight: "100dvh",
        // 180 px bottom clears tab bar + iOS install prompt overlay.
        padding: "12px 18px 180px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <span className="ss-eyebrow">Out Of Sight · About</span>
        <Link
          href="/"
          className="ss-mono"
          style={{
            fontSize: 11,
            color: SS_TOKENS.fg1,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 8px",
            margin: "-12px -8px",
          }}
        >
          ← Back
        </Link>
      </header>

      <nav
        aria-label="Site sections"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <HubLink href="/settings/alerts" label="Settings">
          Settings
        </HubLink>
        <HubLink href="/forecast" label="Weekly forecast">
          Forecast
        </HubLink>
        <HubLink href="/help" label="Help and FAQ">
          Help
        </HubLink>
        <HubLink href="/legal" label="Legal and privacy">
          Legal
        </HubLink>
      </nav>

      <Section eyebrow="What this is">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 18,
            paddingTop: 8,
          }}
        >
          <Logo size={80} wordmark />
        </div>
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-.02em",
            lineHeight: 1.25,
            color: SS_TOKENS.fg0,
            margin: "0 0 14px",
          }}
        >
          Truckers called them Smokey. We just kept the name.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: SS_TOKENS.fg1, margin: 0 }}>
          Out Of Sight tells motorcyclists, drivers, and curious locals — in
          one glance — whether the bird is up, where it is, and what it&rsquo;s
          watching. Coverage: Washington state — every WSP, county sheriff,
          and federal agency airframe we can confirm is broadcasting.
        </p>
      </Section>

      <Section eyebrow="The name">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <OriginStep
            title="The campaign hat"
            body="WSP troopers wear a flat-brimmed, high-crowned campaign hat — the same silhouette as Smokey Bear. The hat earned them the nickname long before any aircraft were involved."
          />
          <OriginGlyph rotate={-6} />
          <OriginStep
            title="CB-radio slang"
            body="In the 1970s, peak CB era, truckers coined a private vocabulary for warning each other about speed traps. Because of the hat, troopers became Smokey on the airwaves. Smokey and the Bandit (1977) cemented it in pop culture."
          />
          <OriginGlyph rotate={3} />
          <OriginStep
            title="The aviation callsign"
            body="WSP Aviation embraced the nickname. Their fleet — Cessnas with FLIR cameras for clocking speeders from the sky — operates under the official callsign &ldquo;Smokey,&rdquo; numbered Smokey 1, Smokey 4, etc."
          />
          <OriginGlyph rotate={-2} />
          <OriginStep
            title="Out Of Sight"
            body="Smokey (the bear, the trooper, the plane) plus smoke signal (the original beacon-warning system) plus signal (radio, transmission, alert). The product is the modern smoke signal — a quiet, glanceable warning that the bird is watching."
          />
        </div>
      </Section>

      <PrivacyCallout />

      <EmbedBadgeCallout />

      <Section eyebrow="Data sources">
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: SS_TOKENS.fg1,
          }}
        >
          Aircraft positions are pulled from the public ADS-B network. Primary
          feed:{" "}
          <Tooltip content="Public ADS-B aggregator network. Free, anonymous, attribution required. Our primary live data source.">
            <a
              href="https://adsb.fi"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: SS_TOKENS.fg0, textDecoration: "underline" }}
            >
              adsb.fi
            </a>
          </Tooltip>
          . Fallback:{" "}
          <Tooltip content="Academic ADS-B network at opensky-network.org. Used for historical track backfill and live fallback.">
            <a
              href="https://opensky-network.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: SS_TOKENS.fg0, textDecoration: "underline" }}
            >
              OpenSky Network
            </a>
          </Tooltip>
          . Both are anonymous, free, and require attribution — provided here
          and in the home footer. We cache snapshots for 10 seconds so a
          hundred riders watching the page generate one upstream call.
        </p>
      </Section>

      <Section eyebrow="Tail registry · transparency">
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: SS_TOKENS.fg1,
            marginBottom: 10,
          }}
        >
          These are the tails this app currently watches. The list comes from
          public ADS-B sightings cross-referenced with state and county fleet
          records. Tap any tail to see its detail page.
        </p>
        <div className="ss-grid-desktop-2">
          {fleet.map((f) => (
            <TailCard key={f.tail} entry={f} />
          ))}
        </div>
      </Section>

      <footer
        className="ss-mono"
        style={{
          marginTop: 8,
          fontSize: 10.5,
          color: SS_TOKENS.fg2,
          letterSpacing: ".04em",
          lineHeight: 1.6,
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: 9,
            letterSpacing: ".18em",
            color: SS_TOKENS.fg2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Got your ears on?
        </span>
        Found a bug or wrong tail?{" "}
        <a
          href="mailto:feedback@smokysignal.app"
          style={{ color: SS_TOKENS.fg1, textDecoration: "underline" }}
        >
          feedback@smokysignal.app
        </a>
        <br />
        <Link
          href="/legal"
          style={{ color: SS_TOKENS.fg1, textDecoration: "underline" }}
        >
          Legal
        </Link>
        {" · "}
        <Link
          href="/help"
          style={{ color: SS_TOKENS.fg1, textDecoration: "underline" }}
        >
          Help
        </Link>
      </footer>
    </main>
  );
}

function TailCard({ entry }: { entry: FleetEntry }) {
  const badge = roleBadgeText(entry.role);
  const tentative = entry.roleConfidence === "tentative";
  return (
    <Link
      href={`/plane/${entry.tail}`}
      prefetch={false}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          className="ss-mono"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: SS_TOKENS.alert,
            letterSpacing: "-.02em",
          }}
        >
          {entry.tail}
        </span>
        {entry.nickname && (
          <span
            style={{
              fontSize: 13,
              color: SS_TOKENS.fg1,
              fontStyle: "italic",
            }}
          >
            &ldquo;{entry.nickname}&rdquo;
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 6,
        }}
      >
        <span style={{ fontSize: 12, color: SS_TOKENS.fg1 }}>
          {entry.operator} · {entry.model}
        </span>
        <Tooltip content={roleTooltip(entry.role)}>
          <span
            className="ss-mono"
            style={roleBadgeStyle(entry.role)}
            tabIndex={0}
          >
            {badge}
          </span>
        </Tooltip>
        {tentative && (
          <Tooltip content="Role is best-guess from public records. May be refined.">
            <span
              className="ss-mono"
              tabIndex={0}
              style={{
                fontSize: 9.5,
                color: SS_TOKENS.fg2,
                fontStyle: "italic",
                cursor: "help",
              }}
            >
              (tentative)
            </span>
          </Tooltip>
        )}
      </div>
      <div
        className="ss-mono"
        style={{
          fontSize: 10.5,
          color: SS_TOKENS.fg2,
          marginTop: 4,
          letterSpacing: ".04em",
        }}
      >
        {fleetHex(entry).toUpperCase()} · {entry.base}
      </div>
    </Link>
  );
}

function OriginStep({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: SS_TOKENS.fg0,
          margin: 0,
          marginBottom: 4,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13.5,
          color: SS_TOKENS.fg1,
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function OriginGlyph({ rotate }: { rotate: number }) {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        justifyContent: "center",
        color: SS_TOKENS.fg3,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <Logo size={24} mono />
    </div>
  );
}

// Hub-style chip linking to one of the secondary rider routes
// (Settings, Forecast, Help, Legal). The TabBar holds the five
// primary surfaces; About becomes the hub for everything else.
// 44 px hit area meets WCAG AA target-size.
function HubLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="ss-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "10px 16px",
        borderRadius: 999,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        background: "transparent",
        color: SS_TOKENS.fg1,
        fontSize: 12,
        letterSpacing: ".06em",
        textDecoration: "none",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </Link>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="ss-eyebrow" style={{ marginBottom: 10 }}>
        {eyebrow}
      </div>
      {children}
    </section>
  );
}

function EmbedBadgeCallout() {
  const snippet =
    '<a href="https://smokysignal.app">\n  <img src="https://smokysignal.app/api/badge.svg" alt="Out Of Sight status">\n</a>';
  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div className="ss-eyebrow" style={{ marginBottom: 8 }}>
        Embed
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: SS_TOKENS.fg0,
          letterSpacing: "-.01em",
          margin: 0,
          marginBottom: 6,
        }}
      >
        Drop the badge on your blog.
      </h3>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: SS_TOKENS.fg1,
          margin: 0,
          marginBottom: 10,
        }}
      >
        Live <span className="ss-mono">SMOKEY UP</span> /{" "}
        <span className="ss-mono">ALL CLEAR</span> badge. SVG, no JS,
        edge-cached for ~30 seconds. Works in any HTML.
      </p>
      <pre
        className="ss-mono"
        // tabIndex=0 so the horizontally-scrollable region is reachable
        // by keyboard. axe scrollable-region-focusable rule.
        tabIndex={0}
        aria-label="Out Of Sight embed badge HTML snippet"
        style={{
          background: SS_TOKENS.bg2,
          border: `.5px solid ${SS_TOKENS.hairline}`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 11,
          color: SS_TOKENS.fg0,
          overflowX: "auto",
          margin: 0,
          whiteSpace: "pre",
        }}
      >
        {snippet}
      </pre>
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: SS_TOKENS.fg2,
          margin: 0,
          marginTop: 8,
        }}
      >
        Live preview:{" "}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/badge.svg"
          alt="Out Of Sight status"
          style={{ verticalAlign: "middle" }}
        />
      </p>
    </section>
  );
}

function PrivacyCallout() {
  return (
    <section
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div className="ss-eyebrow" style={{ marginBottom: 8 }}>
        Privacy · Channel 19
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: SS_TOKENS.fg0,
          letterSpacing: "-.01em",
          margin: 0,
          marginBottom: 8,
        }}
      >
        We listen, we don&rsquo;t talk.
      </h3>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: SS_TOKENS.fg1,
          margin: 0,
        }}
      >
        Out Of Sight pulls public aircraft signals and renders them. Nothing
        about you, your speed, or your phone leaves your device on its way
        to anyone — including WSP. Full data flow on{" "}
        <Link
          href="/legal"
          className="ss-mono"
          style={{ color: SS_TOKENS.fg0, textDecoration: "underline" }}
        >
          /legal
        </Link>
        .
      </p>
    </section>
  );
}
