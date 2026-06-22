// calendar.jsx — Monthly calendar screen. Visualises this-month training days + per-day records.
const { useState: useStateC } = React;

const WD = ["日", "月", "火", "水", "木", "金", "土"];

// June 2026: June 1 is a Monday → first cell offset = 1 (0=Sun)
function CalendarScreen({ char = "guts", history = {}, today = 6, streak = 0, coins = 0, monthStartDow = 1, daysInMonth = 30, monthLabel = "2026 / 6", monthNum = 6, onJumpHome, onAddForDay, onDeleteEntry }) {
  const { Mascot, RetroPanel, PixelArt, SPRITES, lineFor } = window;
  const [picked, setPicked] = useStateC(null);

  const dayState = (d) => {
    if (history[d] && history[d].length) return "done";
    if (d < today) return "miss";
    if (d === today) return "today";
    return "future";
  };
  const doneDays = Object.keys(history).filter((d) => history[d] && history[d].length).length;
  const totalSets = Object.values(history).reduce((a, e) => a + (e ? e.length : 0), 0);

  const cells = [];
  for (let i = 0; i < monthStartDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pickedEntries = picked != null ? (history[picked] || []) : null;

  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: "var(--paper)", padding: 18, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      {/* month header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button style={navBtn}>‹</button>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 14, color: "var(--ink)" }}>{monthLabel}</div>
        <button style={navBtn}>›</button>
      </div>

      {/* this-month banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--ink)", border: "3px solid var(--ink)", padding: "10px 14px", boxShadow: "5px 5px 0 0 rgba(0,0,0,.25)" }}>
        <PixelArt grid={window.BADGE_CAL} palette={{ ...SPRITES.PAL, k: "var(--paper)" }} scale={4} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 18, color: "var(--orange-l)", textShadow: "0 0 8px rgba(242,105,30,.6)" }}>{doneDays} 日</div>
          <div style={{ fontSize: 12, color: "var(--paper)", marginTop: 3 }}>今月 トレした日数！</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <PixelArt grid={SPRITES.FLAME} palette={SPRITES.PAL} scale={2} />
            <span style={{ fontFamily: "'DotGothic16'", fontSize: 11, color: "var(--paper)", opacity: 0.75 }}>れんぞく {streak}日</span>
          </div>
        </div>
        <Mascot id={char} expr="happy" scale={3} />
      </div>

      {/* calendar grid */}
      <RetroPanel style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 6 }}>
          {WD.map((w, i) => (
            <div key={w} style={{ textAlign: "center", fontFamily: "'DotGothic16'", fontSize: 12, fontWeight: 700, color: i === 0 ? "var(--red)" : i === 6 ? "#3F77A3" : "var(--ink)" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
          {cells.map((d, i) => {
            if (d == null) return <div key={"e" + i} />;
            const st = dayState(d);
            const isDone = st === "done";
            const isToday = st === "today";
            const sel = picked === d;
            const tappable = st !== "future";
            return (
              <button key={d} onClick={() => setPicked(tappable ? d : null)}
                style={{
                  aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: tappable ? "pointer" : "default",
                  border: isToday ? "3px solid var(--red)" : "2px solid var(--ink)",
                  background: isDone ? "var(--orange)" : st === "miss" ? "#EFE0C0" : "var(--paper2)",
                  color: isDone ? "#fff" : st === "miss" ? "#C3AC80" : "var(--ink)",
                  boxShadow: sel ? "0 0 0 3px var(--yellow)" : "none",
                  position: "relative",
                }}>
                <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9 }}>{d}</span>
                {isDone && <span style={{ fontSize: 11, lineHeight: 1 }}>★</span>}
              </button>
            );
          })}
        </div>
      </RetroPanel>

      {/* summary OR picked day detail */}
      {pickedEntries ? (
        <RetroPanel tone="paper2" style={{ padding: 12, flex: 1, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--ink)" }}>{monthNum}/{picked} のきろく</div>
            <button onClick={() => setPicked(null)} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "'DotGothic16'", fontSize: 13, color: "var(--orange-d)" }}>とじる ×</button>
          </div>
          {pickedEntries.length === 0 ? (
            <div style={{ fontSize: 13, color: "#B59A6A", marginBottom: 10 }}>この日は まだ きろくがないよ。</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {pickedEntries.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--paper)", border: "2px solid var(--ink)", padding: "7px 10px" }}>
                  <PixelArt grid={SPRITES.DUMBBELL} palette={SPRITES.PAL} scale={2} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{e.part ? e.part.split(",").join("・") : ""}</span>
                  <span style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--orange-d)" }}>{e.minutes}分</span>
                  <button onClick={() => onDeleteEntry && onDeleteEntry(e.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#B59A6A", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onAddForDay && onAddForDay(picked)} style={{
            width: "100%", border: "3px solid var(--ink)", background: "var(--orange)", color: "#fff",
            fontFamily: "'DotGothic16'", fontSize: 14, fontWeight: 700, padding: "10px 0", cursor: "pointer", boxShadow: "3px 3px 0 0 var(--ink)",
          }}>＋ この日に きろく</button>
        </RetroPanel>
      ) : (
        <div style={{ display: "flex", gap: 12, flex: 1 }}>
          <SummaryCard label="トレした日" value={doneDays} unit="日" />
          <SummaryCard label="きろく数" value={totalSets} unit="こ" />
          <SummaryCard label="コイン" value={coins} unit="" />
        </div>
      )}
    </div>
  );
}

const navBtn = {
  width: 40, height: 40, border: "3px solid var(--ink)", background: "var(--paper2)",
  fontFamily: "'Press Start 2P'", fontSize: 16, color: "var(--ink)", cursor: "pointer", boxShadow: "0 3px 0 0 var(--ink)",
};

function SummaryCard({ label, value, unit }) {
  return (
    <div style={{ flex: 1, border: "3px solid var(--ink)", background: "var(--paper2)", boxShadow: "4px 4px 0 0 var(--ink)", padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <div style={{ fontFamily: "'Press Start 2P'", fontSize: 18, color: "var(--orange-d)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink)", textAlign: "center" }}>{label}{unit && <span style={{ opacity: 0.6 }}>（{unit}）</span>}</div>
    </div>
  );
}

window.CalendarScreen = CalendarScreen;
