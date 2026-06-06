// ui.jsx — Shared retro/arcade UI primitives for the 筋トレ streak app.
// Exports to window: PixelArt, SPRITES, RetroPanel, RetroButton, StatChip,
// SegBar, DayDot, useStreakState, Sparkles.
const { useState, useEffect, useRef, useCallback } = React;

/* ----------------------------------------------------------------------------
   PixelArt — renders a tiny sprite from a string grid.
   '.' = transparent. Any other char maps to palette[char].
   Rows are auto-padded to equal length so a stray short row can't break layout.
---------------------------------------------------------------------------- */
function PixelArt({ grid, palette, scale = 6, className = "", style = {}, "aria-label": al }) {
  const rows = grid.replace(/^\n|\n$/g, "").split("\n");
  const w = Math.max(...rows.map((r) => r.length));
  const cells = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y].padEnd(w, ".");
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const col = ch === "." ? "transparent" : palette[ch] || "transparent";
      cells.push(<div key={y * w + x} style={{ background: col }} />);
    }
  }
  return (
    <div
      role="img"
      aria-label={al}
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${w}, ${scale}px)`,
        gridTemplateRows: `repeat(${rows.length}, ${scale}px)`,
        width: w * scale,
        height: rows.length * scale,
        imageRendering: "pixelated",
        ...style,
      }}
    >
      {cells}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   SPRITES — palettes + grids. Designed on a warm orange/red retro palette.
---------------------------------------------------------------------------- */
const PAL = {
  k: "#241712", // ink outline
  o: "#F2691E", // orange body
  d: "#C9501A", // shade
  l: "#FF9A4D", // highlight
  w: "#FFF6E6", // white
  b: "#241712", // pupil
  r: "#E23B2E", // red (headband/tongue)
  y: "#F8C13A", // yellow
  g: "#3FA34D", // green
  m: "#7A3414", // mouth dark
  s: "#FFCB8E", // light skin highlight
};

// Mascot "ブリオ" — a determined orange buddy with a red headband. ~16w
const MASCOT_HAPPY = `
......kkkkkk......
....kkllllllkk....
...krrrrrrrrrrk...
...krwrrrrrrwrk...
..kkoooooooooookk.
.koollooooooollok.
.kowwbooooobwwook.
.koowboooooobwook.
.kooooooddoooooook
.koooooddddooooook
.kooosmmmmmmsoook.
.koooommmmmmoook..
..koooooooooook...
..kdooooooooodk...
...kkdooooodkk....
.....kkkkkkkk.....
`;

// Mascot cheering (arms not drawn; eyes happy ^_^) for celebration
const MASCOT_CHEER = `
......kkkkkk......
....kkllllllkk....
...krrrrrrrrrrk...
...krwrrrrrrwrk...
..kkoooooooooookk.
.koolkooookooolok.
.kowkkooooookkwok.
.kooooooooooooook.
.koookoooookoooook
.koookmmmmmkoooook
.kooommmmmmmooook.
.koooommmmmmoook..
..koooooooooook...
..kdooooooooodk...
...kkdooooodkk....
.....kkkkkkkk.....
`;

// Streak flame — orange/yellow campfire flame
const FLAME = `
....k....
...kyk...
..kyrk...
..kyrrk..
.kyrook..
.kyoook..
kyooodk..
kyoodk...
kyoodk...
.kyodk...
.kkddk...
..kkk....
`;

// Dumbbell icon
const DUMBBELL = `
kk......kk
kdk....kdk
kdkkkkkkdk
kdkooookdk
kdkooookdk
kdkkkkkkdk
kdk....kdk
kk......kk
`;

// Coin / XP token
const COIN = `
..kkkk..
.kyyyyk.
kyylyyik
kyloyiik
kyyoyiik
kyyyyiik
.kiiiik.
..kkkk..
`;

// Star badge
const STAR = `
....k....
....k....
...kyk...
kkkkykkkk
.kyyyyyk.
..kyyyk..
..kyyyk..
.kyk.kyk.
.kk...kk.
`;

const SPRITES = { PAL, MASCOT_HAPPY, MASCOT_CHEER, FLAME, DUMBBELL, COIN, STAR };

/* ----------------------------------------------------------------------------
   RetroPanel — thick ink border + hard offset shadow.
---------------------------------------------------------------------------- */
function RetroPanel({ children, className = "", style = {}, tone = "paper", flush = false }) {
  const bg =
    tone === "paper" ? "var(--paper)" :
    tone === "paper2" ? "var(--paper2)" :
    tone === "ink" ? "var(--ink)" :
    tone === "orange" ? "var(--orange)" : tone;
  return (
    <div
      className={className}
      style={{
        background: bg,
        border: "3px solid var(--ink)",
        boxShadow: flush ? "none" : "5px 5px 0 0 var(--ink)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   RetroButton — chunky pressable arcade button.
---------------------------------------------------------------------------- */
function RetroButton({ children, onClick, tone = "orange", size = "md", disabled, style = {}, full }) {
  const [down, setDown] = useState(false);
  const tones = {
    orange: { bg: "var(--orange)", fg: "#fff", edge: "var(--orange-d)" },
    red: { bg: "var(--red)", fg: "#fff", edge: "#A8261D" },
    green: { bg: "var(--green)", fg: "#fff", edge: "#2C7838" },
    yellow: { bg: "var(--yellow)", fg: "var(--ink)", edge: "#D69A1F" },
    paper: { bg: "var(--paper)", fg: "var(--ink)", edge: "#D9C49A" },
  };
  const t = tones[tone] || tones.orange;
  const pads = { sm: "8px 12px", md: "12px 18px", lg: "16px 22px" };
  const fonts = { sm: 9, md: 11, lg: 14 };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => !disabled && setDown(true)}
      onMouseUp={() => setDown(false)}
      onMouseLeave={() => setDown(false)}
      disabled={disabled}
      style={{
        fontFamily: "'Press Start 2P', system-ui",
        fontSize: fonts[size],
        lineHeight: 1.5,
        color: t.fg,
        background: t.bg,
        border: "3px solid var(--ink)",
        padding: pads[size],
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: full ? "100%" : "auto",
        boxShadow: down || disabled ? `0 0 0 0 ${t.edge}` : `0 5px 0 0 ${t.edge}, 0 5px 0 3px var(--ink)`,
        transform: down && !disabled ? "translateY(5px)" : "translateY(0)",
        transition: "transform .04s, box-shadow .04s",
        letterSpacing: ".5px",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------------
   StatChip — small labelled stat (flame, coins, level).
---------------------------------------------------------------------------- */
function StatChip({ icon, value, label, tone = "paper" }) {
  return (
    <RetroPanel tone={tone} flush style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" }}>
      {icon}
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontFamily: "'Press Start 2P'", fontSize: 13, color: "var(--ink)" }}>{value}</div>
        {label && <div style={{ fontSize: 11, color: "var(--ink)", opacity: 0.7, marginTop: 2 }}>{label}</div>}
      </div>
    </RetroPanel>
  );
}

/* ----------------------------------------------------------------------------
   SegBar — segmented XP / progress bar (retro chunky segments).
---------------------------------------------------------------------------- */
function SegBar({ value, max, segs = 12, color = "var(--yellow)", height = 18 }) {
  const filled = Math.round((value / max) * segs);
  return (
    <div style={{ display: "flex", gap: 2, padding: 3, border: "3px solid var(--ink)", background: "var(--ink)", height }}>
      {Array.from({ length: segs }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: i < filled ? color : "#4a3a2e", transition: "background .25s" }} />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   DayDot — a single calendar day cell.
---------------------------------------------------------------------------- */
function DayDot({ state, label, size = 30, today }) {
  // state: 'done' | 'miss' | 'future' | 'today'
  const map = {
    done: { bg: "var(--orange)", fg: "#fff" },
    miss: { bg: "#E8D6B0", fg: "#B9A079" },
    future: { bg: "var(--paper2)", fg: "var(--ink)" },
    rest: { bg: "var(--green)", fg: "#fff" },
  };
  const c = map[state] || map.future;
  return (
    <div
      style={{
        width: size, height: size,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: c.bg, color: c.fg,
        border: today ? "3px solid var(--red)" : "2px solid var(--ink)",
        fontFamily: "'Press Start 2P'", fontSize: size > 26 ? 9 : 7,
        boxShadow: today ? "0 0 0 2px var(--paper), 0 0 0 4px var(--red)" : "none",
      }}
    >
      {state === "done" ? "★" : label}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Sparkles — celebratory burst around an element.
---------------------------------------------------------------------------- */
function Sparkles({ show }) {
  if (!show) return null;
  const bits = Array.from({ length: 10 });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {bits.map((_, i) => {
        const ang = (i / bits.length) * Math.PI * 2;
        const dist = 60 + (i % 3) * 14;
        const col = ["var(--yellow)", "var(--orange)", "var(--red)"][i % 3];
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: "50%", top: "50%", width: 10, height: 10,
              background: col, border: "2px solid var(--ink)",
              animation: `spark .7s ease-out forwards`,
              "--dx": `${Math.cos(ang) * dist}px`,
              "--dy": `${Math.sin(ang) * dist}px`,
            }}
          />
        );
      })}
    </div>
  );
}

Object.assign(window, { PixelArt, SPRITES, RetroPanel, RetroButton, StatChip, SegBar, DayDot, Sparkles });
