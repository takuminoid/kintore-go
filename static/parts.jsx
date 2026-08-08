// parts.jsx — 部位の定義・色・集計。カレンダーと記録画面で共有する。
const PARTS = ["胸", "背中", "腕", "脚", "腹"];
const OTHER_PART = "その他";

// オレンジ系と黄色は使わない。「トレした日」のセル背景が var(--orange) なので、
// その上に置くドットと紛らわしくなる。
const PART_COLORS = {
  胸: "#E23B2E",
  背中: "#3F77A3",
  腕: "#8E5BC4",
  脚: "#3FA34D",
  腹: "#D94F8A",
  [OTHER_PART]: "#A08A66",
};

// entries(1日分) → 表示順に並んだ部位名。重複は除き、空や旧自由入力(「腹筋」等)は
// まとめて その他 に集約する。
function dayParts(entries) {
  const found = new Set();
  let other = false;
  (entries || []).forEach((e) => {
    const names = (e.part || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) { other = true; return; }
    names.forEach((n) => (PARTS.includes(n) ? found.add(n) : (other = true)));
  });
  const out = PARTS.filter((p) => found.has(p));
  if (other) out.push(OTHER_PART);
  return out;
}

// history({日: entries[]}) → [{part, days}]。days はその部位をやった日数。
// 5部位は0でも常に返す（0に気づけることが目的）。その他は0なら省く。
function monthPartTally(history) {
  const days = {};
  PARTS.forEach((p) => (days[p] = 0));
  days[OTHER_PART] = 0;
  Object.values(history || {}).forEach((entries) => {
    if (!entries || !entries.length) return;
    dayParts(entries).forEach((p) => (days[p] += 1));
  });
  const rows = PARTS.map((p) => ({ part: p, days: days[p] }));
  if (days[OTHER_PART] > 0) rows.push({ part: OTHER_PART, days: days[OTHER_PART] });
  return rows;
}

window.PARTS = PARTS;
window.OTHER_PART = OTHER_PART;
window.PART_COLORS = PART_COLORS;
window.dayParts = dayParts;
window.monthPartTally = monthPartTally;
