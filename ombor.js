// ================= SOAT =================
function soatniYangila() {
  document.getElementById("soat").textContent = new Date().toTimeString().slice(0, 5);
}
setInterval(soatniYangila, 1000);
soatniYangila();
tablarniChiz();

// ================= TABLAR =================
document.querySelectorAll(".tab-tugma").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-tugma").forEach(b => b.classList.remove("aktiv"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("aktiv"));
    btn.classList.add("aktiv");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("aktiv");
    if (btn.dataset.tab === "kirim") kirimChiqimLogYukla();
  });
});

// ================= TURLAR BO'YICHA JAMLANMA =================
async function turlarYukla() {
  const { data } = await sb.from("tavarlar").select("soni, tan_narx, turlar(nomi)");
  const tbody = document.getElementById("turlar-tbody");
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="bosh">Tavar yo'q</td></tr>`;
    document.getElementById("jami-soni").textContent = "0";
    document.getElementById("jami-tannarx").textContent = "0";
    return;
  }

  const guruh = {};
  data.forEach(t => {
    const nom = t.turlar?.nomi || "Boshqa";
    if (!guruh[nom]) guruh[nom] = { soni: 0, tannarx: 0 };
    guruh[nom].soni += Number(t.soni || 0);
    guruh[nom].tannarx += Number(t.tan_narx || 0) * Number(t.soni || 0);
  });

  let jamiSoni = 0, jamiTannarx = 0;
  tbody.innerHTML = Object.entries(guruh).map(([nom, g]) => {
    jamiSoni += g.soni;
    jamiTannarx += g.tannarx;
    return `<tr>
      <td>${nom}</td>
      <td class="markaz">${g.soni}</td>
      <td class="ong">${fmtSom(g.tannarx)}</td>
    </tr>`;
  }).join("");

  document.getElementById("jami-soni").textContent = jamiSoni;
  document.getElementById("jami-tannarx").textContent = fmtSom(jamiTannarx);
}

// ================= TUR SELECT =================
async function turlarniYukla() {
  const { data } = await sb.from("turlar").select("id, nomi").order("nomi");
  const sel = document.getElementById("t-tur");
  sel.innerHTML = `<option value="">— Tur tanlang —</option>` +
    (data || []).map(t => `<option value="${t.id}">${t.nomi}</option>`).join("");
}

// ================= KOD TEKSHIRISH (bitta tugma logikasi) =================
let joriyTavar = null;
const kodInput = document.getElementById("t-kod");
const holatEl = document.getElementById("t-holat");
const saqlashBtn = document.getElementById("t-saqlash");
const tozalashBtn = document.getElementById("t-tozalash");

kodInput.addEventListener("input", async () => {
  const kod = kodInput.value.trim();
  holatEl.classList.add("gizli");
  joriyTavar = null;
  tozalashBtn.classList.add("gizli");
  if (!kod) { formaniTozalash(); saqlashBtn.textContent = "QO'SHISH"; return; }

  const { data } = await sb.from("tavarlar")
    .select("*, turlar(nomi)")
    .eq("kod", kod)
    .maybeSingle();

  if (data) {
    // MAVJUD → tahrirlash rejimi
    joriyTavar = data;
    holatEl.classList.remove("gizli");
    holatEl.className = "holat bor";
    holatEl.innerHTML = `<div class="nom">✓ Mavjud tavar — tahrirlash</div>
      <div>${data.model || ""} ${data.marka || ""} · ${data.turlar?.nomi || "—"} · ${data.soni} ta</div>`;
    document.getElementById("t-tur").value = data.tur_id || "";
    document.getElementById("t-model").value = data.model || "";
    document.getElementById("t-marka").value = data.marka || "";
    document.getElementById("t-tan-narx").value = data.tan_narx || "";
    document.getElementById("t-soni").value = data.soni || "";
    saqlashBtn.textContent = "TAHRIRLASH";
    saqlashBtn.classList.add("tahrir-btn");
    tozalashBtn.classList.remove("gizli");
  } else {
    // YANGI → qo'shish rejimi
    holatEl.classList.remove("gizli");
    holatEl.className = "holat yangi";
    holatEl.innerHTML = `<div class="nom">+ Yangi tavar</div>
      <div>Bu kod bazada yo'q, qo'shish mumkin</div>`;
    formaniTozalash(true);
    saqlashBtn.textContent = "QO'SHISH";
    saqlashBtn.classList.remove("tahrir-btn");
    tozalashBtn.classList.add("gizli");
  }
});

function formaniTozalash(kodSaqlansin = false) {
  if (!kodSaqlansin) kodInput.value = "";
  document.getElementById("t-tur").value = "";
  document.getElementById("t-model").value = "";
  document.getElementById("t-marka").value = "";
  document.getElementById("t-tan-narx").value = "";
  document.getElementById("t-soni").value = "";
  holatEl.classList.add("gizli");
  joriyTavar = null;
  saqlashBtn.textContent = "QO'SHISH";
  saqlashBtn.classList.remove("tahrir-btn");
  tozalashBtn.classList.add("gizli");
}

tozalashBtn.addEventListener("click", () => formaniTozalash());

// ================= SAQLASH (INSERT yoki UPDATE) =================
saqlashBtn.addEventListener("click", async () => {
  const kod = kodInput.value.trim();
  const tur_id = document.getElementById("t-tur").value || null;
  const model = document.getElementById("t-model").value.trim();
  const marka = document.getElementById("t-marka").value.trim();
  const tan_narx = Number(document.getElementById("t-tan-narx").value) || 0;
  const soni = Number(document.getElementById("t-soni").value) || 0;

  if (!kod) return toast("Kod kiriting", "error");
  if (!tur_id) return toast("Tur tanlang", "error");

  saqlashBtn.disabled = true;

  try {
    if (joriyTavar) {
      const { error } = await sb.from("tavarlar").update({
        tur_id, model, marka, tan_narx, soni
      }).eq("id", joriyTavar.id);
      if (error) throw error;
      toast("Tahrirlandi", "ok");
    } else {
      const { error } = await sb.from("tavarlar").insert({
        kod, tur_id, model, marka, tan_narx, soni
      });
      if (error) throw error;
      toast("Qo'shildi", "ok");
    }
    formaniTozalash();
    turlarYukla();
  } catch (e) {
    toast("Xato: " + e.message, "error");
  }
  saqlashBtn.disabled = false;
});

// ================= KIRIM =================
document.getElementById("kirim-btn").addEventListener("click", async () => {
  const matn = document.getElementById("kirim-kodlar").value.trim();
  if (!matn) return toast("Kodlarni kiriting", "error");

  const kodlar = matn.split(/[\s,]+/).filter(k => k.length > 0);
  if (!kodlar.length) return toast("Kod topilmadi", "error");

  const btn = document.getElementById("kirim-btn");
  btn.disabled = true;

  // Takrorlangan kodlarni hisoblash
  const hisob = {};
  kodlar.forEach(k => (hisob[k] = (hisob[k] || 0) + 1));

  let muvaffaqiyat = 0;
  const topilmadi = [];

  for (const [kod, son] of Object.entries(hisob)) {
    const { data: t } = await sb.from("tavarlar")
      .select("id, soni").eq("kod", kod).maybeSingle();

    if (!t) {
      topilmadi.push({ kod, son });
      continue;
    }

    await sb.from("tavarlar").update({ soni: t.soni + son }).eq("id", t.id);
    await sb.from("kirim_chiqim").insert({
      tavar_id: t.id, turi: "kirim", soni: son, izoh: "Kodlar bo'yicha kirim"
    });
    muvaffaqiyat += son;
  }

  btn.disabled = false;
  document.getElementById("kirim-kodlar").value = "";

  if (topilmadi.length) {
    const jamiYoq = topilmadi.reduce((a, x) => a + x.son, 0);
    toast(
      `Kirim: ${muvaffaqiyat} ta qo'shildi. ${topilmadi.length} ta kod topilmadi (${jamiYoq} ta).`,
      "error"
    );
    topilmadiRoyxat(topilmadi);
  } else {
    toast(`Kirim: ${muvaffaqiyat} ta qo'shildi`, "ok");
    yopTopilmadiRoyxat();
  }

  turlarYukla();
  kirimChiqimLogYukla();
});

// ================= BAZADA YO'Q KODLAR =================
function topilmadiRoyxat(list) {
  const blok = document.getElementById("topilmadi-blok");
  const el = document.getElementById("topilmadi-royxat");

  el.innerHTML = list.map(x => `
    <div class="topilmadi-chip">
      ${x.kod}
      ${x.son > 1 ? `<span class="son">×${x.son}</span>` : ""}
    </div>
  `).join("");

  blok.classList.remove("gizli");
  blok.scrollIntoView({ behavior: "smooth", block: "center" });
}

function yopTopilmadiRoyxat() {
  document.getElementById("topilmadi-blok").classList.add("gizli");
  document.getElementById("topilmadi-royxat").innerHTML = "";
}

document.getElementById("topilmadi-yop").addEventListener("click", yopTopilmadiRoyxat);

// ================= CHIQIM =================
document.getElementById("chiqim-btn").addEventListener("click", async () => {
  const kod = document.getElementById("chiqim-kod").value.trim();
  const soni = Number(document.getElementById("chiqim-soni").value);
  const izoh = document.getElementById("chiqim-izoh").value.trim();

  if (!kod) return toast("Kod kiriting", "error");
  if (!soni || soni <= 0) return toast("Soni kiriting", "error");

  const { data: t } = await sb.from("tavarlar").select("id, soni").eq("kod", kod).maybeSingle();
  if (!t) return toast("Bunday kod omborda yo'q", "error");
  if (t.soni < soni) return toast(`Omborda faqat ${t.soni} ta bor`, "error");

  await sb.from("tavarlar").update({ soni: t.soni - soni }).eq("id", t.id);
  await sb.from("kirim_chiqim").insert({
    tavar_id: t.id, turi: "chiqim", soni, izoh: izoh || "Chiqim"
  });

  toast("Chiqim saqlandi", "ok");
  document.getElementById("chiqim-kod").value = "";
  document.getElementById("chiqim-soni").value = "";
  document.getElementById("chiqim-izoh").value = "";
  turlarYukla();
  kirimChiqimLogYukla();
});

// ================= KIRIM/CHIQIM LOG =================
async function kirimChiqimLogYukla() {
  const el = document.getElementById("kirim-chiqim-log");
  el.innerHTML = `<div class="amal-bosh">Yuklanmoqda...</div>`;

  const { data } = await sb.from("kirim_chiqim")
    .select("*, tavarlar(kod, model)")
    .order("sana", { ascending: false })
    .limit(10);

  if (!data || !data.length) {
    el.innerHTML = `<div class="amal-bosh">Amal yo'q</div>`;
    return;
  }

  el.innerHTML = data.map(k => {
    const t = k.tavarlar || {};
    const belgi = k.turi === "kirim" ? "📥" : "📤";
    const rang = k.turi === "kirim" ? "var(--yashil)" : "var(--qizil)";
    return `<div class="amal">
      <span style="color:${rang}">${belgi}</span>
      <span class="amal-tavsif">${t.kod || "—"} — ${k.soni} ta ${k.izoh ? "· " + k.izoh : ""}</span>
      <span class="amal-vaqt">${fmtSana(k.sana)}</span>
    </div>`;
  }).join("");
}

// ================= ISHGA TUSHIRISH =================
turlarYukla();
turlarniYukla();