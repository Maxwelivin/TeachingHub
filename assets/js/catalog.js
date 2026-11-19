// 簡報索引的載入與檢查（首頁、播放頁、小幫手共用）。
// 本站所有內容都是公開的：這裡只處理「已主動分享的單一簡報連結」，不含任何帳號或金鑰。

export const DATA_URL = 'data/presentations.json';

// 允許內嵌／開啟的微軟網域。新增網域前請先讀 docs/SECURITY.md。
// 同步修改：各 HTML 的 Content-Security-Policy frame-src、scripts/validate.mjs。
const EXACT_HOSTS = ['onedrive.live.com', '1drv.ms'];
const HOST_SUFFIXES = ['.officeapps.live.com', '.sharepoint.com'];

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isAllowedHost(host) {
  const h = host.toLowerCase();
  return EXACT_HOSTS.includes(h) || HOST_SUFFIXES.some((s) => h.endsWith(s) && h.length > s.length);
}

// 檢查一個網址能不能當成簡報連結。回傳 { ok, url, reason }。
export function checkMsUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'empty' };
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'not-https' };
  if (url.username || url.password) return { ok: false, reason: 'malformed' };
  if (!isAllowedHost(url.hostname)) return { ok: false, reason: 'host' };
  return { ok: true, url: url.href };
}

export const REASON_TEXT = {
  empty: '這份簡報還沒有設定播放連結。',
  malformed: '播放連結格式不正確。',
  'not-https': '播放連結必須是 https:// 開頭。',
  host: '播放連結不是 OneDrive／PowerPoint 網頁版的網址，為了安全已拒絕載入。',
};

// 從貼上的整段 <iframe ...> 內嵌程式碼或網址中取出 src。
export function extractEmbedSrc(text) {
  if (typeof text !== 'string') return '';
  const t = text.trim();
  if (t.startsWith('<')) {
    const doc = new DOMParser().parseFromString(t, 'text/html');
    const frame = doc.querySelector('iframe');
    return frame ? (frame.getAttribute('src') || '').trim() : '';
  }
  return t;
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// 整理一筆簡報資料；格式錯誤回傳 null。
function normalize(p, subjectIds) {
  if (!p || typeof p !== 'object') return null;
  const id = str(p.id);
  const title = str(p.title);
  if (!ID_RE.test(id) || !title || !subjectIds.has(p.subject)) return null;
  const updated = str(p.updated);
  return {
    id,
    subject: p.subject,
    grade: str(p.grade),
    volume: str(p.volume),
    chapter: str(p.chapter),
    title,
    description: str(p.description),
    embedUrl: str(p.embedUrl),
    openUrl: str(p.openUrl),
    // 只顯示人工填寫且格式正確的日期，絕不自行產生。
    updated: DATE_RE.test(updated) ? updated : '',
    tags: Array.isArray(p.tags) ? p.tags.filter((x) => typeof x === 'string') : [],
  };
}

export async function loadCatalog() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const subjects = (Array.isArray(raw.subjects) ? raw.subjects : [])
    .filter((s) => s && ID_RE.test(str(s.id)) && str(s.name))
    .map((s) => ({ id: str(s.id), name: str(s.name) }));
  const subjectIds = new Set(subjects.map((s) => s.id));
  const seen = new Set();
  const presentations = [];
  let skipped = 0;
  for (const p of Array.isArray(raw.presentations) ? raw.presentations : []) {
    const n = normalize(p, subjectIds);
    if (!n || seen.has(n.id)) {
      skipped += 1;
      continue;
    }
    seen.add(n.id);
    presentations.push(n);
  }
  if (skipped) console.warn(`[TeachingHub] 略過 ${skipped} 筆格式錯誤或重複的簡報資料`);
  return { subjects, presentations, skipped };
}

// 「在 PowerPoint 網頁版開啟」要用的網址：優先 openUrl，否則用內嵌網址。
export function openTarget(p) {
  const open = checkMsUrl(p.openUrl);
  if (open.ok) return open.url;
  const embed = checkMsUrl(p.embedUrl);
  return embed.ok ? embed.url : '';
}
