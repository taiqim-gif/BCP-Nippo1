# 動作確認の手順と連動チェック

## 目次
- 確認用の環境を作る
- jsdomの使い方（必要な代役）
- 毎回の確認
- 連動チェック（新しい機能を足したとき）
- 確認できないこと

## 確認用の環境を作る

`/home/claude/` は会話ごとに消えるので、毎回作り直す。

```bash
mkdir -p /home/claude/t && cd /home/claude/t
npm init -y >/dev/null 2>&1
npm install jsdom iconv-lite >/dev/null 2>&1   # iconv-lite は、Shift_JISのCSVを試すときだけ
```

構文の確認は、`<script>` の中身を取り出して `new Function(中身)` に渡す。エラーが出なければよい。

## jsdomの使い方（必要な代役）

`new JSDOM(html, { runScripts:"dangerously", virtualConsole, url:"https://example.github.io/app/", beforeParse(w){ ... } })` で読み込み、`beforeParse` の中で次の代役を入れる。

| 必要なもの | 代役 |
| --- | --- |
| スクロール | `w.scrollTo = () => {}`、`w.scrollBy = () => {}` |
| 確認ダイアログ | `w.confirm = () => true` |
| 暗号 | `Object.defineProperty(w, "crypto", { value: globalThis.crypto })`、`w.TextEncoder = TextEncoder`、`w.TextDecoder = TextDecoder` |
| 位置情報 | `navigator.geolocation.getCurrentPosition` を、呼ぶたびに少しずつ違う座標を返す関数にする（出発・帰社・開始・終了を見分けるため） |
| クリップボード | `navigator.clipboard.writeText` を、受け取った文字を記録する関数にする |
| 通信 | `w.fetch` を、ファイル名ごとに応答を返す関数にする |
| ドラッグの位置 | `Element.prototype.getBoundingClientRect` を、`.todo-item` の並び順から高さを計算する関数にする |
| 「その日の最初」の判定 | `localStorage.setItem("appLastOpenDate", 今日)` を入れると、ホームから始まる |

- `virtualConsole` の `jsdomError` を集めて、エラーを調べる。メールアプリを開く操作（`mailto:`）は、jsdomでは「Not implemented: navigation」になる。これは正常なので無視する。
- メールの本文は、`window.buildReportMail().body` で取り出して調べる。
- クリックは `el.dispatchEvent(new w.Event("click"))`。ドラッグは `pointerdown` を「≡」に、`pointermove` と `pointerup` を `window` に送る。
- 変更イベントを送る前に、`checked` を設定する。順番が逆だと、完了の処理が先に動いて、要素が消える。
- 古いデータの形での起動も、`localStorage` に入れて試す（`customerMaster` など）。

## 毎回の確認

1. 構文エラーがない。起動時の `jsdomError` がない。
2. 直した機能が、想定どおりに動く。
3. 暗号のコードを触ったときは、アプリとツールのコードが一致する（`CRYPTO-BEGIN` から `CRYPTO-END` までを取り出して比べる）。往復（暗号化→復号）、違うキー、改ざんも試す。
4. 次の「連動チェック」を通す。

## 連動チェック（新しい機能を足したとき）

足した機能が、次のどれにも関わらないかを、1つずつ確かめる。

- 削除：「全データを削除」と「TODOを残して削除」で、新しいデータはどうなるか。客先名リストの扱い。
- メール：日報メールに入れるべきか。入れるなら、既存の行の並びを変えず末尾に足す。位置、顧客コード、TODOの並び。
- 表示場所：同じものを出す画面が、複数ないか（TODOは3か所）。
- 並び順：新しい順か、手動の順か。メールと画面で合っているか。
- 保存：保存の名前や形を変えるなら、古い形式から自動で引き継ぐ。
- 編集：履歴の編集・削除、時刻の修正でも、新しい項目が扱われるか。
- 客先名リスト：複数の担当、同名の客先、顧客コードの付与。ツールとアプリの両方。
- 初回の表示ルール：その日の最初は車両、2回目以降はホーム。
- 文書：仕様書、要件定義書、取扱説明書の、どこを直すか。
- 過去の決定：`project-state.md` の「動作のルール」と矛盾しないか。

## 確認できないこと

次は、この環境では確かめられないので、渡すときに「未確認」と書く。

- iPhone実機でのダイヤルや「≡」の操作（ページが動かないか）
- メールアプリの起動（本文が長いときを含む）
- ファイルアプリ・OneDriveからのファイルの取り込み
- アプリの更新やアドレスの変更でデータが残るか
