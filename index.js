// ================= SOAT =================
function soatniYangila() {
  const d = new Date();
  document.getElementById("soat").textContent = d.toTimeString().slice(0, 5);
}
setInterval(soatniYangila, 1000);
soatniYangila();

// Pastki tablarni chizish
tablarniChiz();

// ================= YANGILASH =================
document.getElementById("yangila").addEventListener("click", yukla);

// ================= ASOSIY YUKLASH =================
async function yukla() {
  const boshi = bugunBoshi();
  const btn = document.getElementById("yangila");
  btn.style.transform = "rotate(360deg)";
  setTimeout(() => (btn.style.transform = ""), 400);

  try {
    // ---- BARCHA sotuvlar (kassa holati uchun) ----
    const { data: barchaSotuvlar } = await sb
      .from("sotuvlar")
      .select("sotuv_narx, tolov_turi");

    // ---- BARCHA xizmatlar ----
    const { data: barchaXizmatlar } = await sb
      .from("xizmatlar")
      .select("narx, tolov_turi");

    // ---- BARCHA xarajatlar ----
    const { data: barchaXarajatlar } = await sb
      .from("xarajatlar")
      .select("narx, tolov_turi");

    // ---- Barcha nasiya sotuvlar va to'lovlar (qarz uchun) ----
    const { data: nasiyaSotuvlar } = await sb
      .from("sotuvlar")
      .select("sotuv_narx")
      .eq("tolov_turi", "nasiya");
    const { data: tolovlar } = await sb.from("tolovlar").select("summa");

    // ---- BUGUNGI sotuvlar (kunlik + jadval uchun) ----
    const { data: bugungiSotuvlar } = await sb
      .from("sotuvlar")
      .select("*, tavarlar(kod, model, marka, tan_narx), mijozlar(ismi)")
      .gte("sana", boshi);

    // ---- BUGUNGI xizmatlar ----
    const { data: bugungiXizmatlar } = await sb
      .from("xizmatlar")
      .select("narx")
      .gte("sana", boshi);

    // ---- BUGUNGI xarajatlar ----
    const { data: bugungiXarajatlar } = await sb
      .from("xarajatlar")
      .select("narx")
      .gte("sana", boshi);

    hisoblaKassa(
      barchaSotuvlar || [],
      barchaXizmatlar || [],
      barchaXarajatlar || [],
      nasiyaSotuvlar || [],
      tolovlar || []
    );

    hisoblaKunlik(
      bugungiSotuvlar || [],
      bugungiXizmatlar || [],
      bugungiXarajatlar || []
    );

    jadvalChiz(bugungiSotuvlar || []);
  } catch (e) {
    toast("Yuklashda xato: " + e.message, "error");
  }
}

// ================= KASSA HOLATI (JAMI) =================
// Naqd/Karta/Plastik = barcha sotuv + xizmat - xarajat
// Qarz = barcha nasiya sotuv - to'lovlar
function hisoblaKassa(sotuvlar, xizmatlar, xarajatlar, nasiyaSotuvlar, tolovlar) {
  const kassa = { naqd: 0, karta: 0, plastik: 0 };

  // Sotuvlar (kirim)
  sotuvlar.forEach(s => {
    const sum = Number(s.sotuv_narx) || 0;
    if (s.tolov_turi === "naqd") kassa.naqd += sum;
    else if (s.tolov_turi === "karta") kassa.karta += sum;
    else if (s.tolov_turi === "plastik") kassa.plastik += sum;
    // nasiya — kassaga kirmaydi, qarzga ketadi
  });

  // Xizmatlar (kirim)
  xizmatlar.forEach(x => {
    const sum = Number(x.narx) || 0;
    if (x.tolov_turi === "naqd") kassa.naqd += sum;
    else if (x.tolov_turi === "karta") kassa.karta += sum;
    else if (x.tolov_turi === "plastik") kassa.plastik += sum;
    // nasiya xizmat — kassaga kirmaydi
  });

  // Xarajatlar (chiqim — ayiriladi)
  xarajatlar.forEach(x => {
    const sum = Number(x.narx) || 0;
    if (x.tolov_turi === "naqd") kassa.naqd -= sum;
    else if (x.tolov_turi === "karta") kassa.karta -= sum;
    else if (x.tolov_turi === "plastik") kassa.plastik -= sum;
  });

  // Qarz = barcha nasiya sotuvlar - to'lovlar
  const jamiNasiya = nasiyaSotuvlar.reduce((a, s) => a + Number(s.sotuv_narx), 0);
  const jamiTolov  = tolovlar.reduce((a, t) => a + Number(t.summa), 0);
  const jamiQarz   = Math.max(0, jamiNasiya - jamiTolov);

  document.getElementById("kassa-naqd").textContent    = fmtSom(kassa.naqd);
  document.getElementById("kassa-karta").textContent   = fmtSom(kassa.karta);
  document.getElementById("kassa-plastik").textContent = fmtSom(kassa.plastik);
  document.getElementById("kassa-qarz").textContent    = fmtSom(jamiQarz);
}

// ================= KUNLIK KO'RSATKICHLAR =================
function hisoblaKunlik(sotuvlar, xizmatlar, xarajatlar) {
  const tushum = sotuvlar.reduce((a, s) => a + Number(s.sotuv_narx), 0)
               + xizmatlar.reduce((a, x) => a + Number(x.narx), 0);
  const tavarQiymati = sotuvlar.reduce(
    (a, s) => a + Number(s.tavarlar?.tan_narx || 0), 0
  );
  const chiqim = xarajatlar.reduce((a, x) => a + Number(x.narx), 0);
  const foyda = tushum - tavarQiymati - chiqim;
  const soni = sotuvlar.length;

  document.getElementById("kun-tushum").textContent = fmtSom(tushum);
  document.getElementById("kun-tavar").textContent  = fmtSom(tavarQiymati);
  document.getElementById("kun-chiqim").textContent = fmtSom(chiqim);
  document.getElementById("kun-foyda").textContent  = fmtSom(foyda);
  document.getElementById("kun-soni").textContent   = soni + " ta";
}

// ================= SOTILGAN TAVARLAR JADVALI (BUGUN) =================
function jadvalChiz(sotuvlar) {
  const tbody = document.getElementById("sotilgan-tbody");
  if (!sotuvlar.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="bosh">Bugun sotuv yo'q</td></tr>`;
    return;
  }
  tbody.innerHTML = sotuvlar.map(s => {
    const t = s.tavarlar || {};
    const mijoz = s.mijozlar?.ismi
      ? `<span class="mijoz-nasiya">${s.mijozlar.ismi}</span>`
      : "—";
    return `
      <tr>
        <td class="kod">${t.kod || "—"}</td>
        <td>${(t.model || "") + (t.marka ? " / " + t.marka : "") || "—"}</td>
        <td class="markaz">1</td>
        <td class="ong">${fmtSom(t.tan_narx)}</td>
        <td class="ong">${fmtSom(s.sotuv_narx)}</td>
        <td>${mijoz}</td>
      </tr>`;
  }).join("");
}

// ================= ISHGA TUSHIRISH =================
yukla();
// Har 30 sekundda yangilash
setInterval(yukla, 30000);