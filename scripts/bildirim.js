// Koç Takip bildirim göndericisi. GitHub Actions tarafından çalıştırılır.
// MODE: tomorrow (yarının programı) | notes (not hatırlatması) | test
const admin = require("firebase-admin");

const MODE = process.env.MODE || "test";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const KEYS = ["students", "sessions", "plans", "exc"];

function istanbulToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}
function addDays(ds, n) {
  const d = new Date(ds + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// index.html içindeki occ() ile aynı mantık
function occ(S, ds) {
  const wd = (new Date(ds + "T12:00:00Z").getUTCDay() + 6) % 7;
  const r = [];
  S.students.forEach((s) => {
    if (s.active === false) return;
    (s.slots || []).forEach((sl) => {
      if (sl.d != wd || ds < (sl.from || "") || (sl.to && ds > sl.to)) return;
      const ex = S.exc.find((e) => e.studentId == s.id && e.date == ds && e.t == sl.t);
      if (!ex) r.push({ sid: s.id, t: sl.t || "" });
    });
  });
  S.exc.forEach((e) => {
    if (e.to == ds && S.students.some((s) => s.id == e.studentId && s.active !== false)) {
      r.push({ sid: e.studentId, t: e.nt || "" });
    }
  });
  S.plans.forEach((p) => {
    if (p.date == ds) r.push({ sid: p.studentId, t: p.time || "" });
  });
  return r.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
}

async function load() {
  const S = {};
  for (const k of KEYS) {
    const snap = await db.collection(k).get();
    S[k] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  }
  return S;
}

async function send(title, body, tag) {
  const snap = await db.collection("devices").get();
  if (snap.empty) {
    console.log("Kayıtlı cihaz yok, bildirim gönderilmedi.");
    return;
  }
  let ok = 0, bad = 0;
  for (const doc of snap.docs) {
    const token = doc.data().token || doc.id;
    try {
      await admin.messaging().send({
        token,
        data: { title, body, tag },
        webpush: { headers: { Urgency: "high", TTL: "43200" } },
      });
      ok++;
    } catch (e) {
      bad++;
      console.log("Gönderilemedi:", e.code || e.message);
      if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(e.code || "")) {
        await doc.ref.delete();
      }
    }
  }
  console.log(`Gönderildi: ${ok}, başarısız: ${bad}`);
}

(async () => {
  const today = istanbulToday();
  if (MODE === "test") {
    await send("Koç Takip", "Test bildirimi: bildirimler bu cihazda çalışıyor.", "test");
    return;
  }
  const S = await load();
  const name = (id) => {
    const s = S.students.find((x) => x.id == id);
    return s ? s.name : "Öğrenci";
  };
  if (MODE === "tomorrow") {
    const list = occ(S, addDays(today, 1));
    if (!list.length) return console.log("Yarın seans yok, bildirim yok.");
    const lines = list.map((o) => (o.t ? o.t + " " : "") + name(o.sid));
    await send(
      list.length === 1 ? "Yarın 1 seansın var" : `Yarın ${list.length} seansın var`,
      lines.join("\n") + "\nYarının planını gözden geçirmek ister misin?",
      "yarin"
    );
  } else if (MODE === "notes") {
    const pending = occ(S, today).filter(
      (o) => !S.sessions.some((x) => x.studentId == o.sid && x.date == today)
    );
    if (!pending.length) return console.log("Bugün notu eksik seans yok, bildirim yok.");
    const names = [...new Set(pending.map((o) => name(o.sid)))];
    await send("Seans notlarını eklemek ister misin?", names.join(", "), "notlar");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
