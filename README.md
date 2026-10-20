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
