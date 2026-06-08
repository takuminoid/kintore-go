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

func TestHandleDeleteEntry(t *testing.T) {
	clearDB(t)
	body := bytes.NewBufferString(`{"part":"脚","minutes":30}`)
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

func TestHandleAddEntry_RejectsNonPositiveMinutes(t *testing.T) {
	clearDB(t)
	for _, mins := range []string{"0", "-1"} {
		body := bytes.NewBufferString(`{"part":"胸","minutes":` + mins + `}`)
		req := httptest.NewRequest("POST", "/api/entries", body)
		rr := httptest.NewRecorder()
		handleAddEntry(rr, req)
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("want 400 for minutes=%s, got %d", mins, rr.Code)
		}
	}
}

// part is optional; NOT NULL forbids SQL null, but empty string is valid.
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
