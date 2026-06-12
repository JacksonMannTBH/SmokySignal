import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "About",
  description: "Take back your liberty",
};

const ABOUT_PATROL_AIRCRAFT_HTML = `
<p>Most drivers never look up. While people focus on patrol cars parked along the shoulder or hidden in the median, some of the most effective traffic enforcement platforms in Washington State operate thousands of feet overhead. Aircraft can cover vast stretches of highway in minutes, observe traffic patterns far beyond the view of any single officer, and maintain visual contact with vehicles long after they disappear from ground units. Unlike traditional patrol methods, aviation assets can monitor multiple roadways simultaneously, making them one of the most powerful &mdash; and often least noticed &mdash; tools available to law enforcement agencies.</p>

<p>What makes these aircraft especially effective is their combination of speed, endurance, and technology. A fixed-wing patrol aircraft can move across counties at highway-crushing speeds while remaining airborne for hours at a time. Helicopters trade some of that long-range endurance for the ability to hover, orbit tight areas, insert rescue teams, and stay directly over a scene. That is the part most people miss: these are not quick flybys. With the right fuel load, crew, and mission profile, they can stay in the air long enough to turn a normal night into a long-running aerial operation.</p>

<p>Adding to that capability is <strong>FLIR</strong> &mdash; forward-looking infrared / thermal-imaging technology commonly listed in public aircraft documents as FLIR. This equipment sees heat, not just light. Darkness, tree lines, distance, and poor visibility do not hide activity the way people assume they do. Combined with stabilized optics, high-powered zoom, GPS-referenced tracking, radios, searchlights, and live video downlinks, these aircraft become moving observation posts overhead. Watch an example here: <a href="https://www.youtube.com/watch?v=3HdVoR9SFVE" target="_blank" rel="noopener noreferrer"><strong>FLIR</strong> in action</a>.</p>

<p>As aerial surveillance technology continues to evolve, Washington&rsquo;s skies are becoming increasingly populated by platforms capable of seeing more, tracking longer, and covering far greater distances than many residents realize. Every orbit, transponder signal, tail number, and call sign tells part of the story. For those paying attention, the sky is no longer empty &mdash; it is part of the patrol grid.</p>

<h2>Meet the Ops</h2>

<table>
  <thead>
    <tr>
      <th>Tail #</th>
      <th>Aircraft</th>
      <th>Published top / max cruise speed</th>
      <th>Estimated full-fuel run time</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>N102LP</td>
      <td>Cessna 182T Skylane</td>
      <td>145 ktas / 167 mph</td>
      <td>Approx. 6.0 hours</td>
    </tr>
    <tr>
      <td>N207HB</td>
      <td>Beechcraft King Air B200</td>
      <td>290 kts / 334 mph</td>
      <td>Approx. 5.4&ndash;7.0 hours, depending on cruise setting</td>
    </tr>
    <tr>
      <td>N2446X</td>
      <td>Cessna 206H Stationair</td>
      <td>142 kts / 163 mph</td>
      <td>Approx. 5.4 hours range-derived; WSP mission profile often listed at 6&ndash;8 hours</td>
    </tr>
    <tr>
      <td>N305DK</td>
      <td>Cessna 206H Stationair</td>
      <td>142 kts / 163 mph</td>
      <td>Approx. 5.4 hours range-derived; WSP mission profile often listed at 6&ndash;8 hours</td>
    </tr>
    <tr>
      <td>N305RC</td>
      <td>Cessna 182T Skylane</td>
      <td>145 ktas / 167 mph</td>
      <td>Approx. 6.0 hours</td>
    </tr>
    <tr>
      <td>N3532K</td>
      <td>Cessna 182T Skylane<br><small>Historical WSP aircraft; current FAA registry shows private ownership</small></td>
      <td>145 ktas / 167 mph</td>
      <td>Approx. 6.0 hours by aircraft type</td>
    </tr>
    <tr>
      <td>N407KS</td>
      <td>Bell 407</td>
      <td>133 kts / 153 mph max cruise</td>
      <td>Approx. 4.0 hours</td>
    </tr>
    <tr>
      <td>N411KS</td>
      <td>Bell 206B JetRanger<br><small>Former King County Sheriff aircraft; current FAA registry shows Northwest Helicopters</small></td>
      <td>118 kts / 136 mph</td>
      <td>Approx. 3.0&ndash;3.3 hours range-derived</td>
    </tr>
    <tr>
      <td>N67817</td>
      <td>Bell 206B / TH-67A type</td>
      <td>118 kts / 136 mph</td>
      <td>Approx. 3.0&ndash;3.3 hours range-derived</td>
    </tr>
    <tr>
      <td>N67880</td>
      <td>Bell 206B / TH-67A type</td>
      <td>118 kts / 136 mph</td>
      <td>Approx. 3.0&ndash;3.3 hours range-derived</td>
    </tr>
    <tr>
      <td>N78906</td>
      <td>Bell 206B / TH-67A type</td>
      <td>118 kts / 136 mph</td>
      <td>Approx. 3.0&ndash;3.3 hours range-derived</td>
    </tr>
    <tr>
      <td>N790RJ</td>
      <td>Bell UH-1H Huey</td>
      <td>117 kts / 135 mph</td>
      <td>Approx. 2.5 hours range-derived</td>
    </tr>
    <tr>
      <td>N815SC</td>
      <td>Bell UH-1H Huey</td>
      <td>117 kts / 135 mph</td>
      <td>Approx. 2.5 hours range-derived</td>
    </tr>
    <tr>
      <td>N9446P</td>
      <td>Cessna T206H Turbo Stationair</td>
      <td>161 ktas / 185 mph</td>
      <td>Approx. 4.4&ndash;5.0 hours range-derived</td>
    </tr>
    <tr>
      <td>N422CT</td>
      <td>Bell 407 / 407GXi</td>
      <td>133 kts / 153 mph max cruise</td>
      <td>Approx. 4.0 hours</td>
    </tr>
  </tbody>
</table>

<p>I'm not looking to create more criminals. This a fuck you to the policy makers that killed my best friend by implementing a panopticon around our hobby. Stay out of sight and stay safe.</p>

<p>LLC</p>
`;

export default function AboutPage() {
  return (
    <main
      className="ss-page-narrow"
      style={{
        minHeight: "100dvh",
        padding: "96px 18px 180px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
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
          textAlign: "center",
        }}
      >
        Take back your liberty
      </h1>

      <style>{`
        .ss-about-patrol {
          width: 100%;
          max-width: 840px;
          color: var(--ss-fg1);
          font-family: inherit;
          font-size: 15px;
          line-height: 1.65;
          text-align: left;
        }

        .ss-about-patrol p {
          margin: 0 0 18px;
        }

        .ss-about-patrol h2 {
          margin: 30px 0 14px;
          color: var(--ss-fg0);
          font-size: 24px;
          line-height: 1.15;
          letter-spacing: 0;
        }

        .ss-about-patrol a {
          color: var(--ss-alert);
          font-weight: 700;
        }

        .ss-about-patrol table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0 20px;
          background: var(--ss-bg1);
          border: .5px solid var(--ss-hairline);
          border-radius: 8px;
          overflow: hidden;
          font-size: 12px;
          line-height: 1.4;
        }

        .ss-about-patrol th,
        .ss-about-patrol td {
          padding: 9px 10px;
          border-bottom: .5px solid var(--ss-hairline);
          vertical-align: top;
        }

        .ss-about-patrol th {
          color: var(--ss-fg0);
          background: var(--ss-bg2);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .ss-about-patrol tr:last-child td {
          border-bottom: 0;
        }

        .ss-about-patrol small {
          color: var(--ss-fg2);
        }

        @media (max-width: 680px) {
          .ss-about-patrol {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .ss-about-patrol table {
            min-width: 680px;
          }
        }
      `}</style>

      <section
        className="ss-about-patrol"
        dangerouslySetInnerHTML={{ __html: ABOUT_PATROL_AIRCRAFT_HTML }}
      />
    </main>
  );
}
