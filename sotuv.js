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
    // "tavar" -> "sotuv" ga aylantirish (amallar_log dagi turi bilan mos)
    const logTuri = btn.dataset.tab === "tavar" ? "sotuv" : btn.dataset.tab;
    amallarniYukla(logTuri);
  });
});

// ================= TAVAR QIDIRISH (case-insensitive) =================
let joriyTavar = null;
const kodInput = document.getElementById("tavar-kod");

kodInput.addEventListener("input", async () => {
  const kod = kodInput.value.trim();
  const info = document.getElementById("tavar-info");
  joriyTavar = null;
  if (!kod) { info.classList.add("gizli"); return; }

  console.log("[QIDIRUV] kod:", kod);

  const { data, error } = await sb.from("tavarlar")
    .select("*, turlar(nomi)")
    .ilike("kod", `%${kod}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[QIDIRUV] xato:", error);
    info.classList.remove("gizli");
    info.classList.add("yoq");
    info.innerHTML = `<div class="nom">Qidiruv xatosi</div><div class="qator"><span>${error.message}</span></div>`;
    return;
  }

  if (data) {
    joriyTavar = data;
    console.log("[QIDIRUV] topildi:", data);
    info.classList.remove("gizli", "yoq");
    info.innerHTML = `
      <div class="nom">${data.model || ""} ${data.marka || ""}</div>
      <div class="qator"><span>Kod</span><b>${data.kod}</b></div>
      <div class="qator"><span>Tur</span><b>${data.turlar?.nomi || "—"}</b></div>
      <div class="qator"><span>Tan narx</span><b>${fmtSom(data.tan_narx)}</b></div>
      <div class="qator"><span>Omborda</span><b>${data.soni} ta</b></div>`;
    if (!document.getElementById("sotuv-narx").value) {
      document.getElementById("sotuv-narx").value = data.tan_narx || "";
    }
  } else {
    console.log("[QIDIRUV] topilmadi");
    info.classList.remove("gizli");
    info.classList.add("yoq");
    info.innerHTML = `<div class="nom">Kod topilmadi</div><div class="qator"><span>Omborda bu kod yo'q</span></div>`;
  }
});

// ================= TO'LOV TURI — TAVAR =================
document.querySelectorAll('input[name="tolov"]').forEach(r => {
  r.addEventListener("change", () => {
    const nasiya = document.querySelector('input[name="tolov"]:checked').value === "nasiya";
    document.getElementById("mijoz-blok").classList.toggle("gizli", !nasiya);
  });
});

// ================= TO'LOV TURI — XIZMAT =================
document.querySelectorAll('input[name="xizmat-tolov"]').forEach(r => {
  r.addEventListener("change", () => {
    const nasiya = document.querySelector('input[name="xizmat-tolov"]:checked').value === "nasiya";
    document.getElementById("xizmat-mijoz-blok").classList.toggle("gizli", !nasiya);
  });
});

// ================= MIJOZLARNI YUKLASH =================
async function mijozlarniYukla() {
  const { data } = await sb.from("mijozlar").select("id, ismi").order("ismi");
  const ops = `<option value="">— Mijoz tanlang —</option>` +
    (data || []).map(m => `<option value="${m.id}">${m.ismi}</option>`).join("");
  document.getElementById("mijoz-select").innerHTML = ops;
  document.getElementById("xizmat-mijoz-select").innerHTML = ops;
}

// ================= TAVAR SOTISH =================
document.getElementById("tavar-saqlash").addEventListener("click", async () => {
  console.log("========== TAVAR SOTISH BOSHLANDI ==========");

  const kod = kodInput.value.trim();
  const narx = Number(document.getElementById("sotuv-narx").value);
  const tolov = document.querySelector('input[name="tolov"]:checked').value;
  const mijozId = document.getElementById("mijoz-select").value || null;

  console.log("kod:", kod, "narx:", narx, "tolov:", tolov, "mijozId:", mijozId);
  console.log("joriyTavar:", joriyTavar);

  if (!kod) return toast("Tavar kodini kiriting", "error");
  if (!joriyTavar) return toast("Bunday kod omborda yo'q", "error");
  if (!narx || narx <= 0) return toast("Sotuv narxini kiriting", "error");
  if (joriyTavar.soni < 1) return toast("Omborda tavar qolmagan", "error");
  if (tolov === "nasiya" && !mijozId) return toast("Nasiyada mijoz majburiy", "error");

  const btn = document.getElementById("tavar-saqlash");
  btn.disabled = true;

  // ---------- QADAM 1: sotuvlar ga yozish ----------
  console.log("[1] sotuvlar ga yozilmoqda...");
  const sotuvPayload = {
    tavar_id: joriyTavar.id,
    sotuv_narx: narx,
    tolov_turi: tolov,
    mijoz_id: mijozId,
  };
  console.log("[1] payload:", sotuvPayload);

  const { data: sotuv, error: sotuvError } = await sb.from("sotuvlar")
    .insert(sotuvPayload)
    .select()
    .single();

  if (sotuvError) {
    console.error("[1] XATO:", sotuvError);
    toast("Sotuv xato: " + sotuvError.message, "error");
    btn.disabled = false;
    return;
  }
  console.log("[1] OK, sotuv:", sotuv);

  // ---------- QADAM 2: ombordan kamaytirish ----------
  console.log("[2] ombordan kamaytirilmoqda...");
  const { error: updateError } = await sb.from("tavarlar")
    .update({ soni: joriyTavar.soni - 1 })
    .eq("id", joriyTavar.id);
  if (updateError) console.error("[2] XATO:", updateError);
  else console.log("[2] OK");

  // ---------- QADAM 3: amallar_log ga yozish ----------
  console.log("[3] amallar_log ga yozilmoqda...");
  const logPayload = {
    turi: "sotuv",
    tavsif: `${joriyTavar.kod} sotildi — ${fmtSom(narx)} (${tolov})`,
    payload: {
      sotuv_id: sotuv.id,
      tavar_id: joriyTavar.id,
      soni_oldingi: joriyTavar.soni,
    },
  };
  console.log("[3] payload:", logPayload);

  const { data: logData, error: logError } = await sb.from("amallar_log")
    .insert(logPayload)
    .select()
    .single();

  if (logError) {
    console.error("[3] XATO:", logError);
    toast("Log xato: " + logError.message, "error");
  } else {
    console.log("[3] OK, log:", logData);
    toast("Sotuv saqlandi", "ok");
  }

  // ---------- TOZALASH ----------
  kodInput.value = "";
  document.getElementById("sotuv-narx").value = "";
  document.getElementById("tavar-info").classList.add("gizli");
  joriyTavar = null;
  btn.disabled = false;

  console.log("========== TUGADI ==========");

  // Amallarni qayta yuklash — "sotuv" turi bilan
  await amallarniYukla("sotuv");
});

// ================= XIZMAT =================
document.getElementById("xizmat-saqlash").addEventListener("click", async () => {
  const izoh = document.getElementById("xizmat-izoh").value.trim();
  const narx = Number(document.getElementById("xizmat-narx").value);
  const tolov_turi = document.querySelector('input[name="xizmat-tolov"]:checked').value;
  const mijozId = document.getElementById("xizmat-mijoz-select").value || null;

  if (!izoh) return toast("Izoh kiriting", "error");
  if (!narx || narx <= 0) return toast("Narx kiriting", "error");
  if (tolov_turi === "nasiya" && !mijozId) return toast("Nasiyada mijoz majburiy", "error");

  const btn = document.getElementById("xizmat-saqlash");
  btn.disabled = true;

  const insertData = { izoh, narx, tolov_turi };
  if (tolov_turi === "nasiya" && mijozId) insertData.mijoz_id = Number(mijozId);

  const { data, error } = await sb.from("xizmatlar").insert(insertData).select().single();
  if (error) {
    console.error("xizmat insert xato:", error);
    toast("Xato: " + error.message, "error");
    btn.disabled = false;
    return;
  }

  await sb.from("amallar_log").insert({
    turi: "xizmat",
    tavsif: `Xizmat: ${izoh} — ${fmtSom(narx)} (${tolov_turi})`,
    payload: { xizmat_id: data.id },
  });

  toast("Xizmat saqlandi", "ok");
  document.getElementById("xizmat-izoh").value = "";
  document.getElementById("xizmat-narx").value = "";
  document.querySelector('input[name="xizmat-tolov"][value="naqd"]').checked = true;
  document.getElementById("xizmat-mijoz-blok").classList.add("gizli");
  btn.disabled = false;
  amallarniYukla("xizmat");
});

// ================= XARAJAT (3 to'lov turi) =================
document.getElementById("xarajat-saqlash").addEventListener("click", async () => {
  const izoh = document.getElementById("xarajat-izoh").value.trim();
  const narx = Number(document.getElementById("xarajat-narx").value);
  const tolov_turi = document.querySelector('input[name="xarajat-tolov"]:checked').value;

  if (!izoh) return toast("Izoh kiriting", "error");
  if (!narx || narx <= 0) return toast("Narx kiriting", "error");

  const btn = document.getElementById("xarajat-saqlash");
  btn.disabled = true;

  const { data, error } = await sb.from("xarajatlar").insert({ izoh, narx, tolov_turi }).select().single();
  if (error) {
    console.error("xarajat insert xato:", error);
    toast("Xato: " + error.message, "error");
    btn.disabled = false;
    return;
  }

  await sb.from("amallar_log").insert({
    turi: "xarajat",
    tavsif: `Xarajat: ${izoh} — ${fmtSom(narx)} (${tolov_turi})`,
    payload: { xarajat_id: data.id },
  });

  toast("Xarajat saqlandi", "ok");
  document.getElementById("xarajat-izoh").value = "";
  document.getElementById("xarajat-narx").value = "";
  document.querySelector('input[name="xarajat-tolov"][value="naqd"]').checked = true;
  btn.disabled = false;
  amallarniYukla("xarajat");
});

// ================= OXIRGI 10 AMAL =================
async function amallarniYukla(turi) {
  const konteyner = document.getElementById("amallar-" + (turi === "sotuv" ? "tavar" : turi));
  if (!konteyner) {
    console.warn("[AMALLAR] konteyner topilmadi:", turi);
    return;
  }
  konteyner.innerHTML = `<div class="amal-bosh">Yuklanmoqda...</div>`;

  console.log("[AMALLAR] yuklanmoqda, turi:", turi);

  const { data, error } = await sb.from("amallar_log")
    .select("*")
    .eq("turi", turi)
    .order("sana", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[AMALLAR] xato:", error);
    konteyner.innerHTML = `<div class="amal-bosh">Xato: ${error.message}</div>`;
    return;
  }

  console.log("[AMALLAR] natija:", data);

  if (!data || !data.length) {
    konteyner.innerHTML = `<div class="amal-bosh">Amal yo'q</div>`;
    return;
  }

  konteyner.innerHTML = data.map(a => `
    <div class="amal ${a.bekor_qilindi ? "bekor" : ""}">
      <span class="amal-tavsif">${a.tavsif}</span>
      <span class="amal-vaqt">${fmtSana(a.sana)}</span>
      ${a.bekor_qilindi ? "" : `<button class="amal-bekor" data-id="${a.id}" data-turi="${a.turi}">✕</button>`}
    </div>
  `).join("");

  konteyner.querySelectorAll(".amal-bekor").forEach(b => {
    b.addEventListener("click", () => bekorQil(b.dataset.id, b.dataset.turi));
  });
}

// ================= BEKOR QILISH =================
async function bekorQil(logId, turi) {
  if (!confirm("Bu amalni bekor qilishni tasdiqlaysizmi?")) return;

  console.log("[BEKOR] logId:", logId, "turi:", turi);

  const { data: log, error: logError } = await sb.from("amallar_log")
    .select("payload").eq("id", logId).single();

  if (logError || !log) {
    console.error("[BEKOR] log topilmadi:", logError);
    toast("Log topilmadi", "error");
    return;
  }

  const payload = log.payload || {};
  console.log("[BEKOR] payload:", payload);

  if (turi === "sotuv") {
    if (payload.sotuv_id) await sb.from("sotuvlar").delete().eq("id", payload.sotuv_id);
    if (payload.tavar_id) {
      const { data: t } = await sb.from("tavarlar").select("soni").eq("id", payload.tavar_id).single();
      if (t) await sb.from("tavarlar").update({ soni: t.soni + 1 }).eq("id", payload.tavar_id);
    }
  } else if (turi === "xizmat") {
    if (payload.xizmat_id) await sb.from("xizmatlar").delete().eq("id", payload.xizmat_id);
  } else if (turi === "xarajat") {
    if (payload.xarajat_id) await sb.from("xarajatlar").delete().eq("id", payload.xarajat_id);
  }

  await sb.from("amallar_log").update({ bekor_qilindi: true }).eq("id", logId);
  toast("Bekor qilindi", "ok");
  amallarniYukla(turi);
}

// ================= SKANER =================
let skaner = null;
document.getElementById("skaner-btn").addEventListener("click", () => {
  document.getElementById("skaner-modal").classList.remove("gizli");
  skaner = new Html5Qrcode("skaner-reader");
  skaner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    (matn) => {
      kodInput.value = matn;
      kodInput.dispatchEvent(new Event("input"));
      skanerniYop();
    },
    () => {}
  ).catch(e => toast("Kamera xatosi: " + e, "error"));
});

function skanerniYop() {
  document.getElementById("skaner-modal").classList.add("gizli");
  if (skaner) { skaner.stop().catch(() => {}); skaner = null; }
}
document.getElementById("skaner-yop").addEventListener("click", skanerniYop);

// ================= ISHGA TUSHIRISH =================
mijozlarniYukla();
amallarniYukla("sotuv");