// Tests for the WIN1920 DIRECT CHROME FARM rule on mymcptools
// (src/lib/analytics-classify.ts), ported from replacedbai 2ca5841.
//
// Run: npm run test:win1920-farm   (in verify:predeploy)
//
// Measured 2026-10-24 over analytics.events, site='mymcptools', 90d: 637
// matched sessions inside 10-18..10-21 (0.3% with a 2nd pageview), 934
// outside (0.1%), against 24.7% for Win/1920 sessions that do not match.

import fs from "node:fs";
import {
  detectBot,
  isWin1920DirectChromeFarm,
  WIN1920_DIRECT_CHROME_FARM_SQL,
  WIN1920_FARM_REASON,
} from "../src/lib/analytics-classify";

const win = (major: number) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
const EDGE_151 = `${win(151)} Edg/151.0.0.0`;
const MAC_151 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";
const hdr = () => new Headers({ "accept-language": "en-US,en;q=0.9" });
const OCT = new Date("2026-10-20T12:00:00Z");
const AUG = new Date("2026-08-20T12:00:00Z");

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}
const d = (ua: string, sw: number, ref: string | null | undefined, now = OCT) =>
  detectBot(ua, hdr(), sw, false, 8, now, ref);

// 1. The fleet is flagged, with its own reason.
for (const major of [144, 151]) {
  const r = d(win(major), 1920, null);
  check(`Windows Chrome/${major} at 1920, no referrer -> bot`, r.isBot, true);
  check(`...reason ${WIN1920_FARM_REASON}`, r.reason, WIN1920_FARM_REASON);
}

// 2. Real visitors one condition away are not.
check("Chrome/151 at 1920 from Google -> human", d(win(151), 1920, "https://www.google.com/").isBot, false);
check("Chrome/151 direct at 1536 -> human", d(win(151), 1536, null).isBot, false);
check("Chrome/151 direct at 2560 -> human", d(win(151), 2560, null).isBot, false);
check("Chrome/155 direct at 1920 -> human", d(win(155), 1920, null).isBot, false);
check("Chrome/150 direct at 1920 -> human", d(win(150), 1920, null).isBot, false);
check("Edge 151 direct at 1920 -> not this rule", isWin1920DirectChromeFarm(EDGE_151, 1920, null, OCT), false);
check("Mac Chrome/151 direct at 1920 -> not this rule", isWin1920DirectChromeFarm(MAC_151, 1920, null, OCT), false);
check("screen width as a string is not 1920", isWin1920DirectChromeFarm(win(144), "1920", null, OCT), false);
check("caller that cannot see the referrer (undefined) -> not this rule", d(win(144), 1920, undefined).isBot, false);
check("Chrome/151 in August, when it was the current build -> human", d(win(151), 1920, null, AUG).isBot, false);
check("Chrome/144 in August -> bot", d(win(144), 1920, null, AUG).isBot, true);

// 3. SQL twin carries the same conditions.
check("SQL pins both majors", /Chrome\/\(144\|151\)/.test(WIN1920_DIRECT_CHROME_FARM_SQL), true);
check("SQL pins screen_w = 1920", WIN1920_DIRECT_CHROME_FARM_SQL.includes("screen_w = 1920"), true);
check("SQL pins no referrer", WIN1920_DIRECT_CHROME_FARM_SQL.includes("referrer_full is null"), true);
check("SQL pins the 151 date", WIN1920_DIRECT_CHROME_FARM_SQL.includes("2026-09-22T00:00:00Z"), true);

// 4. The collector hands the referrer to the classifier.
{
  const src = fs.readFileSync(new URL("../src/app/api/collect/route.ts", import.meta.url), "utf8");
  check("collector passes referrerFull to detectBot", /detectBot\(ua, h, .*, referrerFull\);/.test(src), true);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
