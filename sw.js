/* =========================================================
   営業日報アプリ Service Worker（sw.js）
   ・最初に電波のある所で開くと、アプリ本体を端末に保管する
   ・次回からは、電波がなくても保管した本体で起動する
   ・電波があるときは最新版を取りに行き、保管内容を更新する
   ・客先名リスト（master フォルダ）は保管せず、常にネットから取得する
   ※ アプリを大きく作り替えたときは、下の CACHE の v1 → v2 に変える
========================================================= */
const CACHE = "nippo-cache-v7";
const FONT_CACHE = "nippo-fonts-v1";                    // Google Fonts（見た目用）を保管する入れ物
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

const CORE = [
  "./",
  "index.html",
  "container.js",
  "manifest.webmanifest",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async url => {
      try{
        const res = await fetch(url, { cache: "reload" });
        if(res.ok) await cache.put(url, res);
      }catch(e){ /* 取得できなかったファイルは後で再試行される */ }
    }));
    // 本体(index.html)が保管できていなければ、インストール失敗にして次回やり直す
    if(!(await cache.match("index.html"))) throw new Error("index.html を保管できませんでした");
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function fetchWithTimeout(req, ms){
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req, { cache: "no-cache" }).then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

// ネット優先（4秒まで待つ）→ だめなら保管したものを使う
async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try{
    const res = await fetchWithTimeout(req, 4000);
    if(res && res.ok) cache.put(req, res.clone());
    return res;
  }catch(err){
    const hit = await cache.match(req, { ignoreSearch: true });
    if(hit) return hit;
    if(req.mode === "navigate"){
      const index = await cache.match("index.html");
      if(index) return index;
    }
    return Response.error();
  }
}

// フォント：保管したものをすぐ使い、裏で最新を取り直す（電波が弱くても画面表示が止まらない）
async function fontsCacheFirst(event){
  const req = event.request;
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => {
    if(res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if(hit){
    event.waitUntil(update);
    return hit;
  }
  return (await update) || Response.error();
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  if(FONT_HOSTS.includes(url.hostname)){
    event.respondWith(fontsCacheFirst(event));
    return;
  }
  if(url.origin !== self.location.origin) return;       // それ以外の外部は対象外
  if(url.pathname.includes("/master/")) return;         // 客先名リストは保管しない

  event.respondWith(networkFirst(req));
});
