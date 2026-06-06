# kintore-go リデザイン仕様

_2026-06-06_

## 概要

Claude Design で作成したレトロピクセルアートのプロトタイプを、実際に動く kintore-go アプリとして実装する。フロントエンドは React（Babel standalone）、バックエンドは既存の Go + SQLite を拡張する。

---

## データベース

既存の `workouts` テーブルは廃止し、以下2テーブルに置き換える。

```sql
CREATE TABLE entries (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  date    TEXT    NOT NULL,  -- "2026-01-02" 形式
  name    TEXT    NOT NULL,
  amount  REAL    NOT NULL,
  unit    TEXT    NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- settings に ('character', 'guts') などを保存
```

- 「今日やった」= `entries` に今日の日付レコードが1件以上存在する
- ストリーク = 今日から連続して `entries` が存在する日数（Go側で計算）
- バッジのアンロック判定 = フロントエンドで stats から計算（DB不要）

---

## APIエンドポイント

### `GET /api/status`

レスポンス：
```json
{
  "today_done": true,
  "streak": 8,
  "today_entries": [
    { "id": 1, "name": "腕立て伏せ", "amount": 20, "unit": "回" }
  ],
  "month": {
    "2026-06-01": [{ "id": 2, "name": "腹筋", "amount": 30, "unit": "回" }]
  },
  "total_sets": 11,
  "done_days": 6,
  "coins": 340,
  "character": "guts"
}
```

- `month`: 当月の全エントリを日付ごとにグループ化
- `coins`: `entries` 件数 × 20（Go側で計算）
- `character`: `settings` テーブルから取得、未設定なら `"guts"`

### `POST /api/entries`

リクエスト body:
```json
{ "name": "腕立て伏せ", "amount": 20, "unit": "回" }
```

レスポンス: `GET /api/status` と同じ（即座に反映された状態を返す）

### `DELETE /api/entries/{id}`

指定IDのエントリを削除。レスポンス: `GET /api/status` と同じ。

### `POST /api/character`

リクエスト body:
```json
{ "character": "wakaba" }
```

レスポンス: `{ "character": "wakaba" }`

---

## フロントエンド構成

`static/` 以下のファイル構成：

```
static/
  index.html       ← phone枠のHTML（React + Babel + JSXファイル読み込み）
  ui.jsx           ← 共有UIプリミティブ（PixelArt, RetroPanel, RetroButton 等）
  mascots.jsx      ← キャラクターデータ + CharacterSelect コンポーネント
  homeInput.jsx    ← ホーム画面（種目入力・記録リスト）
  calendar.jsx     ← カレンダー画面
  badges.jsx       ← バッジ/実績画面
  app.jsx          ← アプリ全体（状態管理・API接続・ナビゲーション）
```

`ui.jsx` / `mascots.jsx` / `homeInput.jsx` / `calendar.jsx` / `badges.jsx` はプロトタイプからほぼそのままコピー。

### app.jsx の変更点（プロトタイプとの差分）

- **初期化**: アプリ起動時に `GET /api/status` を呼び、実データで状態を初期化
- **record()**: `POST /api/entries` を呼び、レスポンスで状態を更新
- **del()**: `DELETE /api/entries/{id}` を呼び、レスポンスで状態を更新
- **キャラ変更**: `POST /api/character` を呼び、選択を永続化
- **日付**: ハードコードされた `TODAY = 6` を廃止し、`new Date()` で今日の日番号を取得
- **月情報変換**: APIの `month`（`{ "2026-06-01": [...] }` 形式）を `calendar.jsx` が期待する `{ [dayNumber]: [...] }` 形式に変換して渡す
- **monthStartDow**: `new Date(year, month-1, 1).getDay()` でクライアント側計算
- **loading状態**: APIレスポンス待ち中はローディング表示

### homeInput.jsx の変更点

- `onRecord` コールバックは `{ name, amount, unit }` を受け取り、親（app.jsx）がAPIを呼ぶ（現行と同じインターフェース）
- `onDelete` コールバックは `id` を受け取り、親がAPIを呼ぶ（現行と同じ）
- 変更なしでそのまま使える

---

## main.go の変更点

- `workouts` テーブル作成を `entries` + `settings` に変更
- `handleToggle` を削除
- `handleStatus` を新スキーマに対応
- `handleAddEntry` (POST /api/entries) を追加
- `handleDeleteEntry` (DELETE /api/entries/{id}) を追加
- `handleCharacter` (POST /api/character) を追加
- ルーティングを更新

---

## 実装しないもの

- バッジ獲得時のお祝い演出（ファンファーレ）→ プロトタイプにも未実装
- 過去月へのカレンダー移動 → 月ナビボタンは表示するが機能しない（デザインと同じ）
- レベル/経験値バー → ホームのLv表示はハードコード（プロトタイプと同じ）
