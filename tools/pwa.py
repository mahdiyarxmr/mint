#!/usr/bin/env python3
"""Prove the PWA works in a real browser: worker registers, assets get cached,
and the site still renders with the network cut off."""
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
issues = []


def check(cond, label, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + label + (f"  :: {detail}" if detail and not cond else ""))
    if not cond:
        issues.append(label)


def main():
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = br.new_context(viewport={"width": 390, "height": 844},
                             is_mobile=True, has_touch=True, locale="fa")
        ctx.add_cookies([{"name": "mint_lang", "value": "fa",
                          "domain": "localhost", "path": "/"}])
        page = ctx.new_page()

        # ---- manifest is linked and parseable by the browser ----
        page.goto(BASE + "/", wait_until="networkidle")
        href = page.get_attribute('link[rel=manifest]', 'href')
        check(href == "/manifest.webmanifest", "manifest is linked", str(href))

        man = page.evaluate("""async () => {
            const r = await fetch('/manifest.webmanifest');
            return { status: r.status, type: r.headers.get('content-type'), body: await r.json() };
        }""")
        check(man["status"] == 200, "manifest fetches", str(man["status"]))
        check("manifest+json" in (man["type"] or ""), "manifest content-type", man["type"])
        m = man["body"]
        check(m.get("display") == "standalone", "display: standalone", m.get("display"))
        check(m.get("start_url", "").startswith("/"), "start_url set", m.get("start_url"))
        check(m.get("theme_color") == "#05081F", "theme colour matches the site", m.get("theme_color"))
        sizes = {i["sizes"] for i in m.get("icons", [])}
        check("192x192" in sizes and "512x512" in sizes,
              "192 and 512 icons declared (installability minimum)", str(sizes))
        check(any(i.get("purpose") == "maskable" for i in m.get("icons", [])),
              "a maskable icon is declared")

        # ---- service worker registers and takes control ----
        page.goto(BASE + "/", wait_until="networkidle")
        state = page.evaluate("""async () => {
            const reg = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            return { scope: reg.scope, active: !!reg.active };
        }""")
        check(state["active"], "service worker becomes active")
        check(state["scope"].endswith("/"), "worker scope is the whole origin", state["scope"])

        # ---- it caches what it promised ----
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1200)
        cached = page.evaluate("""async () => {
            const names = await caches.keys();
            const out = {};
            for (const n of names) {
                const c = await caches.open(n);
                out[n] = (await c.keys()).map(r => new URL(r.url).pathname);
            }
            return out;
        }""")
        allpaths = [p for v in cached.values() for p in v]
        print("        caches:", {k: len(v) for k, v in cached.items()})
        check("/css/mint.css" in allpaths, "stylesheet is cached")
        check("/offline" in allpaths, "offline page is precached")
        check(any(p.startswith("/fonts/") for p in allpaths), "fonts are cached")
        check(any(p.startswith("/img/brand/") for p in allpaths), "brand art is cached")

        # ---- API and auth must never be cached ----
        page.evaluate("fetch('/api/search?q=phone')")
        page.wait_for_timeout(600)
        after = page.evaluate("""async () => {
            const names = await caches.keys(); const out = [];
            for (const n of names) { const c = await caches.open(n);
                out.push(...(await c.keys()).map(r => new URL(r.url).pathname)); }
            return out;
        }""")
        check(not any(p.startswith("/api/") for p in after),
              "API responses are never cached",
              str([p for p in after if p.startswith("/api/")]))
        check("/login" not in after, "auth routes are never cached")

        # ---- the real test: pull the network and reload ----
        page.goto(BASE + "/templates", wait_until="networkidle")
        page.wait_for_timeout(800)
        ctx.set_offline(True)
        try:
            page.reload(wait_until="domcontentloaded", timeout=15000)
            body = page.inner_text("body")
            ok = len(body.strip()) > 80
            check(ok, "a visited page still renders offline", body[:60])
            styled = page.evaluate(
                "getComputedStyle(document.body).backgroundColor")
            check(styled not in ("", "rgba(0, 0, 0, 0)"),
                  "stylesheet still applies offline", styled)
        except Exception as e:
            check(False, "a visited page still renders offline", str(e)[:80])

        # an unvisited page should land on the offline fallback, not a browser error
        try:
            page.goto(BASE + "/licenses", wait_until="domcontentloaded", timeout=15000)
            txt = page.inner_text("body")
            check("آفلاین" in txt or "offline" in txt.lower() or len(txt.strip()) > 80,
                  "an unvisited page falls back to the offline screen", txt[:60])
        except Exception as e:
            check(False, "an unvisited page falls back to the offline screen", str(e)[:80])

        ctx.set_offline(False)
        br.close()

    print(f"\nISSUES: {len(issues)}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
