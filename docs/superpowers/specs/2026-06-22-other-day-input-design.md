# 他の日の入力 — 設計

## 目的

現状は「きろく」が常に**今日**にしか記録できない（バックエンドが `today()` を直書き）。
過去の日（今月の1日〜今日）にもトレーニングを記録・編集できるようにする。
未来の日は対象外（まだやっていない運動のため）。

## スコープ

- 入力可能な範囲：**今月の1日〜今日**。
  - カレンダーが現状「今月のみ」表示（前月/次月ボタンは未実装）のため、入力対象も今月に揃える。
  - これにより必要なデータは既に `status.month` に全て含まれ、追加のAPI往復が不要。
- 入力導線は**2つ**：カレンダーの日タップ、きろく画面の日付セレクタ。

## 変更内容

### 1. バックエンド（main.go）

**`handleAddEntry`**
- リクエストに任意の `date` フィールドを追加：
  ```json
  { "part": "...", "minutes": N, "date": "2026-06-15" }
  ```
- `date` 省略・空なら `today()` にフォールバック。
- 検証：
  - `YYYY-MM-DD` 形式であること（`time.Parse` で確認）。不正形式は 400。
  - **未来でないこと**（`date > today()` は 400）。
- それ以外は現状どおり `INSERT INTO entries (date, part, minutes)`。

**`handleDeleteEntry`**
- 現在の `DELETE WHERE id = ? AND date = ?`（today固定）の日付制約を撤廃し、
  `DELETE WHERE id = ?` に変更。過去日の記録も id だけで削除可能にする。

**変更不要**：`buildStatus` / `calcStreak` / コイン計算。
過去日を追加すると streak・コイン・今月トレ日数は再計算で自然に反映される。

### 2. きろく画面（homeInput.jsx）

- ヘッダーの日付ラベルを**前日/翌日の矢印付き**にする：`‹ 6/15(土) ›`。
  - 翌日ボタン：選択日が**今日**に達したら無効化（未来不可）。
  - 前日ボタン：選択日が**今月1日**で無効化。
- 表示する記録リストと「＋きろくする」の保存先が、選択中の日になる。
- 入力シートのタイトルを選択日反映：「6/15の トレを きろく」。
- 記録カードの見出し：今日なら「きょうのきろく」、それ以外は「6/15のきろく」。
- props追加：`selectedDate`（"YYYY-MM-DD"）, `onChangeDate`, 表示用の日付情報。

### 3. ホーム（カレンダー calendar.jsx）

- **過去の未記録日（miss）と今日もタップ可能**にする（現状は done/today のみ）。未来日は不可のまま。
- タップで開く詳細パネルに以下を追加：
  - **「＋ この日に きろく」ボタン** → きろく画面へ遷移し、その日を選択状態で開く。
  - 各記録に**削除ボタン（×）**。
- props追加：`onAddForDay(day)`, `onDeleteEntry(id)`。

### 4. 画面間連携（app.jsx）

- App に `selectedDate` state を持たせる（既定 = 今日, "YYYY-MM-DD"）。
- HomeInput と CalendarScreen で共有。
- `record(entry)` は `selectedDate` を `date` として送信。
- `del(id)` は変更なし（id だけで削除可能になる）。
- カレンダーの「この日にきろく」→ `setSelectedDate(その日)` + `setScreen("log")`。
- 選択日の entries は `status.month` から導出（今月データは取得済み）。
  画面が「log」になったら、その日のentriesを `history`/`month` から引いて HomeInput に渡す。

## データフロー

```
カレンダー日タップ ─┐
                    ├─> selectedDate ─> record({...,date}) POST
きろく日付セレクタ ─┘                        │
                                              v
                                  /api/entries (date検証)
                                              │
                                              v
                                  buildStatus 再取得
                                              │
                  カレンダー / バッジ / コイン / streak すべて即更新
```

## テスト方針

- `main_test.go` に追加：
  - 過去日付を `date` 付きでPOST → その日に記録され、`done_days` 等に反映される。
  - 未来日付POST → 400。
  - 不正形式 `date` POST → 400（不正形式は400で統一）。
  - 過去日の記録を id で DELETE → 削除される（today制約が無いことの確認）。
  - `date` 省略POST → 今日に記録（既存挙動維持）。
