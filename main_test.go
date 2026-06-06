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
