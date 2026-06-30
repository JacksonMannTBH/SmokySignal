import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { fmtAloft, formatTsBare } from "@/lib/time";
import type { StatusState } from "@/lib/status";

type Props = {
  status: StatusState;
  lastSampleMs?: number | null;
};

export function StatusHero({ status, lastSampleMs }: Props) {
  const isAlert = status.kind === "alert";
  const sampleTime = lastSampleMs ? formatTsBare(lastSampleMs, "hour-min") : null;

  return (
    <section
      className="ss-hero-bg"
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "clamp(304px, 82vw, 370px)",
        padding: "clamp(18px, 4.8vw, 24px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: SS_TOKENS.fg0,
        background:
          "linear-gradient(145deg, rgba(20, 19, 13, 0.98), rgba(5, 6, 7, 0.98) 64%)",
        border: "1px solid rgba(246, 196, 49, 0.44)",
        borderRadius: 18,
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 24px 60px rgba(0, 0, 0, 0.42)",
      }}
    >
      <RadarLineArt />

      <div style={{ position: "relative", zIndex: 1 }}>
        <StatusPill label={status.pill} alert={isAlert} />

        <h1
          style={{
            maxWidth: 330,
            margin: "clamp(26px, 7.2vw, 44px) 0 0",
            color: "#ffe49a",
            fontFamily: "var(--font-brand)",
            fontSize: "clamp(48px, 13vw, 74px)",
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1.06,
            textShadow: "0 0 26px rgba(246, 196, 49, 0.18)",
          }}
        >
          {status.headline}
        </h1>

        <div
          aria-hidden
          style={{
            width: "72%",
            height: 1,
            marginTop: 18,
            background:
              "linear-gradient(90deg, rgba(246, 196, 49, 0.95), rgba(246, 196, 49, 0.25) 16%, rgba(255, 255, 255, 0.10) 100%)",
          }}
        />

        <p
          style={{
            maxWidth: 330,
            margin: "14px 0 0",
            color: SS_TOKENS.fg1,
            fontSize: "clamp(16px, 4.1vw, 18px)",
            fontWeight: 500,
            lineHeight: 1.45,
          }}
        >
          {status.body}
        </p>

        {status.footnote && (
          <p
            style={{
              maxWidth: 330,
              margin: "8px 0 0",
              color: SS_TOKENS.fg2,
              fontSize: 13,
              fontStyle: "italic",
              lineHeight: 1.45,
            }}
          >
            {status.footnote}
          </p>
        )}

        {status.lead && isAlert && (
          <>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {status.lead.aircraft.time_aloft_min != null && (
                <HeroMetricPill label={fmtAloft(status.lead.aircraft.time_aloft_min)} />
              )}
              {status.lead.aircraft.ground_speed_kt != null && (
                <HeroMetricPill label={`${status.lead.aircraft.ground_speed_kt} kt`} />
              )}
            </div>
            <LeadIdentity
              tail={status.lead.aircraft.tail}
              nickname={status.lead.entry.nickname}
              operator={status.lead.entry.operator}
            />
          </>
        )}
      </div>

      <div
        className="ss-mono"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: SS_TOKENS.fg3,
          fontSize: "clamp(11.5px, 3vw, 13px)",
          fontWeight: 700,
          letterSpacing: 0,
          flexWrap: "wrap",
        }}
      >
        <ClockIcon />
        <span>Last sample</span>
        <span aria-hidden>{"\u00b7"}</span>
        <span>{sampleTime ? `${sampleTime} PT` : "Unknown"}</span>
      </div>
    </section>
  );
}

function StatusPill({ label, alert }: { label: string; alert: boolean }) {
  return (
    <div
      style={{
        minHeight: 52,
        width: "fit-content",
        maxWidth: "100%",
        padding: "8px clamp(16px, 4vw, 20px) 8px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        color: SS_TOKENS.alert,
        background: "rgba(0, 0, 0, 0.30)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        borderRadius: 26,
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.07)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: "#050607",
          background: SS_TOKENS.alert,
          boxShadow: alert ? `0 0 18px ${SS_TOKENS.alert}` : undefined,
        }}
      >
        {alert ? <DotIcon /> : <CheckIcon />}
      </span>
      <span
        className="ss-mono"
        style={{
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function HeroMetricPill({ label }: { label: string }) {
  return (
    <span
      className="ss-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(246, 196, 49, 0.10)",
        border: "1px solid rgba(246, 196, 49, 0.26)",
        color: SS_TOKENS.fg0,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: SS_TOKENS.alert,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function LeadIdentity({
  tail,
  nickname,
  operator,
}: {
  tail: string;
  nickname: string | null;
  operator: string;
}) {
  const separator = " \u00b7 ";
  const middle = nickname ? `${separator}"${nickname}"${separator}` : separator;
  return (
    <Link
      href={`/plane/${tail}`}
      prefetch={false}
      aria-label={`View ${nickname ?? tail} details`}
      className="ss-mono"
      style={{
        display: "inline-block",
        marginTop: 9,
        fontSize: 11.5,
        color: SS_TOKENS.fg1,
        letterSpacing: 0,
        textDecoration: "none",
      }}
    >
      {tail}
      {middle}
      {operator}
    </Link>
  );
}

function RadarLineArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 260 360"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        top: 34,
        right: "clamp(-70px, -12vw, -48px)",
        width: "clamp(220px, 62%, 300px)",
        height: "76%",
        color: SS_TOKENS.alert,
        opacity: 0.18,
        zIndex: 0,
      }}
    >
      <circle cx="152" cy="176" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="152" cy="176" r="72" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="152" cy="176" r="108" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="152" cy="176" r="142" fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d="M152 176 71 89c22-20 52-32 86-32 35 0 67 14 91 37L152 176Z"
        fill="currentColor"
        opacity="0.20"
      />
      <path
        d="M76 115c19-28 52-49 89-51m37 18c24 13 43 35 52 62M52 172c0 58 47 105 105 105 41 0 77-24 94-58"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M41 132c18-8 24 9 39 6 18-4 16-25 37-26 17-1 22 13 37 7 15-6 14-24 31-28 19-4 33 13 48 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.65"
      />
      <circle cx="152" cy="176" r="8" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "rgba(246, 196, 49, 0.62)" }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}
