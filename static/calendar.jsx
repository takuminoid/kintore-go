// calendar.jsx — Monthly calendar screen. Visualises this-month training days + per-day records.
const { useState: useStateC } = React;

const WD = ["日", "月", "火", "水", "木", "金", "土"];

// June 2026: June 1 is a Monday → first cell offset = 1 (0=Sun)
function CalendarScreen({ char = "guts", history = {}, today = 6, streak = 0, monthStartDow = 1, daysInMonth = 30, monthLabel = "2026 / 6", monthNum = 6, monthOffset = 0, onPrevMonth, onNextMonth, onJumpHome, onAddForDay, onDeleteEntry }) {
  const { Mascot, RetroPanel, PixelArt, SPRITES, lineFor, dayParts, monthPartTally } = window;
  const [picked, setPicked] = useStateC(null);

  // monthOffset: 0=今月。過去の月は全日が済んだ日、未来の月は全日が未来。
  const dayState = (d) => {
    if (history[d] && history[d].length) return "done";
    if (monthOffset < 0) return "miss";
    if (monthOffset > 0) return "future";
    if (d < today) return "miss";
    if (d === today) return "today";
    return "future";
  };
  const doneDays = Object.keys(history).filter((d) => history[d] && history[d].length).length;

  const cells = [];
  for (let i = 0; i < monthStartDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pickedEntries = picked != null ? (history[picked] || []) : null;

  // 月ヘッダー + バナー + グリッドだけで背の低いビューポートの高さを超えるため、
  // 収まらないぶんは切り捨てずにスクロールさせる。各ブロックは潰さない。
  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: "var(--paper)", padding: 18, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
      {/* month header */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onPrevMonth} style={navBtn}>‹</button>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 14, color: "var(--ink)" }}>{monthLabel}</div>
        <button onClick={onNextMonth} disabled={monthOffset >= 0}
          style={{ ...navBtn, opacity: monthOffset >= 0 ? 0.35 : 1, cursor: monthOffset >= 0 ? "default" : "pointer" }}>›</button>
      </div>

      {/* this-month banner */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, background: "var(--ink)", border: "3px solid var(--ink)", padding: "10px 14px", boxShadow: "5px 5px 0 0 rgba(0,0,0,.25)" }}>
        <PixelArt grid={window.BADGE_CAL} palette={{ ...SPRITES.PAL, k: "var(--paper)" }} scale={4} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 18, color: "var(--orange-l)", textShadow: "0 0 8px rgba(242,105,30,.6)" }}>{doneDays} 日</div>
          <div style={{ fontSize: 12, color: "var(--paper)", marginTop: 3 }}>{monthOffset === 0 ? "今月" : `${monthNum}月`} トレした日数！</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <PixelArt grid={SPRITES.FLAME} palette={SPRITES.PAL} scale={2} />
            <span style={{ fontFamily: "'DotGothic16'", fontSize: 11, color: "var(--paper)", opacity: 0.75 }}>れんぞく {streak}日</span>
          </div>
        </div>
        <Mascot id={char} expr="happy" scale={3} />
      </div>

      {/* calendar grid */}
      <RetroPanel style={{ padding: 12, flexShrink: 0 }}>
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
                  // グリッド項目の既定 min-width/height:auto はドットぶんまで広がる。
                  // aspectRatio:1 と組み合わさると 7 列が横にはみ出すので明示的に 0 にする。
                  minWidth: 0, minHeight: 0,
                  // button の UA 既定 padding(1px 6px) は内容幅を 40px→28px に削り、
                  // ドットの折り返し位置を狂わせるので消す。
                  padding: 0,
                  cursor: tappable ? "pointer" : "default",
                  border: isToday ? "3px solid var(--red)" : "2px solid var(--ink)",
                  background: isDone ? "var(--orange)" : st === "miss" ? "#EFE0C0" : "var(--paper2)",
                  color: isDone ? "#fff" : st === "miss" ? "#C3AC80" : "var(--ink)",
                  boxShadow: sel ? "0 0 0 3px var(--yellow)" : "none",
                  position: "relative",
                }}>
                <span style={{ fontFamily: "'Press Start 2P'", fontSize: 9 }}>{d}</span>
                {isDone && <PartDots parts={dayParts(history[d])} />}
              </button>
            );
          })}
        </div>
      </RetroPanel>

      {/* summary OR picked day detail */}
      {pickedEntries ? (
        <RetroPanel tone="paper2" style={{ padding: 12, flex: "1 0 auto" }}>
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
        <PartBalance rows={monthPartTally(history)} monthOffset={monthOffset} monthNum={monthNum} />
      )}
    </div>
  );
}

const navBtn = {
  width: 40, height: 40, border: "3px solid var(--ink)", background: "var(--paper2)",
  fontFamily: "'Press Start 2P'", fontSize: 16, color: "var(--ink)", cursor: "pointer", boxShadow: "0 3px 0 0 var(--ink)",
};

// その日に鍛えた部位を色の四角で表す。ドットが出るのは「トレした日」＝オレンジ背景の
// セルだけなので、クリームの縁だけで十分に分離できる。
// 11px + gap 1px で1行に3つ入り、最大6部位（5部位 + その他）でも 3+3 の2行に収まる。
// box-sizing: border-box なので縁の 1px は内側に食い込む（色の部分は 9px）。
// 小さすぎると色を判別できないので、これ以上は縮めないこと。
function PartDots({ parts }) {
  const { PART_COLORS } = window;
  if (!parts || !parts.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1, marginTop: 3, width: 35, maxWidth: "100%" }}>
      {parts.map((p) => (
        <span key={p} title={p} style={{
          width: 11, height: 11, background: PART_COLORS[p], border: "1px solid var(--paper)",
        }} />
      ))}
    </div>
  );
}

// 表示中の月の部位別「やった日数」。色付きの部位名が並ぶので凡例も兼ねる。
function PartBalance({ rows, monthOffset, monthNum }) {
  const { PART_COLORS } = window;
  const max = Math.max(1, ...rows.map((r) => r.days));
  return (
    <window.RetroPanel tone="paper2" style={{ padding: "10px 12px", flex: "1 0 auto" }}>
      <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: "var(--ink)", marginBottom: 8 }}>
        {monthOffset === 0 ? "今月" : `${monthNum}月`} の ぶいバランス
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((r) => (
          <div key={r.part} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 11, height: 11, flexShrink: 0, background: PART_COLORS[r.part], border: "1px solid var(--ink)" }} />
            <span style={{ width: 42, flexShrink: 0, whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{r.part}</span>
            <div style={{ flex: 1, height: 12, background: "var(--paper)", border: "2px solid var(--ink)" }}>
              <div style={{ width: `${(r.days / max) * 100}%`, height: "100%", background: PART_COLORS[r.part] }} />
            </div>
            <span style={{ width: 26, textAlign: "right", fontFamily: "'Press Start 2P'", fontSize: 9, color: r.days ? "var(--ink)" : "#C3AC80" }}>{r.days}</span>
          </div>
        ))}
      </div>
    </window.RetroPanel>
  );
}

window.CalendarScreen = CalendarScreen;
