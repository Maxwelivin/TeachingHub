"""TeachingHub 瀏覽器測試（Playwright for Python + Chromium）。

每個測試都用全新的瀏覽器 context（沒有任何登入狀態，等同無痕視窗）。
用法：python tests/run_tests.py [--no-live]
  --no-live  跳過需要連到 Microsoft 的測試
結果寫到 tests/last-run.md，截圖在 tests/screenshots/（不進 git）。
"""
from __future__ import annotations

import functools
import http.server
import json
import socketserver
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "screenshots"
LIVE = "--no-live" not in sys.argv
REMOTE = sys.argv[sys.argv.index("--base") + 1].rstrip("/") if "--base" in sys.argv else ""
ONLY = sys.argv[sys.argv.index("-k") + 1] if "-k" in sys.argv else ""

# Microsoft 在官方部落格公開的範例簡報（OneDrive 個人版、任何人可檢視），只用於測試，不放進正式資料。
SAMPLE_EMBED = (
    "https://onedrive.live.com/embed?cid=CA582F2BC3AD1590&resid=CA582F2BC3AD1590%2133463"
    "&authkey=AFh1O3tkDLAQzzw&em=2&wdAr=1.7777777777777777"
)
SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"

FIXTURE = {
    "version": 1,
    "subjects": [
        {"id": "jh-physchem", "name": "國中理化"},
        {"id": "jh-math", "name": "國中數學"},
        {"id": "sh-physics", "name": "高中物理"},
    ],
    "presentations": [
        {"id": "live-sample", "subject": "jh-physchem", "grade": "八年級", "volume": "第三冊（八上）",
         "chapter": "第 1 章 基本測量", "title": "1-1 長度的測量", "description": "測試用：Microsoft 公開範例簡報",
         "embedUrl": SAMPLE_EMBED, "openUrl": "", "updated": "2026-11-19", "tags": ["測試"]},
        {"id": "pc-g8-2-1", "subject": "jh-physchem", "grade": "八年級", "volume": "第三冊（八上）",
         "chapter": "第 2 章 物質的世界", "title": "2-1 認識物質", "description": "純物質與混合物",
         "embedUrl": SAMPLE_EMBED, "openUrl": "https://1drv.ms/p/c/abc/xyz", "updated": None, "tags": []},
        {"id": "pc-g9-1-1", "subject": "jh-physchem", "grade": "九年級", "volume": "第五冊（九上）",
         "chapter": "第 1 章 化學反應", "title": "1-1 質量守恆", "description": "",
         "embedUrl": SAMPLE_EMBED, "openUrl": "", "updated": "not-a-date", "tags": ["實驗"]},
        {"id": "bad-host", "subject": "jh-math", "grade": "七年級", "volume": "第一冊（七上）",
         "chapter": "第 1 章 整數", "title": "惡意網址測試", "description": "",
         "embedUrl": "https://evil.example.com/embed?x=1", "openUrl": "", "updated": None, "tags": []},
        {"id": "not-https", "subject": "jh-math", "grade": "七年級", "volume": "第一冊（七上）",
         "chapter": "第 1 章 整數", "title": "http 網址測試", "description": "",
         "embedUrl": "http://onedrive.live.com/embed?x=1", "openUrl": "", "updated": None, "tags": []},
        {"id": "no-link", "subject": "sh-physics", "grade": "高一", "volume": "必修物理",
         "chapter": "第 1 章 科學方法", "title": "１－１ 物理學的範疇", "description": "全形搜尋測試",
         "embedUrl": "", "openUrl": "", "updated": None, "tags": []},
        {"id": "BAD ID", "subject": "sh-physics", "title": "格式錯誤，應被略過"},
        {"id": "ghost", "subject": "no-such-subject", "title": "科目不存在，應被略過"},
    ],
}


# ---------------------------------------------------------------- 測試框架
results: list[tuple[str, str, str]] = []


def test(name: str, live: bool = False):
    def deco(fn):
        fn.test_name, fn.live = name, live
        TESTS.append(fn)
        return fn
    return deco


TESTS = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


class Ctx:
    def __init__(self, browser, base):
        self.browser, self.base = browser, base

    def page(self, fixture=True, **kw) -> Page:
        ctx = self.browser.new_context(**kw)
        page = ctx.new_page()
        page.errors = []
        base = self.base
        # 只記錄「本站」的錯誤：Microsoft 播放器框架內自己的腳本錯誤不在本站控制範圍。
        page.on("pageerror", lambda e: page.errors.append(str(e)) if base in (e.stack or "") else None)
        page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" and (
            (m.location or {}).get("url", "").startswith(base) or "frame-src https://onedrive.live.com" in m.text) else None)
        if fixture:
            page.route("**/data/presentations.json", lambda r: r.fulfill(
                status=200, content_type="application/json", body=json.dumps(FIXTURE, ensure_ascii=False)))
        return page


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def ppt_frame_text(page: Page) -> str:
    for f in page.frames:
        if "PowerPointFrame" in f.url:
            try:
                return f.evaluate("document.body ? document.body.innerText : ''")
            except Exception:
                return ""
    return ""


def slide_number(page: Page, timeout=40) -> int | None:
    import re
    end = time.time() + timeout
    while time.time() < end:
        m = re.search(r"SLIDE\s+(\d+)\s+OF\s+(\d+)", ppt_frame_text(page))
        if m:
            return int(m.group(1))
        page.wait_for_timeout(500)
    return None


def no_overflow(page: Page):
    w = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    check(w[0] <= w[1] + 1, f"出現水平捲軸 scrollWidth={w[0]} clientWidth={w[1]}")


# ---------------------------------------------------------------- 首頁
@test("首頁載入：科目、卡片、略過壞資料、無錯誤")
def t_home(c: Ctx):
    p = c.page(viewport={"width": 1366, "height": 768})
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    subjects = p.locator("#subjects button").all_inner_texts()
    check(subjects == ["全部", "國中理化", "國中數學", "高中物理"], f"科目按鈕 {subjects}")
    check(p.locator(".card").count() == 6, f"應顯示 6 張卡片（2 筆壞資料略過），實際 {p.locator('.card').count()}")
    check(p.locator("#result-meta").inner_text() == "共 6 份簡報", "結果數量文字")
    check(not p.errors, f"console/CSP 錯誤 {p.errors}")
    p.screenshot(path=SHOTS / "home-1366.png")


@test("科目、年級、冊別、章節連動篩選")
def t_filters(c: Ctx):
    p = c.page()
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    p.click("#subjects button[data-subject='jh-physchem']")
    check(p.locator(".card").count() == 3, "理化應有 3 份")
    grades = p.locator("#f-grade option").all_inner_texts()
    check(grades == ["全部年級", "八年級", "九年級"], f"年級選項 {grades}")
    p.select_option("#f-grade", "八年級")
    check(p.locator(".card").count() == 2, "八年級應有 2 份")
    check(p.locator("#f-volume option").all_inner_texts() == ["全部冊別", "第三冊（八上）"], "冊別選項")
    p.select_option("#f-chapter", "第 2 章 物質的世界")
    check(p.locator(".card").count() == 1 and "2-1" in p.locator(".card h2").inner_text(), "章節篩選")
    check("s=jh-physchem" in p.url and "g=" in p.url and "c=" in p.url, f"篩選條件應寫進網址 {p.url}")
    p.click("#subjects button[data-subject='jh-math']")
    check(p.locator("#f-grade").input_value() == "", "換科目後年級應重設")
    check(p.locator(".card").count() == 2, "數學應有 2 份")
    p.click("#f-clear")
    check(p.locator(".card").count() == 6, "清除條件後回到全部")


@test("搜尋（含全形字、多關鍵字、找不到）")
def t_search(c: Ctx):
    p = c.page()
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    p.fill("#f-q", "質量")
    check(p.locator(".card").count() == 1, "搜尋「質量」")
    p.fill("#f-q", "1-1 物理")  # 資料裡是全形「１－１」
    check(p.locator(".card").count() == 1 and "物理學" in p.locator(".card h2").inner_text(), "全形／多關鍵字搜尋")
    p.fill("#f-q", "實驗")
    check(p.locator(".card").count() == 1, "搜尋標籤")
    p.fill("#f-q", "不存在的關鍵字")
    check(p.locator(".card").count() == 0 and p.locator(".empty").is_visible(), "找不到時顯示提示")


@test("卡片：無效連結停用播放、不顯示虛構日期、外部連結安全屬性")
def t_cards(c: Ctx):
    p = c.page()
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    bad = p.locator(".card[data-id='bad-host']")
    check(bad.locator("[aria-disabled='true']").count() == 1, "惡意網域應停用播放")
    check(bad.locator("a[href*='evil']").count() == 0, "不應出現惡意網址連結")
    check("不是 OneDrive" in bad.locator(".notice").inner_text(), "應說明原因")
    check(p.locator(".card[data-id='not-https'] [aria-disabled='true']").count() == 1, "http 網址應停用")
    check(p.locator(".card[data-id='no-link'] .notice").inner_text().startswith("這份簡報還沒有"), "未設定連結提示")
    check(p.locator(".card[data-id='live-sample'] .updated").inner_text() == "索引更新：2026-11-19", "有填日期才顯示")
    check(p.locator(".card[data-id='pc-g8-2-1'] .updated").count() == 0, "null 日期不顯示")
    check(p.locator(".card[data-id='pc-g9-1-1'] .updated").count() == 0, "格式錯誤日期不顯示")
    links = p.locator("a[target='_blank']")
    for i in range(links.count()):
        rel = links.nth(i).get_attribute("rel") or ""
        check("noopener" in rel and "noreferrer" in rel, "新分頁連結需 noopener noreferrer")
    check(p.locator(".card[data-id='pc-g8-2-1'] a[target='_blank']").get_attribute("href") == "https://1drv.ms/p/c/abc/xyz",
          "有 openUrl 時備援按鈕用 openUrl")


@test("正式資料檔（data/presentations.json）可載入")
def t_real_data(c: Ctx):
    p = c.page(fixture=False)
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card, .empty, .load-error")
    check(p.locator(".load-error").count() == 0, "正式資料載入失敗")
    check(p.locator("#subjects button").count() >= 2, "至少一個科目")
    check(not p.errors, f"錯誤 {p.errors}")


@test("資料檔損壞時顯示錯誤訊息")
def t_broken_data(c: Ctx):
    p = c.page(fixture=False)
    p.route("**/data/presentations.json", lambda r: r.fulfill(status=200, body="{ not json"))
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".load-error")
    p2 = c.page(fixture=False)
    p2.route("**/data/presentations.json", lambda r: r.fulfill(status=404, body=""))
    p2.goto(c.base + "/player.html?id=x")
    check(p2.locator("#error").is_visible() and "載入失敗" in p2.locator("#error-title").inner_text(), "播放頁資料錯誤")


# ---------------------------------------------------------------- 播放頁（不連外）
@test("播放頁錯誤處理：沒有 id、找不到、惡意網域、非 https、未設定連結")
def t_player_errors(c: Ctx):
    cases = {
        "": "沒有指定簡報",
        "?id=nope": "找不到這份簡報",
        "?id=bad-host": "無法播放",
        "?id=not-https": "無法播放",
        "?id=no-link": "無法播放",
    }
    for qs, title in cases.items():
        p = c.page()
        p.goto(c.base + "/player.html" + qs)
        p.wait_for_selector("#error:not([hidden])")
        check(title in p.locator("#error-title").inner_text(), f"{qs or '(無 id)'} 應顯示「{title}」")
        check(p.locator("iframe").count() == 0, f"{qs} 不應建立 iframe")
        check(p.locator("#fullscreen").is_hidden() and p.locator("#reload").is_hidden(), f"{qs} 不應顯示無效按鈕")
        check(not p.errors, f"{qs} 錯誤 {p.errors}")
    p.screenshot(path=SHOTS / "player-error.png")


@test("播放頁 iframe 權限符合最低必要原則")
def t_iframe_attrs(c: Ctx):
    p = c.page()
    p.route("https://onedrive.live.com/**", lambda r: r.fulfill(status=200, body="<p>stub</p>", content_type="text/html"))
    p.goto(c.base + "/player.html?id=live-sample")
    f = p.wait_for_selector("#stage iframe")
    check(f.get_attribute("sandbox") == SANDBOX, f"sandbox={f.get_attribute('sandbox')}")
    check(f.get_attribute("allow") == "fullscreen", f"allow={f.get_attribute('allow')}")
    check(f.get_attribute("src") == SAMPLE_EMBED, "src 應為資料中的內嵌網址")
    check(f.get_attribute("referrerpolicy") == "strict-origin-when-cross-origin", "referrerpolicy")
    csp = p.locator("meta[http-equiv='Content-Security-Policy']").get_attribute("content")
    check("frame-src https://onedrive.live.com" in csp and "script-src 'self'" in csp, "CSP")
    check(p.locator("#open").get_attribute("href") == SAMPLE_EMBED, "無 openUrl 時備援用內嵌網址")


@test("返回列表保留原本的篩選條件")
def t_back(c: Ctx):
    p = c.page()
    p.route("https://onedrive.live.com/**", lambda r: r.fulfill(status=200, body="<p>stub</p>", content_type="text/html"))
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    p.click("#subjects button[data-subject='jh-physchem']")
    p.select_option("#f-grade", "八年級")
    p.click(".card[data-id='live-sample'] .btn-primary")
    p.wait_for_url("**/player.html?id=live-sample")
    p.click("#back")
    p.wait_for_selector(".card")
    check(p.locator("#f-grade").input_value() == "八年級", f"回列表後年級應仍為八年級，網址 {p.url}")
    check(p.locator(".card").count() == 2, "篩選結果應保留")
    # 直接開播放頁（沒有上一頁）時，返回應連到首頁
    p2 = c.page()
    p2.route("https://onedrive.live.com/**", lambda r: r.fulfill(status=200, body="<p>stub</p>", content_type="text/html"))
    p2.goto(c.base + "/player.html?id=live-sample")
    p2.click("#back")
    p2.wait_for_selector(".card")


@test("不使用持久儲存、Service Worker、cookie")
def t_storage(c: Ctx):
    p = c.page()
    p.route("https://onedrive.live.com/**", lambda r: r.fulfill(status=200, body="<p>stub</p>", content_type="text/html"))
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    p.click("[data-theme-toggle]")
    p.fill("#f-q", "測試")
    p.goto(c.base + "/player.html?id=live-sample")
    p.wait_for_selector("#stage iframe")
    s = p.evaluate("""async () => ({
        local: localStorage.length,
        session: Object.keys(sessionStorage),
        idb: indexedDB.databases ? (await indexedDB.databases()).length : 0,
        sw: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
        cookie: document.cookie,
        caches: (await caches.keys()).length,
    })""")
    check(s["local"] == 0, f"localStorage 有 {s['local']} 筆")
    check(s["session"] in ([], ["th-theme"]), f"sessionStorage 只允許外觀設定：{s['session']}")
    check(s["idb"] == 0 and s["sw"] == 0 and s["caches"] == 0 and s["cookie"] == "", f"儲存狀態 {s}")


@test("淺色／深色模式切換")
def t_theme(c: Ctx):
    p = c.page(color_scheme="light")
    p.goto(c.base + "/index.html")
    p.wait_for_selector(".card")
    bg = lambda: p.evaluate("getComputedStyle(document.body).backgroundColor")
    light = bg()
    p.click("[data-theme-toggle]")  # auto -> light
    p.click("[data-theme-toggle]")  # light -> dark
    check(p.evaluate("document.documentElement.dataset.theme") == "dark", "應切到深色")
    check(bg() != light, "深色背景應不同")
    p.wait_for_timeout(500)
    p.screenshot(path=SHOTS / "home-dark.png")
    p.click("[data-theme-toggle]")
    check(p.evaluate("document.documentElement.dataset.theme") is None, "第三下回到跟隨系統")
    p2 = c.page(color_scheme="dark")
    p2.goto(c.base + "/index.html")
    p2.wait_for_selector(".card")
    check(p2.evaluate("getComputedStyle(document.body).backgroundColor") != light, "系統深色時自動深色")


@test("響應式：投影 1920、教室 1366、iPad、iPhone 無水平捲軸")
def t_responsive(c: Ctx):
    sizes = {"1920x1080": (1920, 1080), "1366x768": (1366, 768), "ipad": (820, 1180), "iphone": (390, 844)}
    for name, (w, h) in sizes.items():
        p = c.page(viewport={"width": w, "height": h}, is_mobile=w < 500, has_touch=w < 1000)
        p.goto(c.base + "/index.html")
        p.wait_for_selector(".card")
        no_overflow(p)
        p.screenshot(path=SHOTS / f"home-{name}.png", full_page=True)
        p.route("https://onedrive.live.com/**", lambda r: r.fulfill(status=200, body="<p>stub</p>", content_type="text/html"))
        p.goto(c.base + "/player.html?id=live-sample")
        p.wait_for_selector("#stage iframe")
        no_overflow(p)
        box = p.locator("#stage").bounding_box()
        check(box["height"] > h * 0.6, f"{name} 簡報區高度 {box['height']} 太小")
        for b in ("#back", "#reload", "#open"):
            bb = p.locator(b).bounding_box()
            check(bb and bb["height"] >= 44 and bb["width"] >= 44, f"{name} {b} 按鈕太小 {bb}")


@test("新增簡報小幫手：解析 iframe 程式碼、拒絕非微軟網址、偵測重複 id")
def t_helper(c: Ctx):
    p = c.page()
    p.goto(c.base + "/helper.html")
    p.wait_for_selector("#h-subject option", state="attached")
    p.fill("#h-embed", f'<iframe src="{SAMPLE_EMBED}" width="962px" height="565px" frameborder="0">這是內嵌的 Microsoft Office 簡報。</iframe>')
    p.fill("#h-id", "live-sample")
    check("已經用過" in p.locator("#h-id-status").inner_text(), "應偵測重複 id")
    p.fill("#h-id", "new-one")
    p.fill("#h-title", "新簡報")
    out = json.loads(p.locator("#h-out").inner_text())
    check(out["embedUrl"] == SAMPLE_EMBED and out["id"] == "new-one" and out["title"] == "新簡報", f"輸出 {out}")
    p.fill("#h-embed", '<iframe src="https://evil.example.com/x"></iframe>')
    check(json.loads(p.locator("#h-out").inner_text())["embedUrl"] == "", "惡意網址不應輸出")
    check(p.locator("#h-preview").is_disabled(), "無效連結時不能試播")
    check(not p.errors, f"錯誤 {p.errors}")


# ---------------------------------------------------------------- 連到 Microsoft 的實測
@test("【實測】未登入可播放 OneDrive 內嵌簡報（sandbox + CSP 下）", live=True)
def t_live_play(c: Ctx):
    p = c.page(viewport={"width": 1366, "height": 768})
    p.goto(c.base + "/player.html?id=live-sample")
    n = slide_number(p)
    check(n == 1, f"應顯示第 1 張投影片，實際 {n}")
    check(p.locator("#loading").is_hidden(), "載入畫面應已隱藏")
    check(not p.errors, f"console/CSP 錯誤 {p.errors}")
    p.wait_for_timeout(6000)
    p.screenshot(path=SHOTS / "player-live-1366.png")


def press_until(p: Page, key: str, cmp, tries=4) -> int | None:
    """按鍵直到頁碼改變。投影片若有「按一下」動畫，前幾下會先播動畫、頁碼不變。"""
    before = slide_number(p, 5)
    for _ in range(tries):
        p.keyboard.press(key)
        p.wait_for_timeout(2500)
        now = slide_number(p, 5)
        if now is not None and before is not None and cmp(now, before):
            return now
    return None


def click_stage(p: Page):
    box = p.locator("#stage").bounding_box()
    p.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    p.wait_for_timeout(2500)


@test("【實測】點投影片＋鍵盤（→、PageDown、PageUp、←）翻頁", live=True)
def t_live_keys(c: Ctx):
    p = c.page(viewport={"width": 1366, "height": 768})
    p.goto(c.base + "/player.html?id=live-sample")
    check(slide_number(p) == 1, "初始第 1 張")
    p.wait_for_timeout(8000)
    click_stage(p)
    check(slide_number(p, 5) == 2, "點一下投影片應到第 2 張")
    for key in ("ArrowRight", "PageDown"):
        check(press_until(p, key, lambda a, b: a > b) is not None, f"{key} 應能前進")
    for key in ("PageUp", "ArrowLeft"):
        check(press_until(p, key, lambda a, b: a < b) is not None, f"{key} 應能後退")


@test("【實測】全螢幕按鈕：外框全螢幕；點一下投影片後簡報筆按鍵可翻頁", live=True)
def t_live_fullscreen(c: Ctx):
    p = c.page(viewport={"width": 1366, "height": 768})
    p.goto(c.base + "/player.html?id=live-sample")
    check(slide_number(p) == 1, "初始第 1 張")
    p.wait_for_timeout(8000)
    p.click("#fullscreen")
    p.wait_for_timeout(1500)
    fs = p.evaluate("document.fullscreenElement && document.fullscreenElement.id")
    check(fs == "stage", f"全螢幕元素應為 stage，實際 {fs}")
    box = p.locator("#stage").bounding_box()
    check(box["width"] == 1366 and box["height"] == 768, f"簡報區應佔滿螢幕 {box}")
    click_stage(p)
    check(press_until(p, "PageDown", lambda a, b: a > b) is not None, "全螢幕中 PageDown 應能前進")
    p.screenshot(path=SHOTS / "player-fullscreen.png")
    p.keyboard.press("Escape")
    p.wait_for_timeout(1000)


@test("【實測】重新載入按鈕重新取得簡報", live=True)
def t_live_reload(c: Ctx):
    p = c.page(viewport={"width": 1366, "height": 768})
    p.goto(c.base + "/player.html?id=live-sample")
    check(slide_number(p) == 1, "初始第 1 張")
    p.wait_for_timeout(8000)
    click_stage(p)
    check(slide_number(p, 5) == 2, "先翻到第 2 張")
    p.click("#reload")
    p.wait_for_timeout(3 * 1000)
    check(slide_number(p) == 1, "重新載入後回到第 1 張（重新向 OneDrive 取得）")


@test("【實測】備援：內嵌網址直接在新分頁開啟也能播放", live=True)
def t_live_fallback(c: Ctx):
    p = c.page(viewport={"width": 1366, "height": 768})
    p.goto(SAMPLE_EMBED)
    check(slide_number(p) == 1, "直接開啟內嵌網址應能播放")
    p.screenshot(path=SHOTS / "fallback-direct.png")


@test("【實測】iPhone 尺寸可播放", live=True)
def t_live_iphone(c: Ctx):
    p = c.page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    p.goto(c.base + "/player.html?id=live-sample")
    check(slide_number(p) == 1, "iPhone 尺寸應能載入第 1 張")
    p.wait_for_timeout(6000)
    p.screenshot(path=SHOTS / "player-live-iphone.png")


# ---------------------------------------------------------------- 執行
def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd, base = serve()
    if REMOTE:
        base = REMOTE
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        c = Ctx(browser, base)
        for fn in TESTS:
            if ONLY and ONLY not in fn.test_name:
                continue
            if fn.live and not LIVE:
                results.append(("SKIP", fn.test_name, "使用 --no-live 跳過"))
                continue
            t0 = time.time()
            try:
                fn(c)
                results.append(("PASS", fn.test_name, f"{time.time() - t0:.1f}s"))
            except Exception as e:
                msg = str(e) if isinstance(e, AssertionError) else traceback.format_exc(limit=2)
                results.append(("FAIL", fn.test_name, msg.strip().replace("\n", " ")[:300]))
            finally:
                for ctx in browser.contexts:
                    ctx.close()
            print(f"{results[-1][0]:4}  {fn.test_name}  {results[-1][2]}", flush=True)
        browser.close()
    httpd.shutdown()

    passed = sum(r[0] == "PASS" for r in results)
    failed = sum(r[0] == "FAIL" for r in results)
    lines = [f"# 自動測試結果（{datetime.now():%Y-%m-%d %H:%M}）", "",
             f"Chromium（Playwright），每項測試都用全新、未登入的瀏覽器狀態。通過 {passed}、失敗 {failed}、跳過 {len(results) - passed - failed}。", "",
             "| 結果 | 測試 | 備註 |", "|---|---|---|"]
    lines += [f"| {r[0]} | {r[1]} | {r[2].replace('|', '/')} |" for r in results]
    (ROOT / "tests" / "last-run.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
