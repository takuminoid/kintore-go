// mascots.jsx — 6 cute pixel mascots with idle + happy expressions.
// Exports to window: MASCOTS, Mascot, CharacterSelect
const { useState: useStateM } = React;

// Shared sprite palette. 'o' (body) is overridden per-mascot.
const MPAL = {
  k: "#241712", w: "#FFF6E6", b: "#241712", p: "#FF9E8A",
  m: "#7A3414", r: "#E23B2E", y: "#F8C13A", g: "#7BC043",
  e: "#3E8E3A", s: "#7CC3F2", c: "#FFFFFF",
};

// Chubby round face — 14 wide x 14 tall (near-square = rounder/cuter).
const FACE_IDLE = [
  "..kkkkkkkkkk..",
  ".kooooooooook.",
  "koooooooooook",
  "koooooooooook",
  "kowwwoooowwwok",
  "kowbwoooowbwok",
  "kowwwoooowwwok",
  "koooooooooook",
  "koooooooooook",
  "kopoooooooopok",
  "kooommmmmmoook",
  "koooooooooook",
  ".kooooooooook.",
  "..kkkkkkkkkk..",
];
// Happy: closed ^^ eyes, open smile + tongue.
const FACE_HAPPY = [
  "..kkkkkkkkkk..",
  ".kooooooooook.",
  "koooooooooook",
  "koooooooooook",
  "koooooooooook",
  "kokkkooookkkok",
  "koooooooooook",
  "koooooooooook",
  "koooooooooook",
  "kopoooooooopok",
  "kooommrrmmoook",
  "koooooooooook",
  ".kooooooooook.",
  "..kkkkkkkkkk..",
];

const T = {
  none: [],
  flame: ["......r.......", ".....ryr......"],
  sprout: ["......e.......", ".....geg......"],
  crown: ["....y.y.y.....", "....yyyyy....."],
  star: ["......y.......", ".....yyy......"],
  water: ["......s.......", ".....s.s......"],
  ears: [".kk......kk...", ".koo....ook..."],
};
const BAND = "krrrrrrrrrrrrk"; // red headband recolors row 2

function build(face, topper, band) {
  const rows = face.slice();
  if (band) rows[2] = band;
  return [...topper, ...rows].join("\n");
}

const MASCOTS = [
  { id: "guts",   name: "ガッツ",   tag: "ねっけつ",   body: "#F2691E", top: T.none,   band: BAND },
  { id: "homura", name: "ホムラ",   tag: "もえあがる", body: "#EA5440", top: T.flame,  band: null },
  { id: "wakaba", name: "わかば",   tag: "すこやか",   body: "#5FB85A", top: T.sprout, band: null },
  { id: "ouji",   name: "おうじ",   tag: "がんばりや", body: "#F0C13A", top: T.crown,  band: null },
  { id: "nyatore",name: "ニャトレ", tag: "きまぐれ",   body: "#F2872E", top: T.ears,   band: null },
  { id: "aqua",   name: "アクア",   tag: "クール",     body: "#5BA9E8", top: T.water,  band: null },
].map((m) => ({
  ...m,
  idle: build(FACE_IDLE, m.top, m.band),
  happy: build(FACE_HAPPY, m.top, m.band),
  pal: { ...MPAL, o: m.body },
}));

function Mascot({ id, expr = "idle", scale = 6, style }) {
  const m = MASCOTS.find((x) => x.id === id) || MASCOTS[0];
  return <window.PixelArt grid={expr === "happy" ? m.happy : m.idle} palette={m.pal} scale={scale} style={style} aria-label={m.name} />;
}

function getMascot(id) { return MASCOTS.find((x) => x.id === id) || MASCOTS[0]; }

// Personality-flavoured dialogue. Keys: greet (no log yet), praise (just logged),
// streak (calendar), badge (achievements screen).
const LINES = {
  guts:    { greet: "きょうも アツくいくぞ！なにを やった？", praise: "ナイスファイト！その調子だ！！", streak: "れんぞく記録、ぜったい とぎらせるな！", badge: "勲章は おまえの 努力のあかしだ！" },
  homura:  { greet: "燃えてきたか？やったこと 教えてくれ。", praise: "いいぞ、その炎 消すんじゃないぞ！", streak: "炎のように 毎日もえあがれ！", badge: "この輝き…見事に もえあがったな。" },
  wakaba:  { greet: "むりせず いこうね。きょうは なにした？", praise: "えらいね！すこしずつ 育ってるよ。", streak: "まいにち コツコツ、それが 一番だよ。", badge: "ここまで 育ったんだね、すごい！" },
  ouji:    { greet: "さて、本日の鍛錬を 申してみよ。", praise: "見事である！王たる 風格が出てきたな。", streak: "継続は 王の資質ぞ。ほこるがよい。", badge: "そなたの 栄誉、しかと見届けた。" },
  nyatore: { greet: "にゃ〜、きょうは なにした にゃ？", praise: "やったにゃ！ごほうび ちょうだいにゃ！", streak: "まいにち つづけてて えらいにゃ〜", badge: "ぴかぴかにゃ！あつめると たのしいにゃ。" },
  aqua:    { greet: "落ち着いていこう。今日の記録は？", praise: "悪くない。流れに のれてきたね。", streak: "水のように 途切れず 続けよう。", badge: "静かに 積み上げた証だ。上出来。" },
};
function lineFor(id, key) { return (LINES[id] || LINES.guts)[key]; }

/* CHARACTER SELECT — arcade-style picker screen.
   Controlled if `value`/`onChange` given. `onStart` adds a confirm button. */
function CharacterSelect({ value, onChange, onStart }) {
  const [internal, setInternal] = useStateM("guts");
  const sel = value != null ? value : internal;
  const setSel = (id) => { if (onChange) onChange(id); else setInternal(id); };
  const [hover, setHover] = useStateM(null);
  const cur = MASCOTS.find((x) => x.id === sel);
  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: "#1a0f0a", padding: 20, display: "flex", flexDirection: "column", gap: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px)" }} />
      <div style={{ textAlign: "center", position: "relative" }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 16, color: "var(--yellow)", textShadow: "0 0 10px rgba(248,193,58,.5)" }}>CHARACTER</div>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 11, color: "var(--orange-l)", marginTop: 8 }}>あいぼうを えらぼう</div>
      </div>

      <div style={{ display: "flex", gap: 18, position: "relative", flex: 1 }}>
        {/* grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, flex: 1 }}>
          {MASCOTS.map((m) => {
            const on = sel === m.id;
            return (
              <button key={m.id} onClick={() => setSel(m.id)} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer",
                  padding: "12px 6px 10px", background: on ? "#3a2410" : "#0e0805",
                  border: on ? "3px solid var(--yellow)" : "3px solid #3d2e22",
                  boxShadow: on ? "0 0 0 2px #1a0f0a, 0 0 14px rgba(248,193,58,.4)" : "none",
                }}>
                <Mascot id={m.id} expr={on || hover === m.id ? "happy" : "idle"} scale={4} />
                <div style={{ fontFamily: "'DotGothic16'", fontSize: 14, color: on ? "var(--yellow)" : "var(--paper)", fontWeight: 700 }}>{m.name}</div>
                {on && <div style={{ fontFamily: "'Press Start 2P'", fontSize: 6, color: "var(--orange-l)" }}>{"▶ SELECT"}</div>}
              </button>
            );
          })}
        </div>

        {/* preview */}
        <div style={{ width: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, border: "3px solid var(--orange)", background: "#0e0805", padding: 14 }}>
          <Mascot id={sel} expr="happy" scale={7} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 13, color: "var(--yellow)" }}>{cur.name}</div>
            <div style={{ fontFamily: "'DotGothic16'", fontSize: 13, color: "var(--orange-l)", marginTop: 6 }}>タイプ：{cur.tag}</div>
          </div>
          <div style={{ fontFamily: "'DotGothic16'", fontSize: 12, color: "var(--paper)", textAlign: "center", lineHeight: 1.5, opacity: 0.85 }}>
            「{lineFor(sel, "greet")}」
          </div>
        </div>
      </div>

      {onStart && (
        <div style={{ position: "relative" }}>
          <window.RetroButton tone="yellow" size="lg" full onClick={() => onStart(sel)}>▶ このあいぼうで はじめる</window.RetroButton>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { MASCOTS, Mascot, CharacterSelect, getMascot, lineFor, LINES });
