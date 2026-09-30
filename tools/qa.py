#!/usr/bin/env python3
"""Mint full-site QA crawler.

Every route x locale x viewport, signed in AND signed out.
Fails on console errors, page errors, HTTP >= 400, broken images,
and untranslated Latin text leaking into the Persian UI.

    python3 tools/qa.py
"""
import json, re, sys, urllib.request, urllib.parse, http.cookiejar
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

PUBLIC = ["/", "/templates", "/explore", "/marketplace", "/pricing",
          "/help", "/legal", "/login", "/login?mode=signup", "/leaderboard"]
PRIVATE = ["/dashboard", "/projects", "/editor", "/ai-studio", "/profile",
           "/collections", "/achievements", "/notifications", "/downloads",
           "/purchases", "/settings"]
ADMIN = ["/admin", "/admin?tab=users", "/admin?tab=users&q=yuki", "/admin?tab=announce",
         "/admin?tab=settings"]
QUERY = ["/templates?sort=popular", "/templates?cat=phone-case", "/explore?tag=Anime",
         "/marketplace?sort=new", "/editor?device=xbox", "/editor?device=keyboard",
         "/ai-studio?style=Cyberpunk", "/login?error=bad", "/login?mode=signup&error=taken"]

# Latin tokens that are legitimately Latin inside Persian copy.
# They are stripped out first; anything Latin still left over is a real leak.
ALLOWED_TOKENS = re.compile(
    r"\b(Mint|EN|English|PSD|TIFF|PNG|JPG|JPEG|SVG|PDF|WEBP|GIF|AI|HD|4K|8K|RGB|CMYK|"
    r"PRO|STUDIO|FREE|PACK|PREMIUM|NEW|HOT|Pro|Studio|Free|New|"
    r"Google|Discord|Apple|Figma|Photoshop|Illustrator|Xbox|PlayStation|Windows|macOS|"
    r"admin|Admin|API|URL|ID|CDN|SLA|ms|KB|MB|Toman|TKL|ANSI|ISO|USB|"
    r"[Pp]ollinations|[Cc]loudflare|Hugging ?Face|huggingface|OpenAI|openai|flux|turbo|sana|"
    r"[A-Za-z][\w.+-]*@[\w.-]+\.[A-Za-z]{2,}|https?://\S+|[\w-]+\.(?:ai|design|com|org|io|dev))\b")


def has_latin_leak(text: str) -> bool:
    rest = ALLOWED_TOKENS.sub(" ", text)
    return bool(re.search(r"[A-Za-z]{2,}", rest))


def login(user, pw):
    """Return the mint_sid cookie value for a user."""
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar),
                                     urllib.request.HTTPRedirectHandler())
    data = urllib.parse.urlencode({"login": user, "password": pw}).encode()
    op.open(BASE + "/login", data)
    for c in jar:
        if c.name == "mint_sid":
            return c.value
    raise SystemExit(f"login failed for {user}")


BRAND_ASSETS = [
    "/img/brand/mark-96.png", "/img/brand/mark-192.png",
    "/img/brand/wordmark.png", "/img/brand/wordmark-2x.png",
    "/img/brand/favicon-32.png", "/img/brand/favicon-16.png", "/img/brand/favicon-48.png",
    "/img/brand/apple-touch-icon.png", "/img/brand/og.png", "/img/brand/lockup.png",
]


def check_brand(br, issues):
    """The logo files must exist and the header must really use them."""
    ctx = br.new_context(viewport=dict(width=1440, height=940))
    page = ctx.new_page()
    for path in BRAND_ASSETS:
        r = page.request.get(BASE + path)
        if r.status != 200:
            issues.append(f"[brand] {path} :: HTTP {r.status}")
        elif len(r.body()) < 200:
            issues.append(f"[brand] {path} :: suspiciously small")
    page.goto(BASE + "/", wait_until="networkidle")
    if page.locator("header .logo img.mark").count() == 0:
        issues.append("[brand] header :: emblem missing")
    word = page.locator("header .logo img.wordmark").first
    if page.locator("header .logo img.wordmark").count() == 0:
        issues.append("[brand] header :: wordmark missing")
    elif (word.get_attribute("alt") or "").strip() != "Mint":
        issues.append("[brand] header :: wordmark alt must be 'Mint'")
    # the lockup must not be mirrored by RTL
    if page.evaluate("getComputedStyle(document.querySelector('.logo')).direction") != "ltr":
        issues.append("[brand] header :: logo direction must stay ltr")
    for b in page.evaluate(
            "Array.from(document.images).filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)"):
        issues.append(f"[brand] decode failed :: {b[:110]}")
    ctx.close()


def main():
    issues, loads, links = [], 0, set()
    admin_sid = login("admin", "admin123")

    with sync_playwright() as pw:
        br = pw.chromium.launch()

        def sweep(routes, sid, tagname):
            nonlocal loads
            for lang in ("fa", "en"):
                for vp, mobile in ((dict(width=1440, height=940), False),
                                   (dict(width=390, height=844), True)):
                    ctx = br.new_context(viewport=vp, is_mobile=mobile,
                                         has_touch=mobile, locale=lang)
                    cookies = [{"name": "mint_lang", "value": lang,
                                "domain": "localhost", "path": "/"}]
                    if sid:
                        cookies.append({"name": "mint_sid", "value": sid,
                                        "domain": "localhost", "path": "/"})
                    ctx.add_cookies(cookies)
                    page = ctx.new_page()
                    where = {"r": ""}

                    page.on("console", lambda m: m.type == "error" and
                            issues.append(f"[console] {tagname} {where['r']} :: {m.text[:160]}"))
                    page.on("pageerror", lambda e:
                            issues.append(f"[pageerror] {tagname} {where['r']} :: {str(e)[:160]}"))
                    page.on("response", lambda r: r.status >= 400 and
                            issues.append(f"[http {r.status}] {tagname} {where['r']} :: {r.url[:120]}"))

                    for r in routes:
                        where["r"] = f"{r} {lang} {'mob' if mobile else 'desk'}"
                        try:
                            resp = page.goto(BASE + r, wait_until="networkidle", timeout=30000)
                            loads += 1
                            if resp and resp.status >= 400:
                                issues.append(f"[status {resp.status}] {tagname} {where['r']}")
                            page.evaluate(
                                "document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'))")
                            bad = page.evaluate(
                                "[...document.images].filter(i=>i.complete&&i.naturalWidth===0)"
                                ".map(i=>i.currentSrc||i.src)")
                            for b in bad:
                                issues.append(f"[img] {tagname} {where['r']} :: {b[:110]}")
                            for h in page.evaluate(
                                    "[...document.querySelectorAll('a[href^=\"/\"]')].map(a=>a.getAttribute('href'))"):
                                links.add(h)
                            if lang == "fa":
                                leaks = page.evaluate("""() => {
                                  const out=[];
                                  const skip=new Set(['SCRIPT','STYLE','CODE','PRE','SVG','PATH','TEXT','OPTION']);
                                  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
                                  let n; while(n=w.nextNode()){
                                    const p=n.parentElement;
                                    if(!p||skip.has(p.tagName)) continue;
                                    if(p.closest('.ltr,.price,.mono,code,pre,svg,.avatar,.uav,.stars,.seller')) continue;
                                    const t=n.textContent.trim();
                                    if(t && /[A-Za-z]{2,}/.test(t)) out.push(t.slice(0,60));
                                  } return [...new Set(out)];
                                }""")
                                for t in leaks:
                                    if re.fullmatch(r"[a-z]{2,4}\.[A-Za-z][\w.]*", t.strip()):
                                        issues.append(f"[i18nkey] {where['r']} :: {t}")
                                        continue
                                    if has_latin_leak(t):
                                        issues.append(f"[i18n] {where['r']} :: {t}")
                        except Exception as e:
                            issues.append(f"[crash] {tagname} {where['r']} :: {str(e)[:150]}")
                    ctx.close()

        check_brand(br, issues)
        sweep(PUBLIC, None, "anon")
        sweep(PUBLIC + PRIVATE + QUERY, admin_sid, "auth")
        sweep(ADMIN, admin_sid, "admin")
        br.close()

    json.dump(sorted(links), open("/tmp/links.json", "w"), indent=1)
    print(f"page loads      : {loads}")
    print(f"internal links  : {len(links)} (written to /tmp/links.json)")
    from collections import Counter
    cats = Counter(re.match(r"\[([a-z0-9 ]+)\]", i).group(1).split()[0] for i in issues)
    if cats:
        print("by kind        :", dict(cats))
    for i in issues[:50]:
        print("  " + i)
    print(f"ISSUES: {len(issues)}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
