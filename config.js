// ================= SUPABASE ULANISH =================
const SUPABASE_URL = "https://jqwckwmsmiieaptqligc.supabase.co";
const SUPABASE_KEY = "sb_publishable_HzrGVUPht9qNLOci6SIZyA_1F-XPROA";

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= UMUMIY YORDAMCHILAR =================

// Pul formatlash: 1250000 -> "1 250 000"
function fmtSom(n) {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString("ru-RU").replace(/,/g, " ");
}

// Sana formatlash
function fmtSana(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ") + " " +
         d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

// Bugungi kun boshlanishi (ISO)
function bugunBoshi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Toast xabar
function toast(msg, tur = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
      "padding:12px 20px;border-radius:10px;color:#fff;font:14px sans-serif;" +
      "z-index:9999;opacity:0;transition:opacity .3s;pointer-events:none;max-width:90%;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background =
    tur === "error" ? "#e53935" : tur === "ok" ? "#2e7d32" : "#333";
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.style.opacity = "0"), 2500);
}

// ================= OFLAYN NAVBAT =================
// Tarmoq yo'q bo'lsa, yozuvni localStorage navbatiga qo'yamiz
function navbatgaQosh(jadval, amal, payload) {
  const q = JSON.parse(localStorage.getItem("navbat") || "[]");
  q.push({ jadval, amal, payload, vaqt: Date.now() });
  localStorage.setItem("navbat", JSON.stringify(q));
}

// Navbatni Supabase ga yuborish
async function navbatniYubor() {
  const q = JSON.parse(localStorage.getItem("navbat") || "[]");
  if (!q.length) return;
  const qoldi = [];
  for (const item of q) {
    try {
      const { error } = await sb.from(item.jadval)[item.amal](item.payload);
      if (error) throw error;
    } catch (e) {
      qoldi.push(item);
    }
  }
  localStorage.setItem("navbat", JSON.stringify(qoldi));
  if (!qoldi.length) toast("Oflayn yozuvlar yuborildi", "ok");
}

// Har 15 sekundda va tarmoq tiklanganda navbatni yuborishga urinish
setInterval(() => {
  if (navigator.onLine) navbatniYubor();
}, 15000);
window.addEventListener("online", navbatniYubor);

// ================= UNIVERSAL YOZISH =================
// INSERT yoki UPDATE — tarmoq bo'lmasa navbatga
async function yoz(jadval, amal, payload, options = {}) {
  if (!navigator.onLine) {
    navbatgaQosh(jadval, amal, payload);
    toast("Oflayn: keyinroq yuboriladi", "info");
    return { data: null, error: null, oflayn: true };
  }
  try {
    let q = sb.from(jadval)[amal](payload);
    if (options.eq) q = q.eq(options.eq[0], options.eq[1]);
    const { data, error } = await q.select();
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    toast("Xato: " + e.message, "error");
    return { data: null, error: e };
  }
}

// ================= PASTKI TAB NAVIGATSIYA =================
const TABLAR = [
  { fayl: "index.html",   nom: "Kassa",   icon: "🏠" },
  { fayl: "sotuv.html",   nom: "Sotuv",   icon: "🛒" },
  { fayl: "ombor.html",   nom: "Ombor",   icon: "📦" },
  { fayl: "mijoz.html",   nom: "Mijoz",   icon: "👤" },
  { fayl: "qidiruv.html", nom: "Qidiruv", icon: "🔍" },
];

function tablarniChiz() {
  const joriy = location.pathname.split("/").pop() || "index.html";
  const nav = document.createElement("nav");
  nav.className = "pastki-tab";
  nav.innerHTML = TABLAR.map(t => `
    <a href="${t.fayl}" class="tab ${t.fayl === joriy ? "aktiv" : ""}">
      <span class="tab-icon">${t.icon}</span>
      <span class="tab-nom">${t.nom}</span>
    </a>
  `).join("");
  document.body.appendChild(nav);
}

// PWA service worker ro'yxatdan o'tkazish
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Pastki tab CSS ni avtomatik qo'shish
const tabCss = document.createElement("style");
tabCss.textContent = `
.pastki-tab{position:fixed;bottom:0;left:0;right:0;display:flex;
  background:#fff;border-top:1px solid #e0e0e0;box-shadow:0 -2px 10px rgba(0,0,0,.05);
  z-index:1000;padding-bottom:env(safe-area-inset-bottom);}
.pastki-tab .tab{flex:1;display:flex;flex-direction:column;align-items:center;
  padding:8px 0;text-decoration:none;color:#888;font-size:12px;transition:.2s;}
.pastki-tab .tab.aktiv{color:#1565c0;}
.pastki-tab .tab-icon{font-size:20px;line-height:1;}
.pastki-tab .tab-nom{margin-top:2px;}
body{padding-bottom:70px;}
`;
document.head.appendChild(tabCss);

