import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "About",
  description: "Take back your liberty",
};

export default function AboutPage() {
  return (
    <main
      className="ss-page-narrow"
      style={{
        minHeight: "100dvh",
        padding: "96px 18px 180px",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          margin: 0,
          color: SS_TOKENS.fg0,
          fontSize: "clamp(38px, 11vw, 72px)",
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: 0,
        }}
      >
        Take back your liberty
      </h1>
    </main>
  );
}
