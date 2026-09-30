#!/usr/bin/env python3
"""Mobile audit: find real layout faults at phone width, not guesses.

Checks every route on a 390x844 phone for
  - horizontal overflow (the page scrolls sideways)
  - individual elements wider than the viewport
  - tap targets below 40px
  - text smaller than 12px
  - fixed/sticky elements that eat the screen
"""
import json
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

PUBLIC = ["/", "/templates", "/marketplace", "/explore", "/ai-studio", "/pricing",
          "/help", "/terms", "/privacy", "/licenses", "/login", "/leaderboard"]
PRIVATE = ["/dashboard", "/projects", "/collections", "/achievements", "/notifications",
           "/downloads", "/purchases", "/settings", "/profile", "/editor"]
ADMIN = ["/admin", "/admin?tab=users", "/admin?tab=announce", "/admin?tab=settings"]

DEVICES = [("iPhone SE", 375, 667), ("iPhone 12", 390, 844), ("Pixel 5", 393, 851)]


def login(user, pw):
    req = urllib.request.Request(
        BASE + "/login",
        data=json.dumps({"login": user, "password": pw}).encode(),
        headers={"Content-Type": "application/json"})
    jar = []
    op = urllib.request.build_opener(
        type("H", (urllib.request.HTTPRedirectHandler,), {
            "http_response": lambda s, rq, r: (jar.extend(r.headers.get_all("Set-Cookie") or []), r)[1],
            "https_response": lambda s, rq, r: (jar.extend(r.headers.get_all("Set-Cookie") or []), r)[1],
        })())
    try:
        op.open(req)
    except Exception:
        pass
    for c in jar:
        if c.startswith("mint_sid="):
            return c.split(";")[0].split("=", 1)[1]
    return None


AUDIT_JS = """
() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollW: document.documentElement.scrollWidth, wide: [], small: [], tiny: [] };
  const seen = new Set();
  const label = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (typeof el.className === 'string' && el.className)
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  // an element inside a deliberate horizontal scroller (table wrap, chip strip)
  // is not a layout fault - it is reachable by swiping
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetParent && cs.position !== 'fixed') {
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    // element sticking out past the right/left edge
    if ((r.width > vw + 1 || r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
      const k = 'w:' + label(el);
      if (!seen.has(k)) {
        seen.add(k);
        out.wide.push({ el: label(el), w: Math.round(r.width), left: Math.round(r.left),
                        right: Math.round(r.right) });
      }
    }
    // tap targets
    // WCAG 2.5.8 exempts a target that sits inside a sentence, so an inline
    // link in prose is not a fault - enlarging it would break the line box.
    const inProse = el.tagName === 'A' && el.parentElement &&
      /^(P|LI|SMALL|SPAN|TD|H[1-6])$/.test(el.parentElement.tagName) &&
      el.parentElement.textContent.trim().length > el.textContent.trim().length + 8;
    const tappable = el.matches('a, button, [role=button], input[type=submit], .btn, select')
                  && !el.closest('.logo') && !inScroller(el) && !inProse;
    if (tappable && r.width > 0 && (r.height < 39.5 || r.width < 31.5)) {
      const k = 't:' + label(el);
      if (!seen.has(k)) {
        seen.add(k);
        out.small.push({ el: label(el), h: Math.round(r.height), w: Math.round(r.width),
                         text: (el.innerText || '').trim().slice(0, 24) });
      }
    }
    // unreadable text
    const fs = parseFloat(cs.fontSize);
    if (fs && fs < 12 && el.innerText && el.innerText.trim().length > 2 && el.children.length === 0) {
      const k = 'f:' + label(el);
      if (!seen.has(k)) {
        seen.add(k);
        out.tiny.push({ el: label(el), px: fs, text: el.innerText.trim().slice(0, 24) });
      }
    }
  }
  return out;
}
"""


def main():
    sid = login("admin", "admin123")
    issues = []
    checked = 0

    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for dev, w, h in DEVICES:
            for lang in ("fa", "en"):
                ctx = br.new_context(viewport={"width": w, "height": h},
                                     is_mobile=True, has_touch=True,
                                     device_scale_factor=2, locale=lang)
                cookies = [{"name": "mint_lang", "value": lang,
                            "domain": "localhost", "path": "/"}]
                if sid:
                    cookies.append({"name": "mint_sid", "value": sid,
                                    "domain": "localhost", "path": "/"})
                ctx.add_cookies(cookies)
                page = ctx.new_page()
                for route in PUBLIC + PRIVATE + ADMIN:
                    try:
                        page.goto(BASE + route, wait_until="networkidle", timeout=30000)
                        page.wait_for_timeout(120)
                        r = page.evaluate(AUDIT_JS)
                    except Exception as e:
                        issues.append(f"[crash] {dev} {lang} {route} :: {str(e)[:90]}")
                        continue
                    checked += 1
                    tag = f"{dev} {lang} {route}"
                    if r["scrollW"] > r["vw"] + 1:
                        issues.append(
                            f"[hscroll] {tag} :: page scrolls sideways "
                            f"({r['scrollW']}px in a {r['vw']}px viewport)")
                    for e in r["wide"][:4]:
                        issues.append(
                            f"[overflow] {tag} :: {e['el']} is {e['w']}px "
                            f"(left {e['left']}, right {e['right']})")
                    for e in r["small"][:4]:
                        issues.append(
                            f"[tap] {tag} :: {e['el']} {e['w']}x{e['h']}px \"{e['text']}\"")
                    for e in r["tiny"][:3]:
                        issues.append(f"[font] {tag} :: {e['el']} {e['px']}px \"{e['text']}\"")
                ctx.close()
        br.close()

    from collections import Counter
    kinds = Counter(i.split("]")[0][1:] for i in issues)
    print(f"checked        : {checked} page renders")
    if kinds:
        print("by kind        :", dict(kinds))
    for i in issues[:60]:
        print("  " + i)
    if len(issues) > 60:
        print(f"  … and {len(issues) - 60} more")
    print(f"ISSUES: {len(issues)}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
