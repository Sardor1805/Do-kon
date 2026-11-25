// ================= VERSIYA =================
// Har safar GitHub ga push qilganda bu raqamni oshiring
// Masalan: "dokon-v1" -> "dokon-v2" -> "dokon-v3"
// Yoki avtomatik: har safar o'zgarsa yangi kesh yaratiladi
const CACHE = "dokon-admin-v1";

// ================= KESHLANADIGAN FAYLLAR =================
const FAYLLAR = [
  "./",
  "index.html", "index.css", "index.js",
  "sotuv.html", "sotuv.css", "sotuv.js",
  "ombor.html", "ombor.css", "ombor.js",
  "mijoz.html", "mijoz.css", "mijoz.js",
  "qidiruv.html", "qidiruv.css", "qidiruv.js",
  "config.js", "offline.html", "manifest.json",
  "icon-192.png", "icon-512.png"
];

// ================= INSTALL — kesh yaratish =================
self.addEventListener("install", (e) => {
  console.log("[SW] install:", CACHE);
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FAYLLAR))
      .catch((err) => console.warn("[SW] kesh xato:", err))
  );
  // Yangi SW darhol faollashadi
  self.skipWaiting();
});

// ================= ACTIVATE — eski keshni tozalash =================
self.addEventListener("activate", (e) => {
  console.log("[SW] activate:", CACHE);
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE) // faqat eski "dokon-*" keshni o'chirish
          .map((k) => {
            console.log("[SW] eski kesh o'chirilmoqda:", k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      // Barcha ochiq sahifalarga xabar yuborish
      return self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ turi: "YANGILANDI", versiya: CACHE });
        });
      });
    })
  );
  // Darhol boshqaruvni olish
  self.clients.claim();
});

// ================= FETCH — kesh yoki tarmoq =================
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Supabase API so'rovlarini keshlamaymiz — har doim tarmoqdan
  if (url.hostname.includes("supabase.co")) return;

  // Faqat GET so'rovlarini keshlaamiz
  if (e.request.method !== "GET") return;

  // HTML sahifalar — network-first (yangi versiya darhol ko'rinadi)
  if (e.request.mode === "navigate" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Yangi javobni keshga yozamiz
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => {
          // Tarmoq yo'q — keshdan
          return caches.match(e.request).then((k) => k || caches.match("offline.html"));
        })
    );
    return;
  }

  // CSS, JS, rasm — cache-first (tez ishlash)
  e.respondWith(
    caches.match(e.request).then((kesh) => {
      if (kesh) {
        // Fon rejimida yangilash (stale-while-revalidate)
        fetch(e.request)
          .then((res) => {
            if (res.status === 200) {
              caches.open(CACHE).then((c) => c.put(e.request, res));
            }
          })
          .catch(() => {});
        return kesh;
      }
      return fetch(e.request).then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ================= XABAR (sahifadan) =================
self.addEventListener("message", (e) => {
  // Sahifa "skipWaiting" yuborsa — darhol yangilash
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
