// ================= SOAT =================
function soatniYangila() {
  document.getElementById("soat").textContent = new Date().toTimeString().slice(0, 5);
}
setInterval(soatniYangila, 1000);
soatniYangila();
tablarniChiz();

// ================= GLOBAL =================
let barchaTavarlar = [];
let ustamaMap = {};

// ================= TURLARNI YUKLASH (faqat soni > 0) =================
async function turlarniYukla() {
  // Faqat soni > 0 bo'lgan tavarlar mavjud turlarni olamiz
  const { data: tavarlar } = await sb.from("tavarlar")
    .select("tur_id, turlar(id, nomi)")
    .gt("soni", 0);

  const turMap = {};
  (tavarlar || []).forEach(t => {
    if (t.turlar) turMap[t.turlar.id] = t.turlar.nomi;
  });

  const sel = document.getElementById("f-tur");
  const joriy = sel.value;
  sel.innerHTML = `<option value="">— Barchasi —</option>` +
    Object.entries(turMap)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, nomi]) => `<option value="${id}">${nomi}</option>`)
      .join("");

  if (joriy && turMap[joriy]) sel.value = joriy;
}

// ================= TAVARLARNI YUKLASH =================
async function tavarlarniYukla() {
  const { data } = await sb.from("tavarlar")
    .select("*, turlar(nomi)")
    .order("kod");
  barchaTavarlar = data || [];

  // Ustamalar
  const { data: u } = await sb.from("ustamalar").select("tur_id, foiz, qiymat");
  ustamaMap = {};
  (u || []).forEach(x => (ustamaMap[x.tur_id] = x));

  // Tur filtri (faqat soni > 0)
  await turlarniYukla();
  // Model filtri
  modelFiltrniYangila();
  qidir();
}

// ================= MODEL FILTRI (faqat soni > 0) =================
function modelFiltrniYangila() {
  const turId = document.getElementById("f-tur").value;
  const sel = document.getElementById("f-model");
  const joriy = sel.value;

  const modellar = new Set();
  barchaTavarlar.forEach(t => {
    if (Number(t.soni) <= 0) return; // soni 0 bo'lsa o'tkazib yuboramiz
    if (turId && String(t.tur_id) !== String(turId)) return;
    if (t.model) modellar.add(t.model);
  });

  sel.innerHTML = `<option value="">— Barchasi —</option>` +
    [...modellar].sort().map(m => `<option value="${m}">${m}</option>`).join("");

  if (joriy && [...modellar].includes(joriy)) sel.value = joriy;
}

// ================= SOTUV NARXINI HISOBLASH =================
function sotuvNarxHisobla(t) {
  const u = ustamaMap[t.tur_id];
  if (!u) return t.tan_narx || 0;
  let narx = Number(t.tan_narx) || 0;
  if (u.foiz > 0) narx += narx * (Number(u.foiz) / 100);
  if (u.qiymat > 0) narx += Number(u.qiymat);
  return Math.round(narx);
}

// ================= ASOSIY QIDIRUV =================
function qidir() {
  const turId = document.getElementById("f-tur").value;
  const model = document.getElementById("f-model").value;
  const matn = document.getElementById("q-input").value;

  // Faqat soni > 0 bo'lgan tavarlar
  let natija = barchaTavarlar.filter(t => Number(t.soni) > 0);

  // Tur filtri
  if (turId) natija = natija.filter(t => String(t.tur_id) === String(turId));

  // Model filtri
  if (model) natija = natija.filter(t => t.model === model);

  // So'z bo'yicha qidiruv (ketma-ket toraytirish)
  if (matn.trim()) {
    const sozlar = matn.toLowerCase().trim().split(/\s+/).filter(Boolean);
    for (const soz of sozlar) {
      natija = natija.filter(t => {
        const m = [t.kod, t.model, t.marka, t.turlar?.nomi]
          .filter(Boolean).join(" ").toLowerCase();
        return m.includes(soz);
      });
    }
  }

  // Natija sarlavhasi
  const sarlavha = document.getElementById("natija-sarlavha");
  const soni = natija.length;
  const jamiTavar = natija.reduce((a, t) => a + Number(t.soni || 0), 0);

  if (matn.trim() || turId || model) {
    sarlavha.classList.remove("gizli");
    document.getElementById("natija-soni").textContent = `${soni} ta natija`;
    document.getElementById("natija-jami").textContent = `— jami ${jamiTavar} ta tavar`;
  } else {
    sarlavha.classList.add("gizli");
  }

  // Jadval
  const tbody = document.getElementById("natija-tbody");
  if (!soni) {
    tbody.innerHTML = `<tr><td colspan="5" class="bosh">Natija topilmadi</td></tr>`;
    return;
  }

  tbody.innerHTML = natija.map(t => {
    const sotuv = sotuvNarxHisobla(t);
    const model = t.model || "—";
    const marka = t.marka || "";
    return `<tr>
      <td class="kod">${t.kod}</td>
      <td>
        <div class="model-nom">${model}</div>
        ${marka ? `<div class="marka-nom">${marka}${t.turlar?.nomi ? " · " + t.turlar.nomi : ""}</div>` : ""}
      </td>
      <td class="markaz">${t.soni}</td>
      <td class="ong">${fmtSom(t.tan_narx)}</td>
      <td class="ong">${fmtSom(sotuv)}</td>
    </tr>`;
  }).join("");
}

// ================= HODISALAR =================
document.getElementById("f-tur").addEventListener("change", () => {
  modelFiltrniYangila();
  qidir();
});
document.getElementById("f-model").addEventListener("change", qidir);

let qTimer = null;
document.getElementById("q-input").addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(qidir, 200);
});

document.getElementById("q-tozalash").addEventListener("click", () => {
  document.getElementById("q-input").value = "";
  document.getElementById("f-tur").value = "";
  document.getElementById("f-model").value = "";
  modelFiltrniYangila();
  qidir();
});

// ================= ISHGA TUSHIRISH =================
tavarlarniYukla();