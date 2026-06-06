# kintore-go リデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロトタイプのレトロピクセルアートReactアプリをGoバックエンド（SQLite）と接続して動く本物のアプリにする

**Architecture:** Goサーバーが`entries`テーブル（種目記録）と`settings`テーブル（キャラ選択）を持つSQLite DBを管理。フロントエンドはBabel standaloneでビルド不要のReact JSX。`app.jsx`がAPIと接続し、他のJSXコンポーネントはプロトタイプからほぼそのままコピー。

**Tech Stack:** Go 1.21+, modernc.org/sqlite, React 18 (CDN), Babel standalone (CDN)

---

### Task 1: Goバックエンド書き換え

**Files:**
- Modify: `main.go`
- Create: `main_test.go`

- [ ] **Step 1: main_test.go を書く（まずテストから）**

`main_test.go` を新規作成：

```go
package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	_ "modernc.org/sqlite"
)

func TestMain(m *testing.M) {
	var err error
	db, err = sql.Open("sqlite", ":memory:")
	if err != nil {
		panic(err)
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			date TEXT NOT NULL,
			name TEXT NOT NULL,
			amount REAL NOT NULL,
			unit TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
	if err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func clearDB(t *testing.T) {
	t.Helper()
	db.Exec("DELETE FROM entries")
	db.Exec("DELETE FROM settings")
}

func TestHandleStatus_Empty(t *testing.T) {
	clearDB(t)
	req := httptest.NewRequest("GET", "/api/status", nil)
	rr := httptest.NewRecorder()
	handleStatus(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rr.Code)
	}
	var resp StatusResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp.TodayDone {
		t.Error("today_done should be false for empty DB")
	}
	if resp.Character != "guts" {
		t.Errorf("want default character guts, got %s", resp.Character)
	}
	if len(resp.TodayEntries) != 0 {
		t.Errorf("want 0 today_entries, got %d", len(resp.TodayEntries))
	}
}

func TestHandleAddEntry(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"name":"腕立て伏せ","amount":20,"unit":"回"}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rr.Code)
	}
	var resp StatusResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if !resp.TodayDone {
		t.Error("today_done should be true after adding entry")
	}
	if len(resp.TodayEntries) != 1 {
		t.Fatalf("want 1 entry, got %d", len(resp.TodayEntries))
	}
	if resp.TodayEntries[0].Name != "腕立て伏せ" {
		t.Errorf("want 腕立て伏せ, got %s", resp.TodayEntries[0].Name)
	}
	if resp.Coins != 20 {
		t.Errorf("want 20 coins, got %d", resp.Coins)
	}
}

func TestHandleDeleteEntry(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"name":"腹筋","amount":30,"unit":"回"}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	var addResp StatusResponse
	json.NewDecoder(rr.Body).Decode(&addResp)
	id := addResp.TodayEntries[0].ID

	delReq := httptest.NewRequest("DELETE", fmt.Sprintf("/api/entries/%d", id), nil)
	delRr := httptest.NewRecorder()
	handleDeleteEntry(delRr, delReq)
	if delRr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", delRr.Code)
	}
	var delResp StatusResponse
	json.NewDecoder(delRr.Body).Decode(&delResp)
	if delResp.TodayDone {
		t.Error("today_done should be false after deleting all entries")
	}
}

func TestHandleCharacter(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"character":"wakaba"}`)
	req := httptest.NewRequest("POST", "/api/character", body)
	rr := httptest.NewRecorder()
	handleCharacter(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rr.Code)
	}
	if getCharacter() != "wakaba" {
		t.Errorf("want wakaba, got %s", getCharacter())
	}
}
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/SatoTakumi/IdeaProject/kintore-go
go test ./...
```

期待: コンパイルエラーまたは関数未定義エラー

- [ ] **Step 3: main.go を書き換える**

`main.go` を以下で置き換える：

```go
package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var db *sql.DB

type Entry struct {
	ID     int64   `json:"id"`
	Date   string  `json:"date"`
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Unit   string  `json:"unit"`
}

type StatusResponse struct {
	TodayDone    bool               `json:"today_done"`
	Streak       int                `json:"streak"`
	TodayEntries []Entry            `json:"today_entries"`
	Month        map[string][]Entry `json:"month"`
	TotalSets    int                `json:"total_sets"`
	DoneDays     int                `json:"done_days"`
	Coins        int                `json:"coins"`
	Character    string             `json:"character"`
}

func initDB() {
	var err error
	db, err = sql.Open("sqlite", "./kintore.db")
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id     INTEGER PRIMARY KEY AUTOINCREMENT,
			date   TEXT    NOT NULL,
			name   TEXT    NOT NULL,
			amount REAL    NOT NULL,
			unit   TEXT    NOT NULL
		);
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
	if err != nil {
		log.Fatal(err)
	}
}

func today() string {
	return time.Now().Format("2006-01-02")
}

func calcStreak() int {
	rows, err := db.Query("SELECT DISTINCT date FROM entries ORDER BY date DESC")
	if err != nil {
		return 0
	}
	defer rows.Close()
	streak := 0
	expected := time.Now().Truncate(24 * time.Hour)
	for rows.Next() {
		var d string
		rows.Scan(&d)
		t, _ := time.Parse("2006-01-02", d)
		if t.Equal(expected) {
			streak++
			expected = expected.AddDate(0, 0, -1)
		} else if t.Before(expected) {
			break
		}
	}
	return streak
}

func getCharacter() string {
	var char string
	if err := db.QueryRow("SELECT value FROM settings WHERE key='character'").Scan(&char); err != nil {
		return "guts"
	}
	return char
}

func buildStatus() StatusResponse {
	var resp StatusResponse
	t := today()

	todayRows, _ := db.Query(
		"SELECT id, date, name, amount, unit FROM entries WHERE date = ? ORDER BY id", t)
	defer todayRows.Close()
	for todayRows.Next() {
		var e Entry
		todayRows.Scan(&e.ID, &e.Date, &e.Name, &e.Amount, &e.Unit)
		resp.TodayEntries = append(resp.TodayEntries, e)
	}
	if resp.TodayEntries == nil {
		resp.TodayEntries = []Entry{}
	}
	resp.TodayDone = len(resp.TodayEntries) > 0
	resp.Streak = calcStreak()

	now := time.Now()
	firstDay := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	lastDay := firstDay.AddDate(0, 1, -1)
	mRows, _ := db.Query(
		"SELECT id, date, name, amount, unit FROM entries WHERE date >= ? AND date <= ? ORDER BY date, id",
		firstDay.Format("2006-01-02"), lastDay.Format("2006-01-02"),
	)
	defer mRows.Close()
	resp.Month = make(map[string][]Entry)
	doneDates := make(map[string]bool)
	for mRows.Next() {
		var e Entry
		mRows.Scan(&e.ID, &e.Date, &e.Name, &e.Amount, &e.Unit)
		resp.Month[e.Date] = append(resp.Month[e.Date], e)
		doneDates[e.Date] = true
	}

	db.QueryRow("SELECT COUNT(*) FROM entries").Scan(&resp.TotalSets)
	resp.DoneDays = len(doneDates)
	resp.Coins = resp.TotalSets * 20
	resp.Character = getCharacter()
	return resp
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	resp := buildStatus()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleAddEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Name   string  `json:"name"`
		Amount float64 `json:"amount"`
		Unit   string  `json:"unit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	db.Exec("INSERT INTO entries (date, name, amount, unit) VALUES (?, ?, ?, ?)",
		today(), strings.TrimSpace(req.Name), req.Amount, req.Unit)
	resp := buildStatus()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(r.URL.Path, "/")
	id, err := strconv.ParseInt(parts[len(parts)-1], 10, 64)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	db.Exec("DELETE FROM entries WHERE id = ?", id)
	resp := buildStatus()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleCharacter(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"character": getCharacter()})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Character string `json:"character"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Character == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('character', ?)", req.Character)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"character": req.Character})
}

func main() {
	initDB()
	defer db.Close()

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./static")))
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/entries", handleAddEntry)
	mux.HandleFunc("/api/entries/", handleDeleteEntry)
	mux.HandleFunc("/api/character", handleCharacter)

	log.Println("Listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

- [ ] **Step 4: テストを実行して全部グリーンになることを確認**

```bash
go test ./... -v
```

期待出力（4テストがPASS）:
```
--- PASS: TestHandleStatus_Empty
--- PASS: TestHandleAddEntry
--- PASS: TestHandleDeleteEntry
--- PASS: TestHandleCharacter
ok  	kintore-go
```

- [ ] **Step 5: ビルドが通ることを確認**

```bash
go build ./...
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
git add main.go main_test.go
git commit -m "feat: rewrite backend with entries+settings schema"
```

---

### Task 2: static/index.html を差し替え

**Files:**
- Modify: `static/index.html`

- [ ] **Step 1: index.html を書き換える**

`static/index.html` を以下で置き換える：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>kintore-go — 筋トレ継続アプリ</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #241712;
    --paper: #FFF3DD;
    --paper2: #FCE7BE;
    --orange: #F2691E;
    --orange-d: #C9501A;
    --orange-l: #FF9A4D;
    --red: #E23B2E;
    --yellow: #F8C13A;
    --green: #3FA34D;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font-family: 'DotGothic16', system-ui, sans-serif;
    -webkit-font-smoothing: none;
    color: var(--ink);
    background: #2a2320;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }
  button { font-family: inherit; }
  @keyframes spark {
    from { transform: translate(-50%, -50%); opacity: 1; }
    to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.3); opacity: 0; }
  }
  @keyframes popin {
    0% { transform: scale(.4); opacity: 0; }
    70% { transform: scale(1.12); }
    100% { transform: scale(1); opacity: 1; }
  }
  #phone {
    width: 414px;
    height: 860px;
    max-height: calc(100vh - 48px);
    border: 5px solid var(--ink);
    background: var(--paper);
    box-shadow: 0 0 0 4px #3a302a, 12px 12px 0 0 rgba(0,0,0,.35);
    overflow: hidden;
    position: relative;
  }
  #root { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="phone"><div id="root"></div></div>

<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous"></script>

<script type="text/babel" src="ui.jsx"></script>
<script type="text/babel" src="mascots.jsx"></script>
<script type="text/babel" src="homeInput.jsx"></script>
<script type="text/babel" src="calendar.jsx"></script>
<script type="text/babel" src="badges.jsx"></script>
<script type="text/babel" src="app.jsx"></script>
<script type="text/babel">
  ReactDOM.createRoot(document.getElementById("root")).render(<window.KintoreApp />);
</script>
</body>
</html>
```

- [ ] **Step 2: コミット**

```bash
git add static/index.html
git commit -m "feat: replace index.html with React phone-frame"
```

---

### Task 3: ui.jsx と mascots.jsx をコピー

**Files:**
- Create: `static/ui.jsx`
- Create: `static/mascots.jsx`

プロトタイプからそのままコピー。変更なし。

- [ ] **Step 1: ui.jsx をコピー**

`/tmp/design_unpacked/kintore-go/project/ui.jsx` の内容を `static/ui.jsx` に書き込む（ファイル内容は変更なし）。

- [ ] **Step 2: mascots.jsx をコピー**

`/tmp/design_unpacked/kintore-go/project/mascots.jsx` の内容を `static/mascots.jsx` に書き込む（ファイル内容は変更なし）。

- [ ] **Step 3: コミット**

```bash
git add static/ui.jsx static/mascots.jsx
git commit -m "feat: add ui and mascot components from prototype"
```

---

### Task 4: homeInput.jsx、calendar.jsx、badges.jsx をコピー

**Files:**
- Create: `static/homeInput.jsx`
- Create: `static/calendar.jsx` （日付表示を1箇所修正）
- Create: `static/badges.jsx`

- [ ] **Step 1: homeInput.jsx をコピー**

`/tmp/design_unpacked/kintore-go/project/homeInput.jsx` の内容を `static/homeInput.jsx` に書き込む（変更なし）。

- [ ] **Step 2: badges.jsx をコピー**

`/tmp/design_unpacked/kintore-go/project/badges.jsx` の内容を `static/badges.jsx` に書き込む（変更なし）。

- [ ] **Step 3: calendar.jsx をコピーして日付表示を修正**

`/tmp/design_unpacked/kintore-go/project/calendar.jsx` の内容を `static/calendar.jsx` に書き込んだあと、以下の変更を加える。

関数シグネチャに `monthNum` プロップを追加：

変更前:
```js
function CalendarScreen({ char = "guts", history = {}, today = 6, streak = 0, coins = 0, monthStartDow = 1, daysInMonth = 30, monthLabel = "2026 / 6", onJumpHome }) {
```

変更後:
```js
function CalendarScreen({ char = "guts", history = {}, today = 6, streak = 0, coins = 0, monthStartDow = 1, daysInMonth = 30, monthLabel = "2026 / 6", monthNum = 6, onJumpHome }) {
```

日付ラベルのハードコードを修正：

変更前:
```jsx
<div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--ink)" }}>6/{picked} のきろく</div>
```

変更後:
```jsx
<div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--ink)" }}>{monthNum}/{picked} のきろく</div>
```

- [ ] **Step 4: コミット**

```bash
git add static/homeInput.jsx static/calendar.jsx static/badges.jsx
git commit -m "feat: add screen components from prototype"
```

---

### Task 5: app.jsx — API接続

**Files:**
- Create: `static/app.jsx`

- [ ] **Step 1: app.jsx を作成**

`static/app.jsx` を新規作成：

```jsx
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
    fetchStatus().then(() => setPhase("intro"));
  }, []);

  const record = (entry) =>
    fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
      .then((r) => r.json())
      .then(setStatus);

  const del = (id) =>
    fetch(`/api/entries/${id}`, { method: "DELETE" })
      .then((r) => r.json())
      .then(setStatus);

  const start = (id) => {
    fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: id }),
    });
    setChar(id);
    setPhase("app");
    setScreen("home");
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
        {screen === "home" && (
          <HomeInput
            char={char} entries={todayEntries}
            onRecord={record} onDelete={del}
            streak={streak} coins={coins}
            dateLabel={dateLabel} weekday={weekday}
          />
        )}
        {screen === "calendar" && (
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
          <PixelArt grid={SPRITES.DUMBBELL} palette={SPRITES.PAL} scale={3} />
        </NavTab>
        <NavTab active={screen === "calendar"} label="カレンダー" onClick={() => setScreen("calendar")}>
          <PixelArt grid={window.BADGE_CAL} palette={SPRITES.PAL} scale={3} />
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
```

- [ ] **Step 2: コミット**

```bash
git add static/app.jsx
git commit -m "feat: add app.jsx with API integration"
```

---

### Task 6: 旧ファイルを削除してE2E確認

**Files:**
- Delete: `static/style.css`
- Delete: `static/app.js`

- [ ] **Step 1: 旧ファイルを削除**

```bash
rm /Users/SatoTakumi/IdeaProject/kintore-go/static/style.css
rm /Users/SatoTakumi/IdeaProject/kintore-go/static/app.js
```

- [ ] **Step 2: サーバーを起動**

```bash
cd /Users/SatoTakumi/IdeaProject/kintore-go
go run main.go
```

期待: `Listening on http://localhost:8080`

- [ ] **Step 3: API動作確認**

別ターミナルで：

```bash
# ステータス確認
curl http://localhost:8080/api/status | python3 -m json.tool

# 種目を記録
curl -X POST http://localhost:8080/api/entries \
  -H "Content-Type: application/json" \
  -d '{"name":"腕立て伏せ","amount":20,"unit":"回"}'

# キャラ変更
curl -X POST http://localhost:8080/api/character \
  -H "Content-Type: application/json" \
  -d '{"character":"wakaba"}'

# ステータス再確認（today_done=true、character=wakabaになること）
curl http://localhost:8080/api/status | python3 -m json.tool
```

- [ ] **Step 4: ブラウザで動作確認**

`http://localhost:8080` を開いて以下を確認：
1. キャラセレクト画面が表示される（6体が選べる）
2. 「このあいぼうで はじめる」でホーム画面に遷移
3. 「＋きろくする」でシートが開き、種目を選んで記録できる
4. 記録するとマスコットがhappy顔になり、コインが増える
5. カレンダーに今日の★が表示される
6. バッジ画面でアンロック状況が見える
7. 「きせかえ」でキャラを変えるとヘッダー色が変わる
8. ページをリロードしても記録が残っている（永続化確認）

- [ ] **Step 5: コミット**

```bash
git add -u  # 削除ファイルをステージ
git commit -m "feat: remove legacy static files, complete redesign"
```
