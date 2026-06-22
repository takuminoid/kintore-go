// homeInput.jsx — Self-logging home. User decides & inputs their own training.
const { useState: useStateI } = React;

const PARTS = ["胸", "背中", "肩", "腕", "脚", "腹", "全身", "有酸素"];

function Stepper({ value, onChange, unit }) {
  const step = unit === "km" ? 0.5 : unit === "kg" ? 2.5 : unit === "分" || unit === "秒" ? 5 : 1;
  const btn = (label, d) => (
    <button onClick={() => onChange(Math.max(0, +(value + d).toFixed(1)))} style={{
      width: 46, height: 46, border: "3px solid var(--ink)", background: "var(--paper)",
      fontFamily: "'Press Start 2P'", fontSize: 16, cursor: "pointer", boxShadow: "0 3px 0 0 var(--ink)", color: "var(--orange-d)",
    }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
      {btn("−", -step)}
      <div style={{ minWidth: 96, textAlign: "center", border: "3px solid var(--ink)", background: "#fff", padding: "8px 6px" }}>
        <span style={{ fontFamily: "'Press Start 2P'", fontSize: 22, color: "var(--ink)" }}>{value}</span>
        <span style={{ fontFamily: "'DotGothic16'", fontSize: 14, color: "var(--orange-d)", marginLeft: 4 }}>{unit}</span>
      </div>
      {btn("＋", step)}
    </div>
  );
}

function HomeInput({ char = "guts", entries = [], onRecord, onDelete, streak = 0, doneDays = 0, coins = 0, selectedDate, isoToday, onChangeDate, monthStartIso }) {
  const { Mascot, RetroPanel, RetroButton, StatChip, PixelArt, SPRITES, Sparkles, lineFor } = window;
  const WD_J = ["にち", "げつ", "か", "すい", "もく", "きん", "ど"];
  const shiftIso = (iso, days) => {
    const [y, mo, d] = iso.split("-").map(Number);
    const dt = new Date(y, mo - 1, d + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  const sel = selectedDate || isoToday;
  const [sy, sm, sd] = sel.split("-").map(Number);
  const selWeekday = WD_J[new Date(sy, sm - 1, sd).getDay()];
  const isToday = sel === isoToday;
  const canPrev = sel > monthStartIso;
  const canNext = sel < isoToday;
  const labelMD = `${sm}/${sd}`;
  const [sheet, setSheet] = useStateI(false);
  const [cheer, setCheer] = useStateI(false);

  // sheet form state
  const [parts, setParts] = useStateI([]);
  const [minutes, setMinutes] = useStateI(0);

  const openSheet = () => {
    setParts([]); setMinutes(0); setSheet(true);
  };
  const togglePart = (p) =>
    setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const record = () => {
    if (minutes <= 0) return;
    const first = entries.length === 0;
    onRecord && onRecord({ part: parts.join(","), minutes });
    if (first) { setCheer(true); setTimeout(() => setCheer(false), 1100); }
    setSheet(false);
  };
  const del = (id) => onDelete && onDelete(id);

  const log = entries;
  const done = log.length > 0;
  const bubble = done ? lineFor(char, "praise") : lineFor(char, "greet");

  return (
    <div style={{ position: "relative", height: "100%", boxSizing: "border-box", background: "var(--paper)", padding: 18, display: "flex", flexDirection: "column", gap: 13, overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => canPrev && onChangeDate(shiftIso(sel, -1))} disabled={!canPrev}
            style={{ width: 30, height: 30, border: "2px solid var(--ink)", background: "var(--paper2)", fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--ink)", cursor: canPrev ? "pointer" : "default", opacity: canPrev ? 1 : 0.3 }}>‹</button>
          <div style={{ textAlign: "center", minWidth: 56 }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 13, color: "var(--ink)" }}>{labelMD}</div>
            <div style={{ fontSize: 12, color: "var(--orange-d)" }}>{isToday ? "きょう" : selWeekday + "ようび"}</div>
          </div>
          <button onClick={() => canNext && onChangeDate(shiftIso(sel, 1))} disabled={!canNext}
            style={{ width: 30, height: 30, border: "2px solid var(--ink)", background: "var(--paper2)", fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--ink)", cursor: canNext ? "pointer" : "default", opacity: canNext ? 1 : 0.3 }}>›</button>
        </div>
        <div style={{ flex: 1 }} />
        <StatChip tone="paper2" icon={<PixelArt grid={window.BADGE_CAL} palette={SPRITES.PAL} scale={3} />} value={doneDays} label="今月" />
        <StatChip tone="paper2" icon={<PixelArt grid={SPRITES.FLAME} palette={SPRITES.PAL} scale={3} />} value={streak} label="れんぞく" />
        <StatChip tone="paper2" icon={<PixelArt grid={SPRITES.COIN} palette={SPRITES.PAL} scale={3} />} value={coins} />
      </div>

      {/* mascot + bubble */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Mascot id={char} expr={cheer || done ? "happy" : "idle"} scale={5} />
          <Sparkles show={cheer} />
        </div>
        <RetroPanel flush style={{ position: "relative", padding: "10px 12px", marginBottom: 6, flex: 1 }}>
          <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 700, lineHeight: 1.4 }}>{bubble}</div>
          <div style={{ position: "absolute", left: -9, bottom: 12, width: 12, height: 12, background: "var(--paper)", borderLeft: "3px solid var(--ink)", borderBottom: "3px solid var(--ink)", transform: "rotate(45deg)" }} />
        </RetroPanel>
      </div>

      {/* log card */}
      <RetroPanel style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 11, color: "var(--ink)" }}>{isToday ? "きょうのきろく" : labelMD + "のきろく"}</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--orange-d)" }}>{log.length} きろく</div>
        </div>

        {log.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: "3px dashed #D9BE8A", color: "#B59A6A", padding: 20 }}>
            <PixelArt grid={SPRITES.DUMBBELL} palette={SPRITES.PAL} scale={4} style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 14, textAlign: "center" }}>まだ記録がないよ。<br />{isToday ? "きょう" : labelMD} の トレを きろくしよう！</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {log.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "var(--paper2)", border: "3px solid var(--ink)", boxShadow: "3px 3px 0 0 var(--ink)" }}>
                <div style={{ width: 22, height: 22, flexShrink: 0, background: "var(--green)", border: "2px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Press Start 2P'", fontSize: 10, color: "#fff" }}>✓</div>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{e.part ? e.part.split(",").join("・") : ""}</div>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 11, color: "var(--orange-d)" }}>{e.minutes}分</div>
                <button onClick={() => del(e.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#B59A6A", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </RetroPanel>

      {/* add button */}
      <RetroButton tone="orange" size="lg" full onClick={openSheet}>＋ きろくする</RetroButton>

      {/* ADD SHEET */}
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(36,23,18,.5)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--paper)", borderTop: "4px solid var(--ink)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--ink)", textAlign: "center" }}>{labelMD} は どれくらい うごいた？</div>

            {/* time stepper (主役) */}
            <Stepper value={minutes} onChange={setMinutes} unit="分" />

            {/* 部位 chips (任意・複数選択) */}
            <div style={{ fontFamily: "'DotGothic16'", fontSize: 12, color: "var(--orange-d)", textAlign: "center" }}>ぶい（えらばなくてもOK）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
              {PARTS.map((p) => {
                const on = parts.includes(p);
                return (
                  <button key={p} onClick={() => togglePart(p)} style={{
                    fontFamily: "'DotGothic16'", fontSize: 13, fontWeight: 700, padding: "7px 11px", cursor: "pointer",
                    border: "3px solid var(--ink)", background: on ? "var(--orange)" : "var(--paper2)", color: on ? "#fff" : "var(--ink)",
                    boxShadow: on ? "none" : "2px 2px 0 0 var(--ink)",
                  }}>{p}</button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <RetroButton tone="paper" size="md" onClick={() => setSheet(false)} style={{ flex: 1 }}>やめる</RetroButton>
              <RetroButton tone="green" size="md" onClick={record} disabled={minutes <= 0} style={{ flex: 2, opacity: minutes <= 0 ? 0.5 : 1 }}>これを きろく！</RetroButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.HomeInput = HomeInput;
