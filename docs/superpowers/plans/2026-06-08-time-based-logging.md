# 時間ベース記録への移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 種目名の自由入力を廃止し、活動時間（分）だけで記録完了できるようにする。部位は任意・複数選択、コインは記録した日数ベースにする。

**Architecture:** Go + SQLite バックエンドの `entries` テーブルのカラムを `name/amount/unit` → `part/minutes` に改名（起動時に冪等マイグレーション）。`Entry` 構造体・ハンドラ・コイン計算を更新し、React（Babel standalone）の入力シート／カレンダー／バッジ画面の表示を追従させる。

**Tech Stack:** Go 1.25、modernc.org/sqlite（ピュアGo）、React + Babel standalone（ビルド不要）。

---

## File Structure

- `main.go` — Entry 構造体、`initDB`、`migrateSchema`（新規関数）、`buildStatus`、`handleAddEntry` を変更。
- `main_test.go` — TestMain のスキーマを新形式へ、既存テストを新フィールドへ、マイグレーション・バリデーション・コインのテストを追加。
- `static/homeInput.jsx` — 入力シートを「時間主役＋部位チップ（複数選択）」に再構成。
- `static/calendar.jsx` — 行表示とサマリラベルを追従。
- `static/badges.jsx` — バッジ説明テキストを追従。

仕様は `docs/superpowers/specs/2026-06-08-time-based-logging-design.md` を参照。

---

### Task 1: バックエンドのモデル・ハンドラ・コイン計算を新形式へ

**Files:**
- Modify: `main.go:17-23`（Entry 構造体）, `main.go:97-140`（buildStatus）, `main.go:148-167`（handleAddEntry）
- Test: `main_test.go:16-39`（TestMain）, `main_test.go:68-94`（TestHandleAddEntry）, 末尾に新規テスト追加

新形式の Entry／クエリ／バリデーション／コイン計算を、テスト先行で実装する。

- [ ] **Step 1: TestMain のスキーマを新形式へ書き換える**

`main_test.go` の TestMain 内 `CREATE TABLE entries` を差し替える：

```go
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id      INTEGER PRIMARY KEY AUTOINCREMENT,
			date    TEXT    NOT NULL,
			part    TEXT    NOT NULL,
			minutes INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
```

- [ ] **Step 2: 既存テストを新フィールドへ書き換え、新規テストを追加する**

`main_test.go` の `TestHandleAddEntry` を次に置き換える：

```go
func TestHandleAddEntry(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"part":"胸,腕","minutes":20}`)
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
	if resp.TodayEntries[0].Part != "胸,腕" {
		t.Errorf("want part 胸,腕, got %s", resp.TodayEntries[0].Part)
	}
	if resp.TodayEntries[0].Minutes != 20 {
		t.Errorf("want minutes 20, got %d", resp.TodayEntries[0].Minutes)
	}
	if resp.Coins != 20 {
		t.Errorf("want 20 coins, got %d", resp.Coins)
	}
	if resp.Streak != 1 {
		t.Errorf("want streak 1, got %d", resp.Streak)
	}
}
```

`TestHandleDeleteEntry` のリクエストボディも新形式へ：

```go
	body := bytes.NewBufferString(`{"part":"脚","minutes":30}`)
```

`main_test.go` の末尾に新規テストを追加する：

```go
func TestHandleAddEntry_RejectsNonPositiveMinutes(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"part":"胸","minutes":0}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for minutes=0, got %d", rr.Code)
	}
}

func TestHandleAddEntry_AllowsEmptyPart(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"part":"","minutes":15}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200 for empty part, got %d", rr.Code)
	}
	var resp StatusResponse
	json.NewDecoder(rr.Body).Decode(&resp)
	if len(resp.TodayEntries) != 1 {
		t.Fatalf("want 1 entry, got %d", len(resp.TodayEntries))
	}
	if resp.TodayEntries[0].Part != "" {
		t.Errorf("want empty part, got %s", resp.TodayEntries[0].Part)
	}
}

func TestCoins_PerRecordedDay(t *testing.T) {
	clearDB(t)
	// 同じ日に2件記録しても、コインは1日分(20)
	for i := 0; i < 2; i++ {
		body := bytes.NewBufferString(`{"part":"胸","minutes":10}`)
		req := httptest.NewRequest("POST", "/api/entries", body)
		rr := httptest.NewRecorder()
		handleAddEntry(rr, req)
	}
	statusReq := httptest.NewRequest("GET", "/api/status", nil)
	statusRr := httptest.NewRecorder()
	handleStatus(statusRr, statusReq)
	var resp StatusResponse
	json.NewDecoder(statusRr.Body).Decode(&resp)
	if resp.Coins != 20 {
		t.Errorf("want 20 coins for 1 recorded day (2 entries), got %d", resp.Coins)
	}
	if resp.TotalSets != 2 {
		t.Errorf("want total_sets 2, got %d", resp.TotalSets)
	}
}
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `go test ./...`
Expected: コンパイルエラー（`Entry` に `Part`/`Minutes` フィールドが無い）、または FAIL。

- [ ] **Step 4: Entry 構造体を新形式へ変更する**

`main.go:17-23` を置き換える：

```go
type Entry struct {
	ID      int64  `json:"id"`
	Date    string `json:"date"`
	Part    string `json:"part"`
	Minutes int    `json:"minutes"`
}
```

- [ ] **Step 5: buildStatus のクエリ・スキャン・コイン計算を更新する**

`main.go:101-102` の today クエリを置き換える（`CAST` で旧REAL列も整数で読む）：

```go
	if todayRows, err := db.Query(
		"SELECT id, date, part, CAST(minutes AS INTEGER) FROM entries WHERE date = ? ORDER BY id", t); err == nil {
```

`main.go:106` のスキャンを置き換える：

```go
			todayRows.Scan(&e.ID, &e.Date, &e.Part, &e.Minutes)
```

`main.go:121-124` の月次クエリを置き換える：

```go
	if mRows, err := db.Query(
		"SELECT id, date, part, CAST(minutes AS INTEGER) FROM entries WHERE date >= ? AND date <= ? ORDER BY date, id",
		firstDay.Format("2006-01-02"), lastDay.Format("2006-01-02"),
	); err == nil {
```

`main.go:128` のスキャンを置き換える：

```go
			mRows.Scan(&e.ID, &e.Date, &e.Part, &e.Minutes)
```

`main.go:134-136` のコイン計算を置き換える（全期間の記録日数 × 20）：

```go
	db.QueryRow("SELECT COUNT(*) FROM entries").Scan(&resp.TotalSets)
	resp.DoneDays = len(doneDates)
	var recordedDays int
	db.QueryRow("SELECT COUNT(DISTINCT date) FROM entries").Scan(&recordedDays)
	resp.Coins = recordedDays * 20
```

- [ ] **Step 6: handleAddEntry のバリデーションと INSERT を更新する**

`main.go:153-163` を置き換える：

```go
	var req struct {
		Part    string `json:"part"`
		Minutes int    `json:"minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Minutes <= 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	db.Exec("INSERT INTO entries (date, part, minutes) VALUES (?, ?, ?)",
		today(), strings.TrimSpace(req.Part), req.Minutes)
```

- [ ] **Step 7: テストを実行して全パスを確認する**

Run: `go test ./...`
Expected: PASS（`ok  	kintore-go`）。

- [ ] **Step 8: コミット**

```bash
git add main.go main_test.go
git commit -m "feat: switch entries to time-based model (part + minutes), per-day coins"
```

---

### Task 2: 起動時スキーマ・マイグレーション

**Files:**
- Modify: `main.go:37-60`（initDB）, `main.go` に `migrateSchema` 関数を追加
- Test: `main_test.go` 末尾に追加

旧スキーマ（`name/amount/unit`）のDBを新スキーマへ冪等に変換する。

- [ ] **Step 1: マイグレーションの失敗テストを書く**

`main_test.go` 末尾に追加する。独立した in-memory DB を使い、旧スキーマ→マイグレーション→データ保持を検証する：

```go
func TestMigrateSchema_RenamesOldColumns(t *testing.T) {
	mdb, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer mdb.Close()
	mdb.Exec(`CREATE TABLE entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		name TEXT NOT NULL,
		amount REAL NOT NULL,
		unit TEXT NOT NULL
	)`)
	mdb.Exec("INSERT INTO entries (date, name, amount, unit) VALUES ('2026-06-08','胸',20,'回')")

	migrateSchema(mdb)

	var part string
	var minutes int
	err = mdb.QueryRow("SELECT part, CAST(minutes AS INTEGER) FROM entries WHERE date='2026-06-08'").
		Scan(&part, &minutes)
	if err != nil {
		t.Fatalf("expected new columns after migration: %v", err)
	}
	if part != "胸" || minutes != 20 {
		t.Errorf("data not preserved: part=%s minutes=%d", part, minutes)
	}

	// 冪等性: 2回目の呼び出しが落ちないこと
	migrateSchema(mdb)
}

func TestMigrateSchema_NoopOnNewSchema(t *testing.T) {
	mdb, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer mdb.Close()
	mdb.Exec(`CREATE TABLE entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		part TEXT NOT NULL,
		minutes INTEGER NOT NULL
	)`)
	mdb.Exec("INSERT INTO entries (date, part, minutes) VALUES ('2026-06-08','脚',30)")

	migrateSchema(mdb) // 何も壊さない

	var minutes int
	if err := mdb.QueryRow("SELECT minutes FROM entries").Scan(&minutes); err != nil {
		t.Fatalf("new schema should be untouched: %v", err)
	}
	if minutes != 30 {
		t.Errorf("want 30, got %d", minutes)
	}
}
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `go test -run TestMigrateSchema ./...`
Expected: コンパイルエラー（`migrateSchema` 未定義）。

- [ ] **Step 3: migrateSchema 関数を実装する**

`main.go` の `initDB` の直後に追加する：

```go
func migrateSchema(d *sql.DB) {
	rows, err := d.Query("PRAGMA table_info(entries)")
	if err != nil {
		return
	}
	cols := map[string]bool{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk)
		cols[name] = true
	}
	rows.Close()

	if cols["unit"] { // 旧スキーマを検出
		d.Exec("ALTER TABLE entries RENAME COLUMN name TO part")
		d.Exec("ALTER TABLE entries RENAME COLUMN amount TO minutes")
		d.Exec("ALTER TABLE entries DROP COLUMN unit")
	}
}
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `go test -run TestMigrateSchema ./...`
Expected: PASS。

- [ ] **Step 5: initDB を新スキーマ＋マイグレーション呼び出しに更新する**

`main.go:44-59`（`db.Exec(` から `}` まで）を置き換える：

```go
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id      INTEGER PRIMARY KEY AUTOINCREMENT,
			date    TEXT    NOT NULL,
			part    TEXT    NOT NULL,
			minutes INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
	if err != nil {
		log.Fatal(err)
	}
	migrateSchema(db)
```

- [ ] **Step 6: 全テストを実行する**

Run: `go test ./...`
Expected: PASS。

- [ ] **Step 7: コミット**

```bash
git add main.go main_test.go
git commit -m "feat: add idempotent schema migration for entries table"
```

---

### Task 3: 入力シートを時間主役＋部位チップへ（homeInput.jsx）

**Files:**
- Modify: `static/homeInput.jsx`（全面的に入力シートまわりを再構成）

種目の自由入力・単位トグルを廃止し、時間ステッパー（デフォルト0分）と複数選択の部位チップにする。

- [ ] **Step 1: COMMON / UNITS を部位リストへ置き換える**

`static/homeInput.jsx:4-12` を置き換える：

```jsx
const PARTS = ["胸", "背中", "肩", "腕", "脚", "腹", "全身", "有酸素"];
```

- [ ] **Step 2: シートのフォーム状態を時間＋部位に変更する**

`static/homeInput.jsx:39-48`（`// sheet form state` から `pick` 関数まで）を置き換える：

```jsx
  // sheet form state
  const [parts, setParts] = useStateI([]);
  const [minutes, setMinutes] = useStateI(0);

  const openSheet = () => {
    setParts([]); setMinutes(0); setSheet(true);
  };
  const togglePart = (p) =>
    setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
```

- [ ] **Step 3: record 関数を新ペイロードに変更する**

`static/homeInput.jsx:49-55`（`record` 関数）を置き換える：

```jsx
  const record = () => {
    if (minutes <= 0) return;
    const first = entries.length === 0;
    onRecord && onRecord({ part: parts.join(","), minutes });
    if (first) { setCheer(true); setTimeout(() => setCheer(false), 1100); }
    setSheet(false);
  };
```

- [ ] **Step 4: ログ件数ラベルと空状態メッセージを更新する**

`static/homeInput.jsx:91` を置き換える：

```jsx
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--orange-d)" }}>{log.length} きろく</div>
```

`static/homeInput.jsx:97` を置き換える：

```jsx
            <div style={{ fontSize: 14, textAlign: "center" }}>まだ記録がないよ。<br />きょうの トレを きろくしよう！</div>
```

- [ ] **Step 5: ログ行の表示を部位＋分に変更する**

`static/homeInput.jsx:104-105` を置き換える（部位未選択なら左側は空）：

```jsx
                <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{e.part ? e.part.split(",").join("・") : ""}</div>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 11, color: "var(--orange-d)" }}>{e.minutes}分</div>
```

- [ ] **Step 6: 入力シートの中身（種目チップ・自由入力・単位トグル）を時間＋部位UIへ置き換える**

`static/homeInput.jsx:120-156`（シート内の見出し `なにを した？` から単位トグルの閉じ `</div>` まで）を置き換える：

```jsx
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--ink)", textAlign: "center" }}>どれくらい うごいた？</div>

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
```

- [ ] **Step 7: 記録ボタンを minutes 未入力時に無効化する**

`static/homeInput.jsx`（Step 6 適用後の）記録ボタン行 `<RetroButton tone="green" size="md" onClick={record} ...>これを きろく！</RetroButton>` を置き換える：

```jsx
              <RetroButton tone="green" size="md" onClick={record} disabled={minutes <= 0} style={{ flex: 2, opacity: minutes <= 0 ? 0.5 : 1 }}>これを きろく！</RetroButton>
```

- [ ] **Step 8: 手動で起動確認する**

Run: `go run .`（別ターミナル）→ ブラウザで http://localhost:4949
Expected:
- 「＋ きろくする」→ シートで時間が 0分、＋で5分刻み。
- 部位を複数タップでトグル選択できる。
- 0分のままだと「これを きろく！」が薄く押せない。
- 5分以上＋部位なしで記録 → ログに「5分」だけ表示。
確認できたらサーバを停止（Ctrl+C）。

- [ ] **Step 9: コミット**

```bash
git add static/homeInput.jsx
git commit -m "feat: time-first input sheet with multi-select body parts"
```

---

### Task 4: カレンダー・バッジの表示を追従（calendar.jsx / badges.jsx）

**Files:**
- Modify: `static/calendar.jsx:92-93`, `static/calendar.jsx:102`
- Modify: `static/badges.jsx`（バッジ説明テキスト2件）

- [ ] **Step 1: カレンダーの行表示を部位＋分に変更する**

`static/calendar.jsx:92-93` を置き換える：

```jsx
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{e.part ? e.part.split(",").join("・") : ""}</span>
                  <span style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: "var(--orange-d)" }}>{e.minutes}分</span>
```

- [ ] **Step 2: サマリカードのラベルを更新する**

`static/calendar.jsx:102` を置き換える：

```jsx
          <SummaryCard label="きろく数" value={totalSets} unit="こ" />
```

- [ ] **Step 3: バッジの説明テキストを更新する**

`static/badges.jsx` の sets10 / sets50 バッジ定義行を置き換える：

```jsx
    { id: "sets10", name: "コツコツ10", desc: "そう きろく 10こ", grid: SPRITES.DUMBBELL, cur: Math.min(totalSets, 10), goal: 10 },
    { id: "sets50", name: "やりこみ50", desc: "そう きろく 50こ", grid: ICON.hundred, cur: Math.min(totalSets, 50), goal: 50 },
```

- [ ] **Step 4: 手動で起動確認する**

Run: `go run .`（別ターミナル）→ ブラウザで http://localhost:4949
Expected:
- 記録後、カレンダー（ホーム）の日別リストが「部位 / N分」表示。
- サマリが「きろく数（こ）」。
- バッジ画面のコツコツ10/やりこみ50 の説明が「そう きろく Nこ」。
確認できたらサーバを停止（Ctrl+C）。

- [ ] **Step 5: コミット**

```bash
git add static/calendar.jsx static/badges.jsx
git commit -m "feat: follow time-based model in calendar and badges labels"
```

---

## 完了条件

- `go test ./...` がパスする。
- 種目名を入力せず、時間（と任意の部位）だけで記録できる。
- 同じ日に複数回記録してもコインは1日分（20）。
- 旧スキーマの `kintore.db` を起動しても自動で新スキーマへ移行し、既存データが保持される。
