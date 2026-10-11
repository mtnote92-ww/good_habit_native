# Good-Habits

習慣化を助けるAndroidアプリです（Capacitor でネイティブアプリ化）。詳しい仕様は [plan.md](plan.md)、表示文言は [content/messages.md](content/messages.md)、デザインは [mockups/](mockups/) を参照してください。

## 動かし方

画面はビルド不要の素のHTML/CSS/JSで、Capacitor で Android アプリとして包んでいます。

```bash
npm install
npm run android:sync   # ルートのソースを www/ に複製し、android/ へ反映
npm run android:open   # Android Studio を開く
npm run android:run    # 接続した端末／エミュレータで実行
```

画面の確認だけなら `python -m http.server 8000` で `http://localhost:8000` を開いても動きます（OS通知は Android 版でのみ動作）。

## ディレクトリ構成

```
index.html          アプリ本体（画面はすべてこの1ファイルの中でJSにより切り替え）
css/style.css         スタイル一式（2テーマ：classic / modern）
js/
  content.js          メッセージ・称賛コメント・コース定義（content/messages.md と同期させること）
  badges.js            バッジ定義と獲得条件
  icons.js             インラインSVGアイコン集
  storage.js           localStorage への保存・読み込み
  logic.js             ロールオーバー・達成判定・ヒートマップ集計などのコアロジック
  ui.js                 画面描画
  app.js                起動・画面遷移・イベント配線
assets/                アプリアイコン・スプラッシュの元画像（@capacitor/assets で android/ に展開）
android/               Capacitor が生成した Android プロジェクト
scripts/               www/ への複製・フォント更新・アイコン生成のスクリプト
store/                 Google Play 掲載情報の下書きと画像
privacy-policy.html    プライバシーポリシー（GitHub Pages で公開）
content/messages.md    表示文言の一覧（企画ドキュメント）
mockups/               デザインモックアップ（Claude Design由来の.dc.html＋閲覧用gallery.html）
```

## 実装済みの機能（plan.md 対応）

- 習慣の登録（4段階の日数コース：21日／90日／180日／テスト用1日）
- 達成延べ日数のカウントダウンと、連続達成ストリークの表示
- 設定した時刻（0〜4時）での日次リストの更新（未達成のToDoを新しい日として再表示、ストリークが途切れた場合はリセット）
- 時間帯別メッセージのランダム表示（全21パターン）＋達成時の称賛コメント（3パターン）
- 目標日数達成時の花火風演出＋対象ToDoの自動削除
- バッジ／実績システム（ストリーク系・コース達成系・行動系・コンプリートの4カテゴリ、バッジ詳細画面で進捗を確認可能）
- 達成カレンダー（月表示のヒートマップ、最長ストリーク・当月達成率の集計）
- テーマ切り替え（ネイビー×ゴールド／グレー×ブルー）
- 前日に未達成の習慣があった場合のアプリ内バナー通知と、当日10時・12時・21時のOS通知
- データのバックアップ（設定画面からJSONの書き出し／クリップボードコピー／ファイル・テキストからの復元）

エンドユーザー向けの使い方は [how_to_use.md](how_to_use.md) を参照してください。

## 既知の制約

- 通知は `@capacitor/local-notifications` によるサーバー不要のローカル通知で、前日にサボった習慣があった場合は当日の10時・12時・21時（既に過ぎた時刻を除く）に「昨日はお疲れさまでした。「〈未達成だった習慣名〉」が未達成でしたが、今日再開すれば習慣化につながります！」という通知を表示します（習慣名は登録内容に応じて自動で挿入、最大2件・3件以上は「など」で省略）。「一定時間無操作でのリマインド」は実効性が乏しいため引き続き未実装です。
- **データは端末内保存のみ**：アプリのデータを消去すると記録も消えます。機種変更やデータ消去に備えて、設定画面のバックアップ機能で定期的にJSONを書き出してください（手順は [how_to_use.md](how_to_use.md)）。自動同期は行いません。
- アプリアイコン・スプラッシュの元画像（`assets/`）は `scripts/gen_icon.py`（Pillow使用）で書き出しています。デザインを変更したら `cd scripts && python gen_icon.py` → `npx capacitor-assets generate` で再生成してください。
