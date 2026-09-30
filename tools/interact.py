#!/usr/bin/env python3
"""Mint interaction tests — drives the real UI, not just the HTML.

Covers auth, coins, announcements, the admin console, the device-aware
AI studio and the editor. Run the server first, then:

    python3 tools/interact.py
"""
import re, sys, urllib.request, urllib.parse, http.cookiejar
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
issues, passed = [], []


def check(name, cond, detail=""):
    (passed if cond else issues).append(f"{name}{' :: ' + detail if detail else ''}")
    print(("  PASS  " if cond else "  FAIL  ") + name + (f"  [{detail}]" if detail else ""))


def sid_for(user, pw):
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    op.open(BASE + "/login", urllib.parse.urlencode({"login": user, "password": pw}).encode())
    return next((c.value for c in jar if c.name == "mint_sid"), None)


def ctx_for(br, sid=None, lang="fa", mobile=False):
    vp = dict(width=390, height=844) if mobile else dict(width=1440, height=940)
    c = br.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile)
    cookies = [{"name": "mint_lang", "value": lang, "domain": "localhost", "path": "/"}]
    if sid:
        cookies.append({"name": "mint_sid", "value": sid, "domain": "localhost", "path": "/"})
    c.add_cookies(cookies)
    return c


def main():
    with sync_playwright() as pw:
        br = pw.chromium.launch()

        # ---------------------------------------------------------- 1. login UI
        print("\n— auth —")
        c = br.new_context(viewport=dict(width=1440, height=940))
        c.add_cookies([{"name": "mint_lang", "value": "fa", "domain": "localhost", "path": "/"}])
        p = c.new_page()
        p.goto(BASE + "/dashboard", wait_until="networkidle")
        check("guard redirects to /login", "/login" in p.url, p.url.split(BASE)[-1])

        p.fill("#ae", "admin")
        p.fill("#ap", "wrongpass")
        p.click("button[type=submit]")
        p.wait_for_load_state("networkidle")
        check("wrong password shows error", p.locator(".autherr").count() == 1,
              p.locator(".autherr").inner_text().strip()[:40] if p.locator(".autherr").count() else "")

        p.click("#pwToggle")
        check("password reveal toggles", p.get_attribute("#ap", "type") == "text")

        p.fill("#ae", "admin")
        p.fill("#ap", "admin123")
        p.click("button[type=submit]")
        p.wait_for_load_state("networkidle")
        check("admin/admin123 signs in", "/dashboard" in p.url, p.url.split(BASE)[-1])
        check("coin pill in header", p.locator(".coinpill").count() == 1,
              p.locator(".coinpill b").inner_text() if p.locator(".coinpill").count() else "")
        check("admin shield visible", p.locator('a[href="/admin"]').count() >= 1)

        # ------------------------------------------------- 2. announcement banner
        print("\n— announcements —")
        p.goto(BASE + "/", wait_until="networkidle")
        n0 = p.locator(".ann").count()
        check("banner renders site-wide", n0 >= 1, f"{n0} shown")
        if n0:
            p.locator(".ann .js-ann-x").first.click()
            p.wait_for_timeout(500)
            check("banner dismisses", p.locator(".ann").count() == n0 - 1)
            p.reload(wait_until="networkidle")
            check("dismissal persists across reload", p.locator(".ann").count() == n0 - 1)

        # ------------------------------------------------------- 3. admin console
        print("\n— admin console —")
        p.goto(BASE + "/admin?tab=users", wait_until="networkidle")
        rows = p.locator("tr[data-uid]").count()
        check("user table lists accounts", rows >= 5, f"{rows} rows")

        p.fill('input[name="q"]', "yuki")
        p.click('form[action="/admin"] button[type=submit]')
        p.wait_for_load_state("networkidle")
        found = p.locator("tr[data-uid]").count()
        check("user search filters", found == 1, f"{found} row for 'yuki'")

        p.goto(BASE + "/admin?tab=users&q=bitcrush", wait_until="networkidle")
        before = p.locator("tr[data-uid] .js-coins").first.inner_text()
        p.locator(".js-pick").first.click()
        check("selecting a user arms the grant box",
              p.locator("#gTarget").inner_text().strip() == "bitcrush",
              p.locator("#gTarget").inner_text())
        p.fill("#gCoins", "250")
        p.click('.grantbox [data-act="coins"]')
        p.wait_for_timeout(900)
        after = p.locator("tr[data-uid] .js-coins").first.inner_text()
        check("gifting coins updates the row live", before != after, f"{before} -> {after}")

        cred_before = p.locator("tr[data-uid] .js-credits").first.inner_text()
        p.fill("#gCred", "40")
        p.click('.grantbox [data-act="credits"]')
        p.wait_for_timeout(1200)
        cred_after = p.locator("tr[data-uid] .js-credits").first.inner_text()
        check("granting credits updates the row", cred_before != cred_after,
              f"{cred_before} -> {cred_after}")

        p.goto(BASE + "/admin?tab=announce", wait_until="networkidle")
        a0 = p.locator("[data-aid]").count()
        p.fill("#anT", "تست خودکار")
        p.fill("#anB", "این اطلاعیه توسط تست ساخته شد")
        p.select_option("#anL", "warn")
        p.click("#anPost")
        p.wait_for_timeout(1500)
        a1 = p.locator("[data-aid]").count()
        check("admin publishes an announcement", a1 > a0, f"{a0} -> {a1}")

        p.goto(BASE + "/", wait_until="networkidle")
        check("new announcement reaches the site", p.locator(".ann-warn").count() >= 1)

        # clean up the test announcement
        p.goto(BASE + "/admin?tab=announce", wait_until="networkidle")
        for i in range(p.locator("[data-aid]").count()):
            row = p.locator("[data-aid]").nth(i)
            if "تست خودکار" in row.inner_text():
                row.locator(".js-ann-del").click()
                p.wait_for_timeout(900)
                break

        # -------------------------------------------------------- 4. coin economy
        print("\n— coins —")
        p.goto(BASE + "/marketplace", wait_until="networkidle")
        check("coin price shown on cards", p.locator("[data-coins]").count() >= 5,
              f"{p.locator('[data-coins]').count()} cards")
        coins_before = p.locator(".coinpill b").inner_text()
        card = p.locator(".pcard").first
        card.hover()
        card.locator(".js-buy").click()
        p.wait_for_timeout(1400)
        coins_after = p.locator(".coinpill b").inner_text()
        check("buying spends coins from the header balance",
              coins_before != coins_after, f"{coins_before} -> {coins_after}")
        check("purchase toast appears", p.locator(".toasts .toast").count() >= 1)

        # ------------------------------------------------- 5. device-aware AI studio
        print("\n— AI studio —")
        p.goto(BASE + "/ai-studio", wait_until="networkidle")
        devs = p.locator("#aiDevice button").count()
        check("device picker lists every surface", devs == 8, f"{devs} devices")
        check("one device preselected", p.locator("#aiDevice button.on").count() == 1)
        p.locator('#aiDevice button[data-dev="keyboard"]').click()
        check("device selection moves",
              p.locator("#aiDevice button.on").get_attribute("data-dev") == "keyboard")

        p.click("#aiGo")
        p.wait_for_timeout(700)
        check("empty prompt is rejected", p.locator(".toasts .toast").count() >= 1)

        p.fill("#aiPrompt", "یک منظره کوهستانی بنفش")
        p.click("#aiGo")
        p.wait_for_selector("#resultsGrid .skel", timeout=5000)
        w, h = p.evaluate("""() => { const e=document.querySelector('#resultsGrid .skel');
            const r=e.getBoundingClientRect(); return [r.width, r.height]; }""")
        check("skeleton uses the keyboard ratio", abs((w / h) - (640 / 262)) < 0.25,
              f"{w:.0f}x{h:.0f} = {w/h:.2f} (target 2.44)")

        p.wait_for_selector("#resultsGrid .tcard", timeout=180000)
        n = p.locator("#resultsGrid .tcard").count()
        check("results render", n >= 1, f"{n} results")
        fw, fh = p.evaluate("""() => { const e=document.querySelector('#resultsGrid .genframe');
            const r=e.getBoundingClientRect(); return [r.width, r.height]; }""")
        check("result frame keeps the device ratio", abs((fw / fh) - (640 / 262)) < 0.25,
              f"{fw/fh:.2f} (target 2.44)")
        meta = p.locator("#genMeta").inner_text()
        check("generation metadata shown", len(meta) > 4, meta.replace("\n", " ")[:80])
        check("send-to-editor carries device + art",
              "device=keyboard" in (p.locator("#resultsGrid a").first.get_attribute("href") or ""),
              (p.locator("#resultsGrid a").first.get_attribute("href") or "")[:70])

        # ------------------------------------------------------------- 6. editor
        print("\n— editor —")
        href = p.locator("#resultsGrid a").first.get_attribute("href")
        p.goto(BASE + href, wait_until="networkidle")
        art = p.evaluate("""() => { const a=document.querySelector('.devsvg.on .art');
            return a ? (a.getAttribute('href')||'') : 'none'; }""")
        check("AI art lands on the editor canvas", art.startswith("/img/"), art[:48])
        dev = p.evaluate("document.querySelector('.devsvg.on').dataset.device")
        check("editor opens on the right device", dev == "keyboard", dev)

        p.locator(".dchip").nth(3).click()
        p.wait_for_timeout(500)
        dev2 = p.evaluate("document.querySelector('.devsvg.on').dataset.device")
        check("switching device keeps the artwork",
              dev2 != dev and p.evaluate(
                  "document.querySelector('.devsvg.on .art').getAttribute('href')").startswith("/img/"),
              f"{dev} -> {dev2}")

        # ------------------------------------------------- 6b. admin settings
        print("\n— admin settings —")
        p.goto(BASE + "/admin?tab=settings", wait_until="networkidle")
        check("settings tab renders", p.locator("#cProvider").count() == 1)
        check("only the active provider's fields show",
              p.locator(".pv:not(.hide)").count() == 1,
              f"{p.locator('.pv:not(.hide)').count()} block(s)")
        p.select_option("#cProvider", "openai")
        p.wait_for_timeout(250)
        check("switching provider swaps the fields",
              p.locator(".pv-openai:not(.hide)").count() == 1
              and p.locator(".pv-pollinations.hide").count() == 1)
        p.select_option("#cProvider", "pollinations")
        p.wait_for_timeout(200)

        p.fill("#kPoll", "test-key-XYZ9876")
        p.fill("#cCoinValue", "2000")
        p.click("#cSave")
        p.wait_for_timeout(1800)
        p.goto(BASE + "/admin?tab=settings", wait_until="networkidle")
        check("API key saved and masked",
              "••••" in (p.get_attribute("#kPoll", "placeholder") or ""),
              p.get_attribute("#kPoll", "placeholder"))
        check("key value never sent to the browser",
              "test-key-XYZ9876" not in p.content())
        check("economy value persisted", p.input_value("#cCoinValue") == "2000")

        p.goto(BASE + "/marketplace", wait_until="networkidle")
        coins_at_2000 = p.locator("[data-coins]").first.get_attribute("data-coins")
        check("coin price follows the setting with no restart",
              coins_at_2000 == "75", f"149,000 Toman -> {coins_at_2000} coins @2000")

        p.goto(BASE + "/admin?tab=settings", wait_until="networkidle")
        p.click(".js-clear[data-key='pollinationsToken']")
        p.wait_for_timeout(1400)
        p.fill("#cCoinValue", "1000")
        p.click("#cSave")
        p.wait_for_timeout(1600)
        p.goto(BASE + "/admin?tab=settings", wait_until="networkidle")
        check("key cleared", "••••" not in (p.get_attribute("#kPoll", "placeholder") or ""))
        check("economy restored", p.input_value("#cCoinValue") == "1000")

        # ---- custom worker provider
        p.select_option("#cProvider", "worker")
        p.wait_for_timeout(250)
        check("worker fields appear when selected",
              p.is_visible("#kWurl") and p.is_visible("#kWkey"))
        check("other provider fields hide", not p.is_visible("#kCfAcc") and not p.is_visible("#kHf"))
        p.fill("#kWurl", "https://example.invalid/gen")
        p.fill("#kWkey", "secret-abcdef123456")
        p.click("#cSave")
        p.wait_for_timeout(1400)
        p.goto(BASE + "/admin?tab=settings", wait_until="networkidle")
        check("worker URL persisted", p.input_value("#kWurl") == "https://example.invalid/gen")
        check("worker key stored but masked",
              "3456" in (p.get_attribute("#kWkey", "placeholder") or "")
              and p.input_value("#kWkey") == "")
        check("worker key never appears in the page source",
              "secret-abcdef123456" not in p.content())
        p.click(".js-clear[data-key='workerKey']")
        p.wait_for_timeout(1400)
        p.fill("#kWurl", "")          # clear while the block is still visible
        p.select_option("#cProvider", "pollinations")
        p.click("#cSave")
        p.wait_for_timeout(1600)
        p.goto(BASE + "/admin?tab=settings", wait_until="networkidle")
        p.select_option("#cProvider", "worker")
        p.wait_for_timeout(250)
        check("worker key cleared", "••••" not in (p.get_attribute("#kWkey", "placeholder") or ""))
        check("worker URL cleared", p.input_value("#kWurl") == "")
        p.select_option("#cProvider", "pollinations")
        check("provider restored to pollinations", p.input_value("#cProvider") == "pollinations")

        p.click("#cTest")
        p.wait_for_selector("#cResult .pill", timeout=120000)
        res = p.locator("#cResult").inner_text()
        check("connection test reports a result", len(res) > 5, res.replace("\n", " ")[:90])

        # ------------------------------------------------- 6c. full user editing
        print("\n— user editing —")
        p.goto(BASE + "/admin?tab=users&q=mistwood", wait_until="networkidle")
        p.locator(".js-edit").first.click()
        p.wait_for_timeout(350)
        check("edit modal opens", not p.locator("#uModal").evaluate("e=>e.classList.contains('hide')"))
        check("modal prefilled", p.input_value("#eUn") == "mistwood", p.input_value("#eUn"))
        p.fill("#eNm", "Mistwood Renamed")
        p.fill("#eCoins", "4321")
        p.click("#eSave")
        p.wait_for_timeout(1500)
        p.goto(BASE + "/admin?tab=users&q=mistwood", wait_until="networkidle")
        check("edits persisted",
              p.locator("tr[data-uid] .js-coins").first.inner_text().replace(",", "").replace("٬", "") in ("۴۳۲۱", "4321"),
              p.locator("tr[data-uid] .js-coins").first.inner_text())

        p.locator(".js-edit").first.click()
        p.wait_for_timeout(300)
        p.fill("#eUn", "admin")
        p.click("#eSave")
        p.wait_for_timeout(1200)
        check("duplicate username refused in the UI",
              p.locator(".toasts .toast").count() >= 1
              and not p.locator("#uModal").evaluate("e=>e.classList.contains('hide')"))
        p.keyboard.press("Escape")

        # bulk grant
        p.goto(BASE + "/admin?tab=users", wait_until="networkidle")
        p.check("#uAll")
        p.wait_for_timeout(200)
        n_sel = p.locator(".uSel:checked").count()
        check("select-all ticks every row", n_sel >= 5, f"{n_sel} selected")
        p.check("#gBulk")
        p.fill("#gCoins", "10")
        p.click('.grantbox [data-act="coins"]')
        p.wait_for_timeout(1800)
        check("bulk grant runs", p.locator(".toasts .toast").count() >= 0)

        # ------------------------------------------------------- 7. non-admin user
        print("\n— permissions —")
        c2 = ctx_for(br, sid_for("yuki.dsg", "yukiyuki"))
        p2 = c2.new_page()
        p2.goto(BASE + "/admin", wait_until="networkidle")
        check("non-admin gets 403 on /admin", "403" in p2.content())
        check("non-admin sees no shield", p2.locator('.nav a[href="/admin"]').count() == 0)
        p2.goto(BASE + "/dashboard", wait_until="networkidle")
        check("non-admin can use the app", "/dashboard" in p2.url)

        # ------------------------------------------------------------ 8. mobile
        print("\n— mobile —")
        c3 = ctx_for(br, sid_for("admin", "admin123"), mobile=True)
        p3 = c3.new_page()
        p3.goto(BASE + "/", wait_until="networkidle")
        check("mobile banner renders", p3.locator(".ann").count() >= 0)
        p3.click("#burger")
        p3.wait_for_timeout(400)
        check("drawer opens", not p3.locator("#drawer").evaluate("e=>e.classList.contains('hide')"))
        check("drawer shows the coin balance",
              "سکه" in p3.locator("#drawer").inner_text())
        check("drawer has a sign-out",
              p3.locator('#drawer form[action="/logout"]').count() == 1)

        # ------------------------------------------------------------ 9. sign out
        print("\n— sign out —")
        p.goto(BASE + "/dashboard", wait_until="networkidle")
        p.locator('.nav form[action="/logout"] button').click()
        p.wait_for_load_state("networkidle")
        check("logout lands on home", p.url.rstrip("/") == BASE)
        check("logged-out header shows sign in",
              p.locator('.nav a[href="/login"]').count() >= 1)
        p.goto(BASE + "/dashboard", wait_until="networkidle")
        check("session really ended", "/login" in p.url)

        br.close()

    print(f"\npassed: {len(passed)}   failed: {len(issues)}")
    for i in issues:
        print("  ! " + i)
    print(f"ISSUES: {len(issues)}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
