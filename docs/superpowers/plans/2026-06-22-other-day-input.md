# 他の日の入力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** きろくを今日だけでなく、今月の過去日（1日〜今日）にも記録・削除できるようにする。

**Architecture:** バックエンドの `handleAddEntry` に任意 `date` を追加し検証（未来不可・形式不正は400）、`handleDeleteEntry` の today 制約を撤廃。フロントは App が `selectedDate` を持ち、きろく画面の前日/翌日セレクタとカレンダーの日タップの両導線から選択日を切り替えて POST する。

**Tech Stack:** Go (net/http, modernc.org/sqlite), React (Babel standalone, ビルド不要の素の JSX)。

## Global Constraints

- Go 1.25 以上。SQLite ドライバは `modernc.org/sqlite`（cgo不要）。
- 入力可能範囲は**今月の1日〜今日**。未来日は不可。
- フロントは静的 `static/*.jsx`、`window.X = X` でグローバル公開する既存パターンに従う。
- フロントのテスト基盤は無い → フロントタスクは `make run` + ブラウザで手動確認。
- 日付文字列は常に `YYYY-MM-DD` 形式。
- コミットメッセージ末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

### Task 1: バックエンド — date付き追加と日付制約なし削除

**Files:**
- Modify: `main.go` （`handleAddEntry` 172-190, `handleDeleteEntry` 192-207）
- Test: `main_test.go`

**Interfaces:**
- Consumes: 既存 `today() string`, `buildStatus()`, `StatusResponse`。
- Produces: `POST /api/entries` が JSON `{part, minutes, date?}` を受理。`date` 省略=今日、未来日=400、形式不正=400。`DELETE /api/entries/{id}` は id のみで削除（日付不問）。

- [ ] **Step 1: 失敗するテストを書く**

`main_test.go` の末尾に追加：

```go
func TestHandleAddEntry_PastDate(t *testing.T) {
	clearDB(t)
	// 今月の過去日を作る（今日が1日なら前月になるのを避け、安全に今日を使い date 経路を通す）
	pastDay := time.Now().AddDate(0, 0, -3).Format("2006-01-02")
	body := bytes.NewBufferString(`{"part":"背中","minutes":25,"date":"` + pastDay + `"}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200 for past date, got %d", rr.Code)
	}
	var cnt int
	db.QueryRow("SELECT COUNT(*) FROM entries WHERE date = ?", pastDay).Scan(&cnt)
	if cnt != 1 {
		t.Fatalf("want 1 entry on %s, got %d", pastDay, cnt)
	}
}

func TestHandleAddEntry_RejectsFutureDate(t *testing.T) {
	clearDB(t)
	future := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	body := bytes.NewBufferString(`{"part":"胸","minutes":10,"date":"` + future + `"}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for future date, got %d", rr.Code)
	}
}

func TestHandleAddEntry_RejectsMalformedDate(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"part":"胸","minutes":10,"date":"2026/06/15"}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for malformed date, got %d", rr.Code)
	}
}

func TestHandleAddEntry_OmittedDateDefaultsToday(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"part":"肩","minutes":12}`)
	req := httptest.NewRequest("POST", "/api/entries", body)
	rr := httptest.NewRecorder()
	handleAddEntry(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rr.Code)
	}
	var cnt int
	db.QueryRow("SELECT COUNT(*) FROM entries WHERE date = ?", today()).Scan(&cnt)
	if cnt != 1 {
		t.Fatalf("want 1 entry on today, got %d", cnt)
	}
}

func TestHandleDeleteEntry_PastDate(t *testing.T) {
	clearDB(t)
	pastDay := time.Now().AddDate(0, 0, -2).Format("2006-01-02")
	res, _ := db.Exec("INSERT INTO entries (date, part, minutes) VALUES (?, '脚', 30)", pastDay)
	id, _ := res.LastInsertId()

	delReq := httptest.NewRequest("DELETE", fmt.Sprintf("/api/entries/%d", id), nil)
	delRr := httptest.NewRecorder()
	handleDeleteEntry(delRr, delReq)
	if delRr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", delRr.Code)
	}
	var cnt int
	db.QueryRow("SELECT COUNT(*) FROM entries WHERE id = ?", id).Scan(&cnt)
	if cnt != 0 {
		t.Errorf("past-date entry should be deleted, still %d", cnt)
	}
}
```

`main_test.go` の import に `"time"` を追加。

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd /Users/SatoTakumi/IdeaProject/kintore-go/.claude/worktrees/other-day-input && go test ./... -run 'TestHandleAddEntry_PastDate|TestHandleAddEntry_RejectsFutureDate|TestHandleAddEntry_RejectsMalformedDate|TestHandleDeleteEntry_PastDate' -v`
Expected: FAIL（過去日が today に入る／未来日が200のまま／過去日削除が today 制約で消えない）

- [ ] **Step 3: 実装する**

`main.go` の `handleAddEntry` を差し替え：

```go
func handleAddEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Part    string `json:"part"`
		Minutes int    `json:"minutes"`
		Date    string `json:"date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Minutes <= 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	date := today()
	if req.Date != "" {
		t, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			http.Error(w, "bad date", http.StatusBadRequest)
			return
		}
		if t.Format("2006-01-02") > today() {
			http.Error(w, "future date not allowed", http.StatusBadRequest)
			return
		}
		date = t.Format("2006-01-02")
	}
	db.Exec("INSERT INTO entries (date, part, minutes) VALUES (?, ?, ?)",
		date, strings.TrimSpace(req.Part), req.Minutes)
	resp := buildStatus()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
```

`main.go` の `handleDeleteEntry` の DELETE 文を差し替え：

```go
	db.Exec("DELETE FROM entries WHERE id = ?", id)
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd /Users/SatoTakumi/IdeaProject/kintore-go/.claude/worktrees/other-day-input && go test ./... -v`
Expected: PASS（既存テスト含め全て）

- [ ] **Step 5: コミット**

```bash
git add main.go main_test.go
git commit -m "feat: accept optional date on add entry, drop today-only delete

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: app.jsx — selectedDate state と各画面への配線

**Files:**
- Modify: `static/app.jsx`

**Interfaces:**
- Consumes: 既存 `status.month`（`{"YYYY-MM-DD":[Entry]}`）, `record`, `del`, `setScreen`。
- Produces: `selectedDate`（"YYYY-MM-DD"）と `setSelectedDate` を HomeInput/CalendarScreen に渡す。`record` が `selectedDate` を `date` として送信。HomeInput 用に選択日の entries（`selectedEntries`）を `status.month` から導出。`addForDay(day:number)` ヘルパで日選択+log画面遷移。

- [ ] **Step 1: selectedDate state とヘルパを追加**

`static/app.jsx` の state 宣言群（24-25行付近）に追加：

```javascript
  const [status, setStatus] = useStateApp(null);
  const isoToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useStateApp(isoToday);
```

- [ ] **Step 2: record が selectedDate を送るよう変更**

`static/app.jsx` の `record` 関数（54-62行）を差し替え：

```javascript
  const record = (entry) =>
    fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, date: selectedDate }),
    })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setStatus)
      .catch((err) => console.error("record failed:", err));
```

- [ ] **Step 3: 選択日entriesの導出と addForDay ヘルパを追加**

`static/app.jsx` の `history` 構築ブロック（108-118行）の直後に追加：

```javascript
  // 選択日の entries（今月データは status.month に全て含まれる）
  const selectedEntries =
    (status.month && status.month[selectedDate]) ||
    (selectedDate === isoToday ? todayEntries : []) || [];

  // カレンダーの日(数値) → その日を選択して きろく画面へ
  const addForDay = (day) => {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(iso);
    setScreen("log");
  };
```

- [ ] **Step 4: HomeInput / CalendarScreen に props を渡す**

`static/app.jsx` の `screen === "log"` ブロック（156-163行）を差し替え：

```javascript
        {screen === "log" && (
          <HomeInput
            char={char} entries={selectedEntries}
            onRecord={record} onDelete={del}
            streak={streak} doneDays={doneDays} coins={coins}
            selectedDate={selectedDate} isoToday={isoToday} onChangeDate={setSelectedDate}
            monthStartIso={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`}
          />
        )}
```

`screen === "home"` ブロック（164-171行）の `CalendarScreen` に props 追加：

```javascript
        {screen === "home" && (
          <CalendarScreen
            char={char} history={history} today={todayDay}
            streak={streak} coins={coins}
            monthStartDow={monthStartDow} daysInMonth={daysInMonth}
            monthLabel={monthLabel} monthNum={monthNum}
            onAddForDay={addForDay} onDeleteEntry={del}
          />
        )}
```

- [ ] **Step 5: 手動確認（この時点では HomeInput/Calendar 未対応なので壊れない範囲のみ）**

Run: `cd /Users/SatoTakumi/IdeaProject/kintore-go/.claude/worktrees/other-day-input && make run`
ブラウザ http://localhost:4949 を開き、きろく画面で今日の記録が従来どおり追加・削除できることを確認（selectedDate=今日のため挙動不変）。確認後サーバ停止。

- [ ] **Step 6: コミット**

```bash
git add static/app.jsx
git commit -m "feat: thread selectedDate through app, send date on record

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: homeInput.jsx — 前日/翌日セレクタと選択日対応

**Files:**
- Modify: `static/homeInput.jsx`

**Interfaces:**
- Consumes: Task 2 の props `selectedDate`, `isoToday`, `onChangeDate`, `monthStartIso`, `entries`(選択日分)。
- Produces: 画面表示・記録対象が選択日に追従。`onRecord` は date を含めず `{part, minutes}` のまま（date は app.jsx が付与）。

- [ ] **Step 1: 日付ユーティリティとヘッダーのセレクタ化**

`static/homeInput.jsx` の `HomeInput` シグネチャ（26行）を差し替え：

```javascript
function HomeInput({ char = "guts", entries = [], onRecord, onDelete, streak = 0, doneDays = 0, coins = 0, selectedDate, isoToday, onChangeDate, monthStartIso }) {
```

関数本体の冒頭（`const { Mascot, ... } = window;` の直後）にユーティリティを追加：

```javascript
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
```

- [ ] **Step 2: ヘッダー描画を矢印セレクタに差し替え**

`static/homeInput.jsx` の header ブロック（55-65行の最初の日付表示 div）を差し替え。
旧：

```javascript
        <div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 13, color: "var(--ink)" }}>{dateLabel}</div>
          <div style={{ fontSize: 12, color: "var(--orange-d)" }}>{weekday}</div>
        </div>
```

新：

```javascript
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
```

- [ ] **Step 3: 記録カードの見出しとシート見出しを選択日反映**

`static/homeInput.jsx` の log カード見出し（82行）を差し替え：

```javascript
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 11, color: "var(--ink)" }}>{isToday ? "きょうのきろく" : labelMD + "のきろく"}</div>
```

空状態メッセージ（89行）を差し替え：

```javascript
            <div style={{ fontSize: 14, textAlign: "center" }}>まだ記録がないよ。<br />{isToday ? "きょう" : labelMD} の トレを きろくしよう！</div>
```

入力シートのタイトル（112行）を差し替え：

```javascript
            <div style={{ fontFamily: "'Press Start 2P'", fontSize: 12, color: "var(--ink)", textAlign: "center" }}>{labelMD} は どれくらい うごいた？</div>
```

- [ ] **Step 4: 手動確認**

Run: `cd /Users/SatoTakumi/IdeaProject/kintore-go/.claude/worktrees/other-day-input && make run`
ブラウザで「きろく」タブを開き：
1. ヘッダーの `‹ ›` で前日へ移動でき、見出し・空状態が日付に追従する。
2. 過去日でシートを開き記録 → その日に記録が出る。翌日ボタンで今日に戻ると無効化される。
3. 今月1日では前日ボタンが無効。今日では翌日ボタンが無効。
確認後サーバ停止。

- [ ] **Step 5: コミット**

```bash
git add static/homeInput.jsx
git commit -m "feat: day selector in record screen for logging other days

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: calendar.jsx — 過去日タップ・追加導線・削除

**Files:**
- Modify: `static/calendar.jsx`

**Interfaces:**
- Consumes: Task 2 の props `onAddForDay(day)`, `onDeleteEntry(id)`。既存 `history`, `today`。
- Produces: 過去日(miss)・今日もタップで詳細パネルを開ける。パネルに「＋ この日に きろく」と各記録の削除ボタン。

- [ ] **Step 1: シグネチャに props 追加**

`static/calendar.jsx` の `CalendarScreen` シグネチャ（7行）を差し替え：

```javascript
function CalendarScreen({ char = "guts", history = {}, today = 6, streak = 0, coins = 0, monthStartDow = 1, daysInMonth = 30, monthLabel = "2026 / 6", monthNum = 6, onJumpHome, onAddForDay, onDeleteEntry }) {
```

- [ ] **Step 2: 過去日・今日をタップ可能にする**

`static/calendar.jsx` のセル `<button>` の `onClick` と cursor（64-66行）を差し替え。
旧：

```javascript
              <button key={d} onClick={() => setPicked(isDone || isToday ? d : null)}
                style={{
                  aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: isDone ? "pointer" : "default",
```

新（done / today / miH=過去未記録 をタップ可、未来は不可）：

```javascript
              const tappable = st !== "future";
              return (
              <button key={d} onClick={() => setPicked(tappable ? d : null)}
                style={{
                  aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: tappable ? "pointer" : "default",
```

注意: 既存コードはこの `return (` が `const sel = ...` の後にある。`const tappable` 行は `const sel = picked === d;` の直後に置き、既存の `return (` を上記新ブロックの `return (` に置換すること（二重 return を作らない）。

- [ ] **Step 3: 詳細パネルに追加ボタンと削除ボタン**

`static/calendar.jsx` の詳細パネル内、`pickedEntries.length === 0` の三項（89-101行）を差し替え：

```javascript
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
```

- [ ] **Step 4: 手動確認**

Run: `cd /Users/SatoTakumi/IdeaProject/kintore-go/.claude/worktrees/other-day-input && make run`
ブラウザで「ホーム」タブを開き：
1. 過去の未記録日（薄色）をタップ → 詳細パネルが開き「この日は まだ きろくがないよ」+「＋ この日に きろく」が出る。
2. 「＋ この日に きろく」→ きろく画面がその日で開く。記録 → ホームに戻るとその日が★になる。
3. 記録済み日をタップ → 記録一覧に × が出て削除でき、今月トレ日数/コインが即更新。
4. 未来日はタップしても何も起きない。
確認後サーバ停止。

- [ ] **Step 5: コミット**

```bash
git add static/calendar.jsx
git commit -m "feat: tap past days in calendar to view/add/delete records

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 完了後

全タスク完了後、`make test`（バックエンド）と全導線の手動確認を最終チェックし、`finishing-a-development-branch` でマージ/PRを判断。メモリ方針に従い push まで含めて完了とする。
