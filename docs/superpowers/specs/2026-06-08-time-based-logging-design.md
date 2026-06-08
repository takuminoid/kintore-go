# 時間ベース記録への移行 仕様

_2026-06-08_

## 概要

現状の記録は「種目名（自由入力）が必須」で、記録のたびに文字入力を強いられる。これが手軽さの壁になっている。本変更では **活動時間（分）だけで記録完了**できるようにし、種目名の自由入力を廃止する。部位（胸・腕・脚など）は任意のワンタップ（複数選択可）。継続そのものを評価するため、コインを「1日記録すれば固定」方式に変更する。

---

## データモデル

既存 `entries(id, date, name, amount, unit)` のカラムを意味に合わせて改名する。

```sql
entries(
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  date    TEXT    NOT NULL,   -- "2026-01-02" 形式（変更なし）
  part    TEXT    NOT NULL,   -- 旧 name。部位。任意なので空文字 "" 可。複数部位はカンマ区切り（例 "胸,腕"）
  minutes INTEGER NOT NULL    -- 旧 amount。活動時間（分）
)
-- 旧 unit カラムは廃止
```

`settings` テーブルは変更なし。

### 起動時マイグレーション（冪等）

`initDB` で以下を行う：

1. `entries` が存在しなければ新スキーマで `CREATE TABLE`。
2. 既存の場合、`PRAGMA table_info(entries)` を読み、旧スキーマ（`name` / `unit` カラムが存在）を検出したら：
   - `ALTER TABLE entries RENAME COLUMN name TO part`
   - `ALTER TABLE entries RENAME COLUMN amount TO minutes`
   - `ALTER TABLE entries DROP COLUMN unit`
3. 既に新スキーマ（`part` / `minutes` あり、`unit` なし）なら何もしない。

modernc.org/sqlite は SQLite 3.35+ 相当で `RENAME COLUMN` / `DROP COLUMN` をサポートする。

※既存テストデータの旧 `amount` 値（回・km・kg 等の混在）はそのまま `minutes` として残る。意味的にはズレるが、開発用データのため許容する。

---

## バックエンド変更（main.go）

### Entry 構造体

```go
type Entry struct {
    ID      int64  `json:"id"`
    Date    string `json:"date"`
    Part    string `json:"part"`     // 旧 Name
    Minutes int    `json:"minutes"`  // 旧 Amount（float64 → int）
}
// Unit フィールド削除
```

`buildStatus` / クエリの `SELECT id, date, name, amount, unit` は `SELECT id, date, part, minutes` に置き換える。

### handleAddEntry

- リクエストボディ：`{ part: string, minutes: int }`。
- **name 必須チェックを撤廃**。代わりに `minutes > 0` を検証（0以下は 400 Bad Request）。
- `part` は空文字でも可（未選択で記録できる）。
- INSERT は `(date, part, minutes)`。

### buildStatus

- `Coins = DoneDays * 20`（記録件数ベース → 記録した日数ベース）。
- `TotalSets`（= `COUNT(*)` 総記録件数）はバッジ用に維持。

---

## フロントエンド変更

### 入力シート（homeInput.jsx）

「なにを した？」シートを時間主役に再構成する。

- **時間ステッパー（主役）**：デフォルト **0分**、ステップ ±5分、下限0。記録は `minutes > 0` 必須（0のままでは記録ボタンが効かない／無効表示）。
- **部位チップ（任意・複数選択可）**：`胸 / 背中 / 肩 / 腕 / 脚 / 腹 / 全身 / 有酸素`。タップでトグル選択。選択中の部位はハイライト。自由入力欄（「じゆうに書く」）と `COMMON` プリセットは廃止。`UNITS` トグルも廃止。
- 記録時：選択部位をカンマ区切りで結合し `part` に、`minutes` とともに送信。
- 記録行の表示：右側に `{minutes}分`、左側に部位名（複数は「胸・腕」のように `・` 連結）。部位未選択なら「トレーニング」。
- ログカードの件数ラベル「{n} 種目」→「{n} きろく」。
- 空状態メッセージ「やったことを じぶんで書こう！」→「きょうの トレを きろくしよう！」（種目入力前提の文言を修正）。

### カレンダー（calendar.jsx）

- 行表示 `{e.amount}{e.unit}` → `{e.minutes}分`、種目名 `{e.name}` → 部位（複数は `・` 連結、未選択は「トレーニング」）。
- サマリカード「そう種目数（こ）」→「きろく数（こ）」（値は totalSets のまま）。

### バッジ（badges.jsx）

- 「コツコツ10 / そう種目 10こ」→「そうきろく 10こ」、「やりこみ50 / そう種目 50こ」→「そうきろく 50こ」。判定は totalSets（記録件数）のまま。
- 「コインもち / コイン500まい」：コインが日数×20になるため 25日トレで到達。ゴール・ロジックは変更なし。
- その他バッジ（streak / doneDays 系）は変更なし。

---

## 影響まとめ

| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| 記録の必須入力 | 種目名（文字） | 活動時間（分, >0） |
| 部位 | 自由入力 or プリセット種目 | 任意・複数選択チップ |
| コイン | 記録件数 × 20 | 記録した日数 × 20 |
| DBカラム | name, amount, unit | part, minutes |

## テスト方針（main_test.go）

- 新スキーマでの追加・取得が正しいこと。
- `minutes <= 0` が 400 で拒否されること。
- `part` 空での記録が成功すること。
- 旧スキーマDBを与えたときマイグレーションが走り、データが保持されること（part/minutes に読み替わる）。
- `Coins == DoneDays * 20` になること。
