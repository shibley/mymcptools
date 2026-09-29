// Tests for src/lib/analytics-classify.ts — who gets counted as a human on
// mymcptools.
//
// Run: npm run test:classify
//
// Shipped by research thread #335 (2026-09-28), which audited every collector
// in the portfolio against replacedbai's four post-2026-08-17 rules and found
// mymcptools carrying two of them. It ports the two that its OWN rows justify
// and refuses the one they do not:
//
//   stale-desktop-browser    PORTED — the cohort reaches /submit or /pricing
//                            at 3.17% (2/63) against 15.33% (258/1,683).
//   desktop-ua-mobile-screen PORTED — the shape of this repo's own 390x844
//                            eyes pass; 1-2 sessions/3d were being counted
//                            as strangers.
//   x11-direct               REFUSED — that cohort converts at 21.01%
//                            (29/138), 1.46x BETTER than the 14.37% it would
//                            leave behind. Flagging it deletes the audience.
//   full-chrome-version      already present since thread #220.

import { detectBot, staleBrowserCutoff, X11_DIRECT_SQL_NOT_APPLIED } from "../src/lib/analytics-classify";

const WIN_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const X11 =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const humanHeaders = () => new Headers({ "accept-language": "en-US,en;q=0.9" });
const NOW = new Date("2026-09-28T00:00:00Z");

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`,
  );
}

// 1. stale-desktop-browser.
{
  check("cutoff on 2026-09-28 is 132", staleBrowserCutoff(NOW), 132);
  const chrome = (m: number) =>
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${m}.0.0.0 Safari/537.36`;
  const firefox = (m: number) =>
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${m}.0) Gecko/20100101 Firefox/${m}.0`;

  for (const m of [118, 119, 120, 121, 131]) {
    check(`Chrome/${m} is stale`, detectBot(chrome(m), humanHeaders(), 1920, false, 10, NOW).reason?.includes("stale-desktop-browser"), true);
  }
  check("Firefox/121 is stale too", detectBot(firefox(121), humanHeaders(), 1920, false, 10, NOW).reason?.includes("stale-desktop-browser"), true);
  for (const m of [132, 140, 144]) {
    check(`Chrome/${m} is NOT stale`, detectBot(chrome(m), humanHeaders(), 1920, false, 10, NOW).isBot, false);
  }
  const ANDROID_OLD =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
  check("old Android WebView is exempt", detectBot(ANDROID_OLD, humanHeaders(), 412, false, 8, NOW).isBot, false);
}

// 2. desktop-ua-mobile-screen.
{
  for (const w of [390, 402, 414, 440, 699]) {
    check(`${w}px Macintosh is flagged`, detectBot(MAC_CHROME, humanHeaders(), w, false, 10, NOW).reason?.includes("desktop-ua-mobile-screen"), true);
  }
  check("a Windows laptop at exactly 700 is human", detectBot(WIN_CHROME, humanHeaders(), 700, false, 8, NOW).isBot, false);
  check("a real iPhone at 390 is human", detectBot(IPHONE, humanHeaders(), 390, false, 4, NOW).isBot, false);
}

// 3. x11-direct is REFUSED on this property — see the file header.
{
  check("X11 desktop Linux is still counted human", detectBot(X11, humanHeaders(), 1920, false, 8, NOW).isBot, false);
  check("...and no rule mentions x11", detectBot(X11, humanHeaders(), 1920, false, 8, NOW).reason, null);
  check("the predicate is exported for READS only", X11_DIRECT_SQL_NOT_APPLIED.includes("referrer_full is null"), true);
}

// 4. Nothing that used to be flagged stopped being flagged.
{
  check("a headless UA", detectBot("Mozilla/5.0 HeadlessChrome/140", humanHeaders(), 1920, false, 8, NOW).isBot, true);
  check("navigator.webdriver", detectBot(WIN_CHROME, humanHeaders(), 1920, true, 8, NOW).isBot, true);
  check("no user agent", detectBot(null, humanHeaders(), 1920, false, 8, NOW).isBot, true);
  check("no screen width", detectBot(WIN_CHROME, humanHeaders(), null, false, 8, NOW).isBot, true);
  check("no Accept-Language", detectBot(WIN_CHROME, new Headers(), 1920, false, 8, NOW).isBot, true);
  check("implausible core count", detectBot(WIN_CHROME, humanHeaders(), 1920, false, 0, NOW).isBot, true);
  check("a Tor exit country", detectBot(WIN_CHROME, new Headers({ "accept-language": "en", "x-vercel-ip-country": "T1" }), 1920, false, 8, NOW).isBot, true);
  check(
    "a full four-part desktop Chrome version",
    detectBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.175 Safari/537.36", humanHeaders(), 1920, false, 8, NOW).reason?.includes("full-chrome-version"),
    true,
  );
  check("a real Mac at 1920 is human", detectBot(MAC_CHROME, humanHeaders(), 1920, false, 10, NOW).isBot, false);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
