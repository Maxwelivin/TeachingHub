# TeachingHub — 個人雲端教學簡報平台

在教室公用電腦用 Chrome 無痕視窗開一個固定網址，就能選擇並播放 OneDrive 上最新版本的 PowerPoint 簡報（保留動畫與逐步顯示），不需要隨身碟，也不需要登入任何帳號。

```
你的 iPhone／Mac／PC ──PowerPoint 存檔──▶ OneDrive（個人版）
                                              │ 單一檔案的內嵌連結（唯讀）
GitHub Pages（本站）── presentations.json ────┘
     │
教室電腦 Chrome 無痕 ──▶ 選科目／章節 ──▶ Microsoft 官方播放器（iframe）
```

| 角色 | 負責 |
|---|---|
| GitHub Pages | 網站介面（純 HTML／CSS／JS，無框架、無後端、無套件） |
| OneDrive | 簡報儲存與跨裝置同步 |
| PowerPoint 網頁版 | 簡報渲染、動畫、轉場 |
| `data/presentations.json` | 簡報索引（科目、年級、冊別、章節、連結） |

修改既有簡報**不需要**重新部署網站；只有新增簡報時要更新 JSON。

## 文件

- [docs/SETUP.md](docs/SETUP.md)：新增／修改簡報、取得內嵌連結、新增科目章節、更新 JSON、部署、常見問題
- [docs/SECURITY.md](docs/SECURITY.md)：安全設計、限制與**教室公用電腦使用守則**
- [docs/TESTING.md](docs/TESTING.md)：自動測試與人工驗證清單
- [docs/PHASE0.md](docs/PHASE0.md)：技術可行性驗證報告（官方文件與實測結果）

## 教室公用電腦安全使用（摘要）

1. Chrome 開**無痕視窗**（Ctrl+Shift+N），輸入本站網址。
2. **不要登入**任何帳號。本站不需要登入；看到 Microsoft 登入畫面代表連結設定有誤，直接關掉。
3. 選簡報 →「播放」→「全螢幕」→ 在投影片上點一下，之後即可用簡報筆翻頁。
4. 畫面空白：按「重新載入」；仍不行按「網頁版開啟」。
5. 下課**關閉所有無痕視窗**。

> 本站與所有簡報連結都是公開資訊。唯讀分享不等於禁止複製；無痕模式也不能防範電腦本身的監控或紀錄。詳見 [SECURITY.md](docs/SECURITY.md)。

## 專案結構

```
index.html            首頁（科目、篩選、搜尋、卡片）
player.html           播放頁
helper.html           新增簡報小幫手（貼內嵌程式碼 → 產生 JSON）
assets/css/           main.css、player.css、helper.css
assets/js/            catalog.js（資料載入與網址白名單，共用）、main.js、player.js、helper.js、theme.js
assets/icons/         favicon
data/presentations.json  簡報索引
scripts/validate.mjs  部署前檢查（無需安裝套件）
tests/run_tests.py    Playwright 瀏覽器測試
.github/workflows/pages.yml  push 到 main 後自動檢查並部署
```

## 本機預覽

```powershell
python -m http.server 8000   # 然後開 http://localhost:8000
```
