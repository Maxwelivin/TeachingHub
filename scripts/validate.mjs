// 部署前檢查（本機與 GitHub Actions 共用，不需安裝任何套件）：
//   1. data/presentations.json 格式、id 不重複、連結都是允許的微軟網域
//   2. 整個專案沒有疑似私人憑證
//   3. 前端程式沒有使用持久儲存、Service Worker 或 eval
//   4. HTML 都有 CSP，且 iframe 的 sandbox 沒有放寬到 top-navigation
// 用法：node scripts/validate.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMsUrl } from '../assets/js/catalog.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);

// ---------- 1. 簡報索引 ----------
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
let data;
try {
  data = JSON.parse(readFileSync(join(ROOT, 'data/presentations.json'), 'utf8'));
} catch (e) {
  fail(`data/presentations.json 不是合法 JSON：${e.message}`);
}
if (data) {
  if (!Array.isArray(data.subjects) || data.subjects.length === 0) fail('subjects 必須是非空陣列');
  if (!Array.isArray(data.presentations)) fail('presentations 必須是陣列');
  const subjectIds = new Set();
  for (const s of data.subjects || []) {
    if (!ID_RE.test(s?.id || '')) fail(`科目 id 不合法：${JSON.stringify(s?.id)}`);
    if (!s?.name) fail(`科目 ${s?.id} 缺少 name`);
    if (subjectIds.has(s?.id)) fail(`科目 id 重複：${s.id}`);
    subjectIds.add(s?.id);
  }
  const ids = new Set();
  for (const [i, p] of (data.presentations || []).entries()) {
    const where = `presentations[${i}]${p?.id ? `（${p.id}）` : ''}`;
    if (!ID_RE.test(p?.id || '')) fail(`${where} id 不合法（只能小寫英數與 -）`);
    if (ids.has(p?.id)) fail(`${where} id 重複`);
    ids.add(p?.id);
    if (!subjectIds.has(p?.subject)) fail(`${where} subject「${p?.subject}」不在 subjects 清單`);
    if (!p?.title) fail(`${where} 缺少 title`);
    for (const key of ['embedUrl', 'openUrl']) {
      const v = p?.[key];
      if (v === undefined || v === '') {
        if (key === 'embedUrl') warnings.push(`${where} 尚未設定 embedUrl（首頁會顯示「無法播放」）`);
        continue;
      }
      const r = checkMsUrl(v);
      if (!r.ok) fail(`${where} ${key} 不允許：${r.reason}`);
      else if (key === 'embedUrl' && /\/(redir|view\.aspx|edit\.aspx)/.test(new URL(v).pathname))
        warnings.push(`${where} embedUrl 看起來不是內嵌網址（應為 PowerPoint 網頁版「內嵌」產生的 /embed 或含 em=2 的網址）`);
    }
    if (p?.updated !== null && p?.updated !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.updated))
      fail(`${where} updated 必須是 YYYY-MM-DD 或 null`);
  }
}

// ---------- 2–4. 掃描專案檔案 ----------
const SKIP_DIRS = new Set(['.git', 'node_modules', 'test-results', 'screenshots']);
const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.md', '.yml', '.yaml', '.py', '.txt', '.svg', '']);
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(full);
    } else if (TEXT_EXT.has(extname(name))) yield full;
  }
}

const SECRET_PATTERNS = [
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/github_pat_[A-Za-z0-9_]{40,}/, 'GitHub fine-grained token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '私鑰'],
  [/["']?(access|refresh|id)_token["']?\s*[:=]\s*["'][^"']{12,}/i, 'OAuth token'],
  [/client_secret["']?\s*[:=]\s*["'][^"']{8,}/i, 'client secret'],
  [/Bearer\s+[A-Za-z0-9\-._~+/]{20,}/, 'Bearer token'],
  [/\bEw[A-Za-z0-9+/]{100,}/, 'Microsoft access token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS key'],
  [/AIza[0-9A-Za-z\-_]{35}/, 'Google API key'],
  [/password\s*[:=]\s*["'][^"']+["']/i, '密碼'],
];
const FRONTEND_FORBIDDEN = [
  [/\blocalStorage\b/, 'localStorage（持久儲存）'],
  [/\bindexedDB\b/, 'IndexedDB（持久儲存）'],
  [/\bserviceWorker\b/, 'Service Worker'],
  [/\bcaches\.open\b/, 'Cache Storage'],
  [/document\.cookie/, 'cookie'],
  [/\beval\s*\(/, 'eval'],
  [/new Function\s*\(/, 'new Function'],
  [/\.innerHTML\s*=/, 'innerHTML（請用 textContent）'],
  [/allow-top-navigation/, 'sandbox allow-top-navigation'],
];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  if (rel === 'scripts/validate.mjs') continue; // 本檔含規則字串
  const text = readFileSync(file, 'utf8');
  for (const [re, label] of SECRET_PATTERNS) if (re.test(text)) fail(`${rel} 疑似含有 ${label}`);
  if (rel.startsWith('assets/js/')) for (const [re, label] of FRONTEND_FORBIDDEN) if (re.test(text)) fail(`${rel} 使用了 ${label}`);
  if (rel.endsWith('.html') && !rel.startsWith('tests/')) {
    if (!/http-equiv="Content-Security-Policy"/.test(text)) fail(`${rel} 缺少 Content-Security-Policy`);
    if (/<script(?![^>]*\bsrc=)[^>]*>/.test(text)) fail(`${rel} 有內嵌 <script>（CSP 會擋，請改成外部檔）`);
    if (/\son[a-z]+="/.test(text)) fail(`${rel} 有 inline 事件屬性（CSP 會擋）`);
    if (/\sstyle="/.test(text)) fail(`${rel} 有 style 屬性（CSP 會擋）`);
    if (/https?:\/\/(?!onedrive\.live\.com|1drv\.ms|\*\.officeapps|\*\.sharepoint)[a-z0-9.-]+\.[a-z]{2,}/i.test(text.replace(/<!--[\s\S]*?-->/g, '').replace(/placeholder="[^"]*"/g, '')))
      fail(`${rel} 載入了非必要的外部網址`);
  }
}

for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n檢查失敗：${errors.length} 個問題`);
  process.exit(1);
}
console.log(`✓ 檢查通過（${data?.presentations?.length ?? 0} 份簡報，${warnings.length} 個提醒）`);
