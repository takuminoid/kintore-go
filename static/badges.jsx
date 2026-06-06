// badges.jsx — Achievements screen. Unlock state derived from live stats.
const { useState: useStateB2 } = React;

// Extra pixel icons (palette = SPRITES.PAL).
const ICON = {
  trophy: `
.kkkkkkk.
.kyyyyyk.
kkyyyyykk
ooyyyyyoo
.okyyyko.
..kyyyk..
...kyk...
..kkkkk..
.kyyyyyk.`,
  medal: `
.k.....k.
.rk...kr.
.rrk.krr.
..rkrkr..
..kyyyk..
.kyylyyk.
.kyyoyyk.
.kyylyyk.
..kyyyk..`,
  cal: `
kkkkkkkk
k.k..k.k
kkkkkkkk
koooooook
kooworook
kowwwrook
koooooook
kkkkkkkk`,
  fire30: `
...y....
..yry...
.yroyk..
.yrook..
yroorok.
yroorok.
.yoork..
..kkk...`,
  hundred: `
.k.kkk.kkk
kyk.k.k.ky
.k.kkk.kkk
.k.k.k.k.k
.k.kkk.kkk`,
  crown: `
k.k.k.k
kykykyk
kyyyyyk
kyyoyyk
kkkkkkk`,
};

function BadgesScreen({ char = "guts", stats = {}, onBack }) {
  const { Mascot, RetroPanel, PixelArt, SPRITES, lineFor } = window;
  const { totalSets = 0, streak = 0, doneDays = 0, coins = 0 } = stats;
  const [detail, setDetail] = useStateB2(null);

  const P = SPRITES.PAL;
  const badges = [
    { id: "first", name: "はじめの一歩", desc: "はじめて きろくした", grid: SPRITES.STAR, cur: Math.min(totalSets, 1), goal: 1 },
    { id: "three", name: "三日ぼうず卒業", desc: "3日 れんぞく", grid: SPRITES.FLAME, cur: Math.min(streak, 3), goal: 3 },
    { id: "week", name: "いっしゅう戦士", desc: "7日 れんぞく", grid: ICON.medal, cur: Math.min(streak, 7), goal: 7 },
    { id: "two_week", name: "2週間つづいた", desc: "14日 れんぞく", grid: ICON.trophy, cur: Math.min(streak, 14), goal: 14 },
    { id: "month", name: "1ヶ月の壁", desc: "30日 れんぞく", grid: ICON.fire30, cur: Math.min(streak, 30), goal: 30 },
    { id: "sets10", name: "コツコツ10", desc: "そう種目 10こ", grid: SPRITES.DUMBBELL, cur: Math.min(totalSets, 10), goal: 10 },
    { id: "sets50", name: "やりこみ50", desc: "そう種目 50こ", grid: ICON.hundred, cur: Math.min(totalSets, 50), goal: 50 },
    { id: "cal20", name: "カレンダー職人", desc: "今月 20日 トレ", grid: ICON.cal, cur: Math.min(doneDays, 20), goal: 20 },
    { id: "coin", name: "コインもち", desc: "コイン 500まい", grid: SPRITES.COIN, cur: Math.min(coins, 500), goal: 500 },
  ].map((b) => ({ ...b, unlocked: b.cur >= b.goal }));

  const got = badges.filter((b) => b.unlocked).length;

  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: "var(--paper)", padding: 18, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", position: "relative" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mascot id={char} expr="happy" scale={4} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 13, color: "var(--ink)" }}>じっせき</div>
          <div style={{ fontSize: 13, color: "var(--orange-d)", marginTop: 4 }}>{lineFor(char, "badge")}</div>
        </div>
        <div style={{ textAlign: "center", border: "3px solid var(--ink)", background: "var(--yellow)", padding: "6px 10px", boxShadow: "3px 3px 0 0 var(--ink)" }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 14, color: "var(--ink)" }}>{got}/{badges.length}</div>
        </div>
      </div>

      {/* badge grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, overflow: "auto", alignContent: "start", flex: 1, paddingBottom: 4 }}>
        {badges.map((b) => (
          <button key={b.id} onClick={() => setDetail(b)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer",
            padding: "14px 6px 10px", border: "3px solid var(--ink)",
            background: b.unlocked ? "var(--paper2)" : "#EDE2CC",
            boxShadow: b.unlocked ? "4px 4px 0 0 var(--ink)" : "none",
            position: "relative",
          }}>
            <div style={{ filter: b.unlocked ? "none" : "grayscale(1)", opacity: b.unlocked ? 1 : 0.4 }}>
              <PixelArt grid={b.grid} palette={P} scale={4} />
            </div>
            <div style={{ fontFamily: "'DotGothic16'", fontSize: 12, fontWeight: 700, color: b.unlocked ? "var(--ink)" : "#A7916A", textAlign: "center", lineHeight: 1.2 }}>{b.name}</div>
            {!b.unlocked && (
              <div style={{ width: "80%", height: 8, border: "2px solid var(--ink)", background: "#fff", padding: 1 }}>
                <div style={{ width: `${(b.cur / b.goal) * 100}%`, height: "100%", background: "var(--orange)" }} />
              </div>
            )}
            {b.unlocked && <div style={{ position: "absolute", top: 4, right: 4, fontFamily: "'Press Start 2P'", fontSize: 8, color: "var(--green)" }}>✓</div>}
          </button>
        ))}
      </div>

      {/* detail popup */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(36,23,18,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--paper)", border: "4px solid var(--ink)", boxShadow: "6px 6px 0 0 rgba(0,0,0,.3)", padding: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 280 }}>
            <div style={{ filter: detail.unlocked ? "none" : "grayscale(1)", opacity: detail.unlocked ? 1 : 0.45 }}>
              <PixelArt grid={detail.grid} palette={P} scale={7} />
            </div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--ink)", textAlign: "center" }}>{detail.name}</div>
            <div style={{ fontSize: 14, color: "var(--ink)", textAlign: "center" }}>{detail.desc}</div>
            {detail.unlocked ? (
              <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--green)", border: "2px solid var(--green)", padding: "5px 10px" }}>UNLOCKED!</div>
            ) : (
              <div style={{ width: "100%" }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: "var(--orange-d)", textAlign: "center", marginBottom: 6 }}>{detail.cur} / {detail.goal}</div>
                <div style={{ height: 12, border: "2px solid var(--ink)", background: "#fff", padding: 1 }}>
                  <div style={{ width: `${(detail.cur / detail.goal) * 100}%`, height: "100%", background: "var(--orange)" }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

window.BadgesScreen = BadgesScreen;
