/**
 * DOOR LANDING WALK — does a maker-door press land ON the filled form?
 * Every door (submit-ack, submit-success, queue-status, server-page) links to
 * /submit?...#form. Renders that URL at the 360px Android viewport the one
 * queue-status door arrival used (2026-10-10, Gmail app) and asserts the form
 * card's top is on screen AND a "Continue to Checkout" press is inside the
 * first viewport (the mail promises "one step to checkout"). Probe identity,
 * beacon blocked; nothing is submitted.
 *
 * Run: node scripts/door-landing-walk.mjs [baseUrl]   (default https://mymcptools.com)
 * Exit 0 = form card + $9 press in the first viewport; 1 = not.
 */
import { chromium } from "playwright";

const base = (process.argv[2] || "https://mymcptools.com").replace(/\/+$/, "");
const sp = new URLSearchParams({
  probe: "1", tier: "featured", from: "queue-status", name: "Funnel Probe MCP Server",
  description: "Probe listing for the door landing walk. Not a real server; never submitted.",
  github: "https://github.com/modelcontextprotocol/servers", category: "api", install: "pip",
  email: "funnel-probe+door-walk@apistatuscheck.com", utm_source: "probe", utm_medium: "probe",
});
const url = `${base}/submit?${sp}#form`;

const b = await chromium.launch();
const p = await b.newPage({
  viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 funnel-probe",
});
await p.route(/\/api\/(beacon|analytics|track|events)/, (r) => r.abort());
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const card = document.querySelector("[data-form-card]") || document.getElementById("form")?.parentElement;
  // Any submit control for the form, in DOM order: <form> children or form="form".
  const btns = [...document.querySelectorAll("button[type=submit]")].filter((x) => x.form?.id === "form");
  const btn = btns.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
  const name = document.querySelector("form#form [name=name]");
  return {
    scrollY: Math.round(scrollY),
    cardTop: Math.round(card.getBoundingClientRect().top),
    buttonTop: Math.round(btn.getBoundingClientRect().top),
    buttonText: btn.textContent.trim(),
    nameValue: name.value,
    vh: innerHeight,
  };
});
await b.close();
const ok = r.cardTop >= 0 && r.cardTop < r.vh / 2 && r.buttonTop + 44 <= r.vh && /Checkout — \$9/.test(r.buttonText) && r.nameValue === "Funnel Probe MCP Server";
console.log(`${base}  scrollY=${r.scrollY} formCardTop=${r.cardTop}px firstCheckoutButtonTop=${r.buttonTop}px (viewport ${r.vh}) "${r.buttonText}" prefilled=${r.nameValue === "Funnel Probe MCP Server"}`);
console.log(ok ? "PASS: door lands on the filled form" : "FAIL: door lands off the form");
process.exit(ok ? 0 : 1);
