# 沖縄新婚旅行 旅程表

GitHub Pages で公開しているスマホ向け旅程ページ。
旅程データは合言葉で暗号化（PBKDF2 + AES-256-GCM）した `data/itinerary.enc.json` だけをコミットしている。
平文の `private/itinerary.json` は手元だけ（`.gitignore` 済み）。

## 旅程を更新する

```bash
# 1) 平文を編集
$EDITOR private/itinerary.json

# 2) 暗号化（合言葉を聞かれる。環境変数 ITINERARY_PASS でも可）
node tools/crypt.mjs encrypt

# 3) ローカル確認（fetch を使うので http 経由で開く）
python3 -m http.server 8765   # → http://127.0.0.1:8765/

# 4) 反映
git add -A && git commit -m "update itinerary" && git push
```

平文を無くしたときは `node tools/crypt.mjs decrypt` で `data/itinerary.enc.json` から復元できる。
合言葉を変えたいときは、新しい合言葉で `encrypt` し直して push するだけ。

## データ形式（`private/itinerary.json`）

- `days[]`: 日ごとのカード。`date`(YYYY-MM-DD) / `theme` / `emoji` / `color` / `image`(任意、`img/xxx.jpg` など) / `stay` / `items[]` / `notes[]`
- `items[]`: `time` / `title` / `status` / `note`(任意) / `map`(任意: Google マップ検索語)
- `status`: `confirmed`(確定) / `tentative`(案・未確定) / `check`(要確認) / `info`(バッジなし)
- `open[]`: ページ末尾の「未確定事項」

## 画面の挙動

- 合言葉は端末に記憶できる（「ロックする」で消去）
- 日本時間の今日の日付のカードを強調し、開いたときにそこへスクロール
- 過去の日は薄く表示

## 出発時刻で組み直す日（`planner`）

`days[].planner` があると、その日は `items` の代わりに出発時刻のボタンが出て、押すたびに予定を計算し直す（計算は `planner.js`）。

- `options`: 選べる出発時刻。`default` は最初に選ばれている時刻（選んだ値は端末に記憶）
- `head`: 出発前の固定予定 / `tail`: 最後に付ける注意など
- `stops[]`: 順番に回る場所。`stay`(滞在分) / `latest`(遅くともこの時刻に着く) / `optional`(削ってよい) / `score`(残したい度合い。大きいほど優先) / `why`(削るときの理由)
- `legs`: `"出発地id>到着地id": [分, "距離"]`。削った場合の経路（例: `bios>shrimp`）も必要
- 任意の立ち寄り先の組み合わせを全部試し、`latest` を満たす中で `score` 合計が最大のものを表示する
