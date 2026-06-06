// app.jsx — APIと接続する全体アプリ
const { useState: useStateApp, useEffect } = React;

function NavTab({ active, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer",
      padding: "9px 0 7px", border: "none",
      borderTop: active ? "4px solid var(--orange)" : "4px solid transparent",
      background: active ? "var(--paper)" : "transparent",
    }}>
      <div style={{ filter: active ? "none" : "grayscale(.6)", opacity: active ? 1 : 0.55 }}>{children}</div>
      <span style={{ fontFamily: "'DotGothic16'", fontSize: 11, fontWeight: 700, color: active ? "var(--orange-d)" : "#9C8B6E" }}>{label}</span>
    </button>
  );
}

function App() {
  const { CharacterSelect, HomeInput, CalendarScreen, BadgesScreen, Mascot, PixelArt, SPRITES, getMascot } = window;

  const [phase, setPhase] = useStateApp("loading"); // loading | intro | app
  const [draftChar, setDraftChar] = useStateApp("guts");
  const [char, setChar] = useStateApp("guts");
  const [screen, setScreen] = useStateApp("home");
  const [status, setStatus] = useStateApp(null);

  // 日付情報（クライアント側で計算）
  const now = new Date();
  const todayDay = now.getDate();
  const dateLabel = `${now.getMonth() + 1}/${todayDay}`;
  const weekdays = ["にちようび", "げつようび", "かようび", "すいようび", "もくようび", "きんようび", "どようび"];
  const weekday = weekdays[now.getDay()];
  const monthNum = now.getMonth() + 1;
  const monthStartDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthLabel = `${now.getFullYear()} / ${monthNum}`;

  const fetchStatus = () =>
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        setStatus(s);
        setChar(s.character);
        setDraftChar(s.character);
        return s;
      });

  useEffect(() => {
    fetchStatus()
      .then((s) => setPhase(s.onboarded ? "app" : "intro"))
      .catch(() => setPhase("intro"));
  }, []);

  const record = (entry) =>
    fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setStatus)
      .catch((err) => console.error("record failed:", err));

  const del = (id) =>
    fetch(`/api/entries/${id}`, { method: "DELETE" })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setStatus)
      .catch((err) => console.error("delete failed:", err));

  const start = (id) => {
    fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: id }),
    })
      .catch(() => {})
      .finally(() => {
        setChar(id);
        setPhase("app");
        setScreen("home");
      });
  };

  if (phase === "loading") {
    return (
      <div style={{ ...appShell, alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--orange)" }}>LOADING...</div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div style={appShell}>
        <CharacterSelect value={draftChar} onChange={setDraftChar} onStart={start} />
      </div>
    );
  }

  if (!status) return null;

  const m = getMascot(char);
  const streak = status.streak;
  const coins = status.coins;
  const todayEntries = status.today_entries || [];

  // APIの {"2026-06-01": [...]} をカレンダーの {1: [...], 2: [...]} に変換
  const history = {};
  if (status.month) {
    Object.entries(status.month).forEach(([dateStr, entries]) => {
      const day = parseInt(dateStr.slice(8), 10);
      history[day] = entries;
    });
  }
  if (todayEntries.length > 0) {
    history[todayDay] = todayEntries;
  }

  return (
    <div style={appShell}>
      {/* トップバー */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--ink)", borderBottom: "3px solid var(--ink)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ border: "2px solid " + m.body, padding: 2, background: "#0e0805" }}>
            <Mascot id={char} expr="idle" scale={3} />
          </div>
          <div>
            <div style={{ fontFamily: "'DotGothic16'", fontSize: 13, fontWeight: 700, color: "var(--paper)" }}>{m.name}</div>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: m.body }}>LV.{Math.floor(status.total_sets / 5) + 1}</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <PixelArt grid={SPRITES.FLAME} palette={SPRITES.PAL} scale={3} />
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--orange-l)" }}>{streak}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <PixelArt grid={SPRITES.COIN} palette={SPRITES.PAL} scale={3} />
          <span style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--yellow)" }}>{coins}</span>
        </div>
        <button
          onClick={() => { setDraftChar(char); setPhase("intro"); }}
          title="あいぼうチェンジ"
          style={{ marginLeft: 4, border: "2px solid " + m.body, background: "#0e0805", color: m.body, cursor: "pointer", fontFamily: "'DotGothic16'", fontSize: 12, fontWeight: 700, padding: "5px 8px" }}
        >きせかえ</button>
      </div>

      {/* 画面本体 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {screen === "log" && (
          <HomeInput
            char={char} entries={todayEntries}
            onRecord={record} onDelete={del}
            streak={streak} coins={coins}
            dateLabel={dateLabel} weekday={weekday}
          />
        )}
        {screen === "home" && (
          <CalendarScreen
            char={char} history={history} today={todayDay}
            streak={streak} coins={coins}
            monthStartDow={monthStartDow} daysInMonth={daysInMonth}
            monthLabel={monthLabel} monthNum={monthNum}
          />
        )}
        {screen === "badges" && (
          <BadgesScreen
            char={char}
            stats={{ totalSets: status.total_sets, streak, doneDays: status.done_days, coins }}
          />
        )}
      </div>

      {/* ボトムナビ */}
      <div style={{ display: "flex", background: "var(--paper2)", borderTop: "3px solid var(--ink)" }}>
        <NavTab active={screen === "home"} label="ホーム" onClick={() => setScreen("home")}>
          <PixelArt grid={window.BADGE_CAL} palette={SPRITES.PAL} scale={3} />
        </NavTab>
        <NavTab active={screen === "log"} label="きろく" onClick={() => setScreen("log")}>
          <PixelArt grid={SPRITES.DUMBBELL} palette={SPRITES.PAL} scale={3} />
        </NavTab>
        <NavTab active={screen === "badges"} label="バッジ" onClick={() => setScreen("badges")}>
          <PixelArt grid={SPRITES.STAR} palette={SPRITES.PAL} scale={3} />
        </NavTab>
      </div>
    </div>
  );
}

const appShell = {
  width: "100%", height: "100%", display: "flex", flexDirection: "column",
  background: "var(--paper)", overflow: "hidden",
};

window.BADGE_CAL = `
kkkkkkkk
k.k..k.k
kkkkkkkk
koooooook
kowoowook
koooooook
kowooooook
kkkkkkkk`;

window.KintoreApp = App;
