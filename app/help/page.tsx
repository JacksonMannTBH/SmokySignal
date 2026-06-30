import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { getRegistry } from "@/lib/registry";
import { HelpMarkdown, HelpScrollTopButton } from "./HelpView";

export const metadata = {
  title: "Help",
  description:
    "What Out Of Sight shows you, where the data comes from, and how to read each screen.",
};

export default async function HelpPage() {
  const [md, registry] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "content", "help.md"), "utf8"),
    getRegistry(),
  ]);
  // Templating placeholders so the registry size + operator list don't
  // go stale on every fleet expansion. Replace before passing to the
  // markdown renderer.
  const source = md.replace(/\{\{TAIL_COUNT\}\}/g, String(registry.length));

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: SS_TOKENS.bg0,
        color: SS_TOKENS.fg1,
        // /help isn't in the (tabs) layout (no TabBar) but the iOS
        // install prompt still overlays from the root layout, so
        // bottom padding needs to clear the prompt (~80 px) plus
        // breathing room.
        paddingBottom: 120,
      }}
    >
      <header
        style={{
          borderBottom: `.5px solid ${SS_TOKENS.hairline}`,
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "12px 18px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Link
            href="/"
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg1,
              textDecoration: "none",
              justifySelf: "start",
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 8px",
              margin: "0 -8px",
            }}
          >
            ← Back
          </Link>
          <span
            className="ss-mono"
            style={{
              fontSize: 10.5,
              color: SS_TOKENS.fg2,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              justifySelf: "center",
              whiteSpace: "nowrap",
            }}
          >
            Out Of Sight · Help
          </span>
          <span />
        </div>
      </header>

      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 18px 80px",
        }}
      >
        <HelpMarkdown source={source} />
      </article>

      <HelpScrollTopButton />
    </main>
  );
}
