/**
 * Who counts as a human in analytics.events on mymcptools.
 *
 * Lifted out of src/app/api/collect/route.ts on 2026-09-28 (research thread
 * #335) for two reasons: a Next.js route.ts may only export route fields, so
 * the rules could not be exported for a test from where they lived; and the
 * rules can be tested without standing up a Postgres pool.
 *
 * THREAD #335 MEASURED EVERY RULE AGAINST THIS PROPERTY'S OWN ROWS BEFORE
 * PORTING IT. That is the point of the file: `x11-direct` passes on
 * ratedwithai and apistatuscheck and FAILS here, with the sign reversed.
 */
// Chrome reduced its User-Agent to a MAJOR.0.0.0 form in v110 — every real
// desktop Chrome reports Chrome/142.0.0.0, never Chrome/142.0.7444.175. A full
// four-part version on a desktop platform is an automation fleet that pinned an
// exact build. Shipped on replacedbai by thread #213 and on aisotools since.
// `x11-direct` is deliberately NOT ported, and as of thread #335 (2026-09-28)
// that is a MEASURED decision rather than a plumbing excuse. On mymcptools'
// own rows the X11-direct cohort converts the WRONG WAY: over the 90 days to
// 2026-09-28 it reaches /submit or /pricing at 21.01% (29 of 138) against
// 14.37% (231 of 1,608) for everything the rule would keep. Its referred-vs-
// direct lift is 1.9x (7.64% of referred sessions are X11 against 14.42% of
// direct), where the rule needs ~15x to be safe — replacedbai reads 17x and
// apistatuscheck 14.6x. Flagging it here would delete this property's
// best-converting cohort. See thread #329: the agent traffic IS the audience.
// ⛔ Do not port `x11-direct` here without re-running that 21.01%.
const DESKTOP_PLATFORM = /Windows NT|Macintosh|X11/;
const MOBILE_UA = /Mobile|Android/;
const FULL_CHROME_VERSION = /Chrome\/\d+\./;
const REDUCED_CHROME_VERSION = /Chrome\/\d+\.0\.0\.0/;
const STALE_CHROME = /Chrome\/75\.0\.377/;
const X11_LINUX = /X11; Linux x86_64/;

/**
 * Narrowest screen width a real desktop-platform device reports. The smallest
 * Macs ever shipped 1280; the smallest Windows tablets that send a desktop UA
 * report 800. 700 sits under every real device and above every phone viewport
 * an emulator is set to (390/402/414/440).
 */
const MIN_DESKTOP_SCREEN_WIDTH = 700;

/**
 * STALE DESKTOP BROWSER — ported from replacedbai 2026-09-28 (thread #335)
 * AFTER measuring it on mymcptools' own traffic.
 *
 * Desktop Chrome and Firefox both ship a major every ~28 days and update
 * themselves, so a two-year-old build on a desktop platform is a farm that
 * pinned one. Anchored on Chrome 120 / 2023-12-05 with a 24-major (~2 year) lag.
 *
 * MEASURED HERE BEFORE PORTING (90 days to 2026-09-28, analytics.events,
 * site='mymcptools'): the cohort reaches /submit or /pricing at 3.17% (2 of 63)
 * against 15.33% (258 of 1,683) for everything it keeps — 4.8x worse, the same
 * sign as replacedbai, apistatuscheck and aisotools, and the OPPOSITE sign to
 * `x11-direct` above. Current-state gap on the 3 days to 2026-09-28: 5 sessions,
 * 2.26% of the 221 this property counted human.
 */
const RELEASE_ANCHOR_MAJOR = 120;
const RELEASE_ANCHOR_MS = Date.UTC(2023, 11, 5);
const RELEASE_CADENCE_DAYS = 28;
const STALE_MAJOR_LAG = 24;
const DESKTOP_ENGINE_MAJOR = /(?:Chrome|Firefox)\/(\d+)/;

/** Oldest desktop Chrome/Firefox major still counted as human on `now`. */
export function staleBrowserCutoff(now: Date): number {
  const cycles = Math.floor((now.getTime() - RELEASE_ANCHOR_MS) / (RELEASE_CADENCE_DAYS * 86_400_000));
  return RELEASE_ANCHOR_MAJOR + cycles - STALE_MAJOR_LAG;
}




/**
 * Known non-human user agents. Substring match, lowercased.
 *
 * This is the BROWSER list and is deliberately stricter than
 * `CRAWLER_UA` in src/lib/analytics/mcp-usage.ts: `python-requests`, `axios`
 * and `curl` are how an agent legitimately speaks to /api/mcp, but on the web
 * surface they are never a human reading a page.
 */
const BOT_UA = [
  "bot", "crawl", "spider", "slurp", "scrap", "fetcher", "monitor", "preview",
  "headless", "phantomjs", "puppeteer", "playwright", "selenium", "webdriver",
  "python-requests", "python-urllib", "aiohttp", "httpx", "axios", "go-http-client",
  "java/", "okhttp", "curl/", "wget/", "libwww", "lighthouse", "pagespeed",
  "gptbot", "oai-searchbot", "chatgpt-user", "claudebot", "claude-web", "anthropic-ai",
  "ccbot", "perplexitybot", "bytespider", "amazonbot", "applebot", "google-extended",
  "ahrefs", "semrush", "mj12", "dotbot", "dataforseo", "petalbot", "yandex",
  "baiduspider", "facebookexternalhit", "embedly", "quora link preview",
  "skypeuripreview", "whatsapp", "telegrambot", "discordbot", "slackbot",
];

export type Detect = { isBot: boolean; reason: string | null };

export function detectBot(
  ua: string | null,
  h: Headers,
  sw: unknown,
  wd: unknown,
  hc: unknown,
  now: Date = new Date(),
): Detect {
  const reasons: string[] = [];
  const lc = (ua || "").toLowerCase();

  if (!lc) {
    reasons.push("no-ua");
  } else {
    const hit = BOT_UA.find((b) => lc.includes(b));
    if (hit) reasons.push(`ua:${hit}`);
  }

  // navigator.webdriver — set by every mainstream automation driver unless
  // explicitly patched out.
  if (wd === true) reasons.push("webdriver");

  // Real browsers always report a plausible screen width.
  if (sw === null || sw === undefined) reasons.push("no-screen");
  else if (typeof sw !== "number" || !Number.isFinite(sw) || sw < 200 || sw > 10000) {
    reasons.push("implausible-screen");
  }

  // Human browsers send Accept-Language; most scripted clients do not.
  if (!h.get("accept-language")) reasons.push("no-accept-language");

  // Headless Chrome commonly reports 0 or absurd core counts.
  if (typeof hc === "number" && (hc === 0 || hc > 128)) reasons.push("implausible-cores");

  // Datacenter-ish signal available from the edge without an IP database.
  if (h.get("x-vercel-ip-country") === "T1") reasons.push("tor-exit");

  if (ua) {
    if (
      DESKTOP_PLATFORM.test(ua) &&
      !MOBILE_UA.test(ua) &&
      FULL_CHROME_VERSION.test(ua) &&
      !REDUCED_CHROME_VERSION.test(ua)
    ) {
      reasons.push("full-chrome-version");
    }

    if (STALE_CHROME.test(ua)) reasons.push("stale-chrome-75");

    if (DESKTOP_PLATFORM.test(ua) && !MOBILE_UA.test(ua)) {
      const major = Number(ua.match(DESKTOP_ENGINE_MAJOR)?.[1]);
      if (Number.isFinite(major) && major > 0 && major < staleBrowserCutoff(now)) {
        reasons.push("stale-desktop-browser");
      }
    }

    // A desktop platform cannot own a phone-sized SCREEN. The backstop for an
    // emulated viewport whose driver patched navigator.webdriver out — which is
    // the exact shape of this repo's own mandatory 390x844 eyes pass.
    if (
      DESKTOP_PLATFORM.test(ua) &&
      !MOBILE_UA.test(ua) &&
      typeof sw === "number" &&
      Number.isFinite(sw) &&
      sw >= 200 &&
      sw < MIN_DESKTOP_SCREEN_WIDTH
    ) {
      reasons.push("desktop-ua-mobile-screen");
    }
  }

  return { isBot: reasons.length > 0, reason: reasons.length ? reasons.join(",") : null };
}


/**
 * The stale-desktop-browser predicate as SQL, evaluated against each row's own
 * `ts` so a retro-pass judges a July row by July's cutoff. `is_bot` is stamped
 * at write time and never backfilled, so any window reaching back past the
 * deploy must add this to its WHERE clause.
 */
export const STALE_DESKTOP_BROWSER_SQL = `ua ~ '(Macintosh|Windows NT|X11)' and ua !~ '(Mobile|Android)' and substring(ua from '(?:Chrome|Firefox)/([0-9]+)') is not null and substring(ua from '(?:Chrome|Firefox)/([0-9]+)')::int < ${RELEASE_ANCHOR_MAJOR} + floor(extract(epoch from (ts - timestamptz '2023-12-05 00:00:00+00')) / ${RELEASE_CADENCE_DAYS * 86400})::int - ${STALE_MAJOR_LAG}`;

/** The desktop-ua-mobile-screen predicate as SQL, same purpose. */
export const DESKTOP_UA_MOBILE_SCREEN_SQL = `ua ~ '(Macintosh|Windows NT|X11)' and ua !~ '(Mobile|Android)' and screen_w is not null and screen_w >= 200 and screen_w < ${MIN_DESKTOP_SCREEN_WIDTH}`;

/**
 * The `x11-direct` predicate — provided for READS only, never applied at write
 * time here. See the note at the head of this file: on mymcptools this cohort
 * converts 1.46x BETTER than the traffic it would remove (21.01% vs 14.37%
 * over the 90 days to 2026-09-28), so it is kept as human on purpose.
 */
export const X11_DIRECT_SQL_NOT_APPLIED = `ua ~ 'X11; Linux x86_64' and referrer_full is null`;
