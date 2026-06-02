package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func initDB() {
	var err error
	db, err = sql.Open("sqlite", "./kintore.db")
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS workouts (
		date TEXT PRIMARY KEY
	)`)
	if err != nil {
		log.Fatal(err)
	}
}

func today() string {
	return time.Now().Format("2006-01-02")
}

func handleToggle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	date := today()
	var exists bool
	db.QueryRow("SELECT EXISTS(SELECT 1 FROM workouts WHERE date=?)", date).Scan(&exists)
	if exists {
		db.Exec("DELETE FROM workouts WHERE date=?", date)
	} else {
		db.Exec("INSERT INTO workouts(date) VALUES(?)", date)
	}
	handleStatus(w, r)
}

type StatusResponse struct {
	TodayDone bool     `json:"today_done"`
	Streak    int      `json:"streak"`
	Month     []string `json:"month"`
	Total     int      `json:"total"`
}

func calcStreak() int {
	rows, err := db.Query("SELECT date FROM workouts ORDER BY date DESC")
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

func handleStatus(w http.ResponseWriter, r *http.Request) {
	var resp StatusResponse

	db.QueryRow("SELECT EXISTS(SELECT 1 FROM workouts WHERE date=?)", today()).Scan(&resp.TodayDone)
	resp.Streak = calcStreak()
	db.QueryRow("SELECT COUNT(*) FROM workouts").Scan(&resp.Total)

	now := time.Now()
	firstDay := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	lastDay := firstDay.AddDate(0, 1, -1)
	rows, _ := db.Query(
		"SELECT date FROM workouts WHERE date >= ? AND date <= ?",
		firstDay.Format("2006-01-02"),
		lastDay.Format("2006-01-02"),
	)
	defer rows.Close()
	for rows.Next() {
		var d string
		rows.Scan(&d)
		resp.Month = append(resp.Month, d)
	}
	if resp.Month == nil {
		resp.Month = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func main() {
	initDB()
	defer db.Close()

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./static")))
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/toggle", handleToggle)

	log.Println("Listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
