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
  });
});

// ================= MIJOZ QO'SHISH =================
document.getElementById("m-qoshish").addEventListener("click", async () => {
  const ismi = document.getElementById("m-ismi").value.trim();
  const telefon = document.getElementById("m-telefon").value.trim();
  if (!ismi) return toast("Ism kiriting", "error");

  const { error } = await sb.from("mijozlar").insert({ ismi, telefon });
  if (error) return toast("Xato: " + error.message, "error");

  toast("Mijoz qo'shildi", "ok");
  document.getElementById("m-ismi").value = "";
  document.getElementById("m-telefon").value = "";
  mijozlarniYukla();
});

// ================= MIJOZLAR RO'YXATI =================
async function mijozlarniYukla() {
  const el = document.getElementById("mijozlar-royxat");
  el.innerHTML = `<div class="mijoz-bosh">Yuklanmoqda...</div>`;

  const { data: mijozlar } = await sb.from("mijozlar").select("*").order("ismi");
  if (!mijozlar || !mijozlar.length) {
    el.innerHTML = `<div class="mijoz-bosh">Mijoz yo'q</div>`;
    return;
  }

  // Har bir mijoz uchun qarz hisoblash
  const { data: sotuvlar } = await sb.from("sotuvlar")
    .select("mijoz_id, sotuv_narx").eq("tolov_turi", "nasiya");
  const { data: tolovlar } = await sb.from("tolovlar").select("mijoz_id, summa");

  const qarzMap = {};
  (sotuvlar || []).forEach(s => {
    qarzMap[s.mijoz_id] = (qarzMap[s.mijoz_id] || 0) + Number(s.sotuv_narx);
  });
  (tolovlar || []).forEach(t => {
    qarzMap[t.mijoz_id] = (qarzMap[t.mijoz_id] || 0) - Number(t.summa);
  });

  el.innerHTML = mijozlar.map(m => {
    const qarz = Math.max(0, qarzMap[m.id] || 0);
    const boshHarf = (m.ismi || "?").charAt(0).toUpperCase();
    return `<div class="mijoz-item" data-id="${m.id}">
      <div class="mijoz-avatar">${boshHarf}</div>
      <div class="mijoz-info">
        <div class="mijoz-ismi">${m.ismi}</div>
        <div class="mijoz-tel">${m.telefon || "—"}</div>
      </div>
      <div class="mijoz-qarz ${qarz === 0 ? "nol" : ""}">${fmtSom(qarz)}</div>
    </div>`;
  }).join("");

  el.querySelectorAll(".mijoz-item").forEach(item => {
    item.addEventListener("click", () => kartaOch(item.dataset.id));
  });
}

// ================= MIJOZ KARTASI =================
let joriyMijoz = null;

async function kartaOch(id) {
  const { data: m } = await sb.from("mijozlar").select("*").eq("id", id).single();
  if (!m) return;
  joriyMijoz = m;

  document.getElementById("karta-ismi").textContent = m.ismi;
  document.getElementById("karta-tel").textContent = m.telefon || "—";

  // Nasiya sotuvlar (to'lanmagan)
  const { data: haridlar } = await sb.from("sotuvlar")
    .select("*, tavarlar(kod, model, marka)")
    .eq("mijoz_id", id)
    .eq("tolov_turi", "nasiya")
    .order("sana", { ascending: false });

  // To'lovlar tarixi
  const { data: tolovlar } = await sb.from("tolovlar")
    .select("*")
    .eq("mijoz_id", id)
    .order("sana", { ascending: false });

  // Umumiy qarz = haridlar - to'lovlar
  const jamiHarid = (haridlar || []).reduce((a, h) => a + Number(h.sotuv_narx), 0);
  const jamiTolov = (tolovlar || []).reduce((a, t) => a + Number(t.summa), 0);
  const qarz = Math.max(0, jamiHarid - jamiTolov);

  document.getElementById("karta-qarz").textContent = fmtSom(qarz);

  // ---- TO'LANMAGAN HARIDLAR ----
  const elH = document.getElementById("karta-haridlar");
  if (!haridlar || !haridlar.length) {
    elH.innerHTML = `<div class="harid-bosh">To'lanmagan harid yo'q</div>`;
  } else {
    elH.innerHTML = haridlar.map(h => {
      const t = h.tavarlar || {};
      return `<div class="harid-item">
        <div class="harid-yuqori">
          <div>
            <div class="harid-nom">${t.kod || "—"} · ${t.model || ""} ${t.marka || ""}</div>
            <div class="harid-sana">${fmtSana(h.sana)}</div>
          </div>
          <div class="harid-sum">${fmtSom(h.sotuv_narx)}</div>
        </div>
        <div class="harid-amallar">
          <button class="harid-tolash" data-id="${h.id}" data-sum="${h.sotuv_narx}">To'lash</button>
          <button class="harid-bekor" data-id="${h.id}">✕</button>
        </div>
      </div>`;
    }).join("");

    elH.querySelectorAll(".harid-tolash").forEach(b => {
      b.addEventListener("click", () => tolash(b.dataset.id, Number(b.dataset.sum)));
    });
    elH.querySelectorAll(".harid-bekor").forEach(b => {
      b.addEventListener("click", () => haridBekor(b.dataset.id));
    });
  }

  // ---- TO'LOVLAR TARIXI ----
  const elT = document.getElementById("karta-tolovlar");
  if (!tolovlar || !tolovlar.length) {
    elT.innerHTML = `<div class="tolov-bosh">To'lov tarixi yo'q</div>`;
  } else {
    elT.innerHTML = tolovlar.map(t => `
      <div class="tolov-item">
        <span class="tolov-icon">✓</span>
        <div class="tolov-info">
          <div class="tolov-sum">${fmtSom(t.summa)}</div>
          <div class="tolov-sana">${fmtSana(t.sana)}</div>
        </div>
        <button class="tolov-bekor" data-id="${t.id}" data-sum="${t.summa}">✕</button>
      </div>
    `).join("");

    elT.querySelectorAll(".tolov-bekor").forEach(b => {
      b.addEventListener("click", () => tolovBekor(b.dataset.id, Number(b.dataset.sum)));
    });
  }

  document.getElementById("karta-modal").classList.remove("gizli");
}

document.getElementById("karta-yop").addEventListener("click", () => {
  document.getElementById("karta-modal").classList.add("gizli");
  joriyMijoz = null;
});

// ================= TO'LASH (qarz to'lash) =================
async function tolash(sotuvId, summa) {
  if (!confirm(`${fmtSom(summa)} to'lov qilinsinmi?`)) return;

  const { error } = await sb.from("tolovlar").insert({
    mijoz_id: joriyMijoz.id,
    summa: summa,
  });

  if (error) return toast("Xato: " + error.message, "error");

  // Amallar log ga yozish (ixtiyoriy, tarix uchun)
  await sb.from("amallar_log").insert({
    turi: "tolov",
    tavsif: `${joriyMijoz.ismi} — ${fmtSom(summa)} to'lov`,
    payload: { mijoz_id: joriyMijoz.id },
  });

  toast("To'lov saqlandi", "ok");
  kartaOch(joriyMijoz.id);
  mijozlarniYukla();
}

// ================= TO'LOVNI BEKOR QILISH =================
async function tolovBekor(tolovId, summa) {
  if (!confirm(`${fmtSom(summa)} to'lovni bekor qilishni tasdiqlaysizmi?`)) return;

  const { error } = await sb.from("tolovlar").delete().eq("id", tolovId);
  if (error) return toast("Xato: " + error.message, "error");

  toast("To'lov bekor qilindi", "ok");
  kartaOch(joriyMijoz.id);
  mijozlarniYukla();
}

// ================= HARIDNI BEKOR QILISH =================
async function haridBekor(sotuvId) {
  if (!confirm("Bu haridni bekor qilishni tasdiqlaysizmi? Tavar omborga qaytariladi.")) return;

  const { data: s } = await sb.from("sotuvlar").select("tavar_id").eq("id", sotuvId).single();
  if (s) {
    const { data: t } = await sb.from("tavarlar").select("soni").eq("id", s.tavar_id).single();
    if (t) await sb.from("tavarlar").update({ soni: t.soni + 1 }).eq("id", s.tavar_id);
  }
  await sb.from("sotuvlar").delete().eq("id", sotuvId);

  toast("Harid bekor qilindi", "ok");
  kartaOch(joriyMijoz.id);
  mijozlarniYukla();
}

// ================= HARID BEKOR QILISH =================
async function haridBekor(sotuvId) {
  if (!confirm("Bu haridni bekor qilishni tasdiqlaysizmi? Tavar omborga qaytariladi.")) return;

  // Sotuvni o'chirish + omborga qaytarish
  const { data: s } = await sb.from("sotuvlar").select("tavar_id").eq("id", sotuvId).single();
  if (s) {
    const { data: t } = await sb.from("tavarlar").select("soni").eq("id", s.tavar_id).single();
    if (t) await sb.from("tavarlar").update({ soni: t.soni + 1 }).eq("id", s.tavar_id);
  }
  await sb.from("sotuvlar").delete().eq("id", sotuvId);

  toast("Harid bekor qilindi", "ok");
  kartaOch(joriyMijoz.id);
  mijozlarniYukla();
}

// ================= EXCEL EKSPORT =================
document.getElementById("excel-btn").addEventListener("click", async () => {
  if (!joriyMijoz) return;

  const { data: haridlar } = await sb.from("sotuvlar")
    .select("*, tavarlar(kod, model, marka)")
    .eq("mijoz_id", joriyMijoz.id)
    .order("sana", { ascending: false });

  const { data: tolovlar } = await sb.from("tolovlar")
    .select("*").eq("mijoz_id", joriyMijoz.id).order("sana", { ascending: false });

  const haridlarSheet = (haridlar || []).map(h => ({
    "Sana": fmtSana(h.sana),
    "Kod": h.tavarlar?.kod || "",
    "Model": h.tavarlar?.model || "",
    "Marka": h.tavarlar?.marka || "",
    "Summa": Number(h.sotuv_narx),
    "To'lov turi": h.tolov_turi,
  }));

  const tolovlarSheet = (tolovlar || []).map(t => ({
    "Sana": fmtSana(t.sana),
    "To'lov summasi": Number(t.summa),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(haridlarSheet), "Haridlar");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tolovlarSheet), "To'lovlar");
  XLSX.writeFile(wb, `mijoz_${joriyMijoz.ismi.replace(/\s+/g, "_")}.xls`);

  toast("Excel yuklandi", "ok");
});

// ================= USTAMA =================
document.querySelectorAll(".u-opt").forEach(opt => {
  opt.addEventListener("click", () => {
    document.querySelectorAll(".u-opt").forEach(o => o.classList.remove("aktiv"));
    opt.classList.add("aktiv");
  });
});

document.getElementById("u-saqlash").addEventListener("click", async () => {
  const tur_id = document.getElementById("u-tur").value;
  const turi = document.querySelector('input[name="u-turi"]:checked').value;
  const qiymat = Number(document.getElementById("u-qiymat").value);

  if (!tur_id) return toast("Tur tanlang", "error");
  if (!qiymat || qiymat < 0) return toast("Qiymat kiriting", "error");

  const payload = {
    tur_id,
    foiz: turi === "foiz" ? qiymat : 0,
    qiymat: turi === "qiymat" ? qiymat : 0,
  };

  // upsert (tur_id unique)
  const { error } = await sb.from("ustamalar").upsert(payload, { onConflict: "tur_id" });
  if (error) return toast("Xato: " + error.message, "error");

  toast("Ustama saqlandi", "ok");
  document.getElementById("u-qiymat").value = "";
  ustamalarniYukla();
});

async function ustamalarniYukla() {
  const el = document.getElementById("ustamalar-royxat");
  el.innerHTML = `<div class="amal-bosh">Yuklanmoqda...</div>`;

  const { data } = await sb.from("ustamalar")
    .select("*, turlar(nomi)").order("id");

  if (!data || !data.length) {
    el.innerHTML = `<div class="amal-bosh">Ustama yo'q</div>`;
    return;
  }

  el.innerHTML = data.map(u => {
    const matn = u.foiz > 0 ? `${u.foiz}%` : `${fmtSom(u.qiymat)} so'm`;
    return `<div class="amal">
      <span class="amal-tavsif">${u.turlar?.nomi || "—"}</span>
      <span class="amal-val">${matn}</span>
      <button class="amal-ochir" data-id="${u.id}">✕</button>
    </div>`;
  }).join("");

  el.querySelectorAll(".amal-ochir").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("Ustamani o'chirish?")) return;
      await sb.from("ustamalar").delete().eq("id", b.dataset.id);
      ustamalarniYukla();
    });
  });
}

// ================= TURLARNI BOSHQARISH =================
document.getElementById("tur-qoshish").addEventListener("click", async () => {
  const nomi = document.getElementById("tur-nomi").value.trim();
  if (!nomi) return toast("Tur nomini kiriting", "error");

  const { error } = await sb.from("turlar").insert({ nomi });
  if (error) return toast("Xato: " + error.message, "error");

  toast("Tur qo'shildi", "ok");
  document.getElementById("tur-nomi").value = "";
  turlarniYukla();
});

async function turlarniYukla() {
  // Select uchun
  const { data } = await sb.from("turlar").select("id, nomi").order("nomi");
  const sel = document.getElementById("u-tur");
  sel.innerHTML = `<option value="">— Tur tanlang —</option>` +
    (data || []).map(t => `<option value="${t.id}">${t.nomi}</option>`).join("");

  // Chip ro'yxati uchun
  const el = document.getElementById("turlar-royxat");
  if (!data || !data.length) {
    el.innerHTML = `<div class="amal-bosh">Tur yo'q</div>`;
    return;
  }
  el.innerHTML = data.map(t => `
    <div class="tur-chip">
      ${t.nomi}
      <button data-id="${t.id}">✕</button>
    </div>`).join("");

  el.querySelectorAll(".tur-chip button").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("Tur o'chirilsinmi? Unga bog'liq tavarlar 'Boshqa' bo'lib qoladi.")) return;
      await sb.from("turlar").delete().eq("id", b.dataset.id);
      turlarniYukla();
      ustamalarniYukla();
    });
  });
}

// ================= ISHGA TUSHIRISH =================
mijozlarniYukla();
turlarniYukla();
ustamalarniYukla();