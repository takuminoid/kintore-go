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
	ID      int64  `json:"id"`
	Date    string `json:"date"`
	Part    string `json:"part"`
	Minutes int    `json:"minutes"`
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
	Onboarded    bool               `json:"onboarded"`
}

func initDB() {
	var err error
	db, err = sql.Open("sqlite", "./kintore.db")
	if err != nil {
		log.Fatal(err)
	}
	db.Exec("PRAGMA journal_mode=WAL")
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
}

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
	now := time.Now().In(time.Local)
	expected := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	for rows.Next() {
		var d string
		rows.Scan(&d)
		t, _ := time.ParseInLocation("2006-01-02", d, time.Local)
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

	if todayRows, err := db.Query(
		"SELECT id, date, part, CAST(minutes AS INTEGER) FROM entries WHERE date = ? ORDER BY id", t); err == nil {
		defer todayRows.Close()
		for todayRows.Next() {
			var e Entry
			todayRows.Scan(&e.ID, &e.Date, &e.Part, &e.Minutes)
			resp.TodayEntries = append(resp.TodayEntries, e)
		}
	}
	if resp.TodayEntries == nil {
		resp.TodayEntries = []Entry{}
	}
	resp.TodayDone = len(resp.TodayEntries) > 0
	resp.Streak = calcStreak()

	now := time.Now()
	firstDay := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	lastDay := firstDay.AddDate(0, 1, -1)
	resp.Month = make(map[string][]Entry)
	doneDates := make(map[string]bool)
	if mRows, err := db.Query(
		"SELECT id, date, part, CAST(minutes AS INTEGER) FROM entries WHERE date >= ? AND date <= ? ORDER BY date, id",
		firstDay.Format("2006-01-02"), lastDay.Format("2006-01-02"),
	); err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var e Entry
			mRows.Scan(&e.ID, &e.Date, &e.Part, &e.Minutes)
			resp.Month[e.Date] = append(resp.Month[e.Date], e)
			doneDates[e.Date] = true
		}
	}

	db.QueryRow("SELECT COUNT(*) FROM entries").Scan(&resp.TotalSets)
	resp.DoneDays = len(doneDates)
	// Coins reward recorded days all-time (not just this month's doneDates), 20 each.
	var recordedDays int
	db.QueryRow("SELECT COUNT(DISTINCT date) FROM entries").Scan(&recordedDays)
	resp.Coins = recordedDays * 20
	resp.Character = getCharacter()
	db.QueryRow("SELECT EXISTS(SELECT 1 FROM settings WHERE key='character')").Scan(&resp.Onboarded)
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
		Part    string `json:"part"`
		Minutes int    `json:"minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Minutes <= 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	db.Exec("INSERT INTO entries (date, part, minutes) VALUES (?, ?, ?)",
		today(), strings.TrimSpace(req.Part), req.Minutes)
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
	db.Exec("DELETE FROM entries WHERE id = ? AND date = ?", id, today())
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

	log.Println("Listening on http://localhost:4949")
	log.Fatal(http.ListenAndServe(":4949", mux))
}
