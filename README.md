# テニス部管理アプリ

会社テニス部向けの PWA（Progressive Web App）管理システム。PC・iPhone・Android 全てのブラウザで動作し、インストール不要で使えます。

## 機能

| 機能 | 概要 |
|------|------|
| スケジュール管理 | 練習・試合のカレンダー登録・編集・削除 |
| 参加者管理 | 部員マスタ管理、イベントごとの参加/欠席登録・参加率集計 |
| 経費計算 | カテゴリ別経費入力、月別集計、按分計算 |
| 報告書作成 | 月次報告の PDF / Excel ダウンロード |
| LINE 通知 | イベント追加・変更時に LINE グループへ自動通知 |
| Teams 通知 | イベント追加・変更時に Microsoft Teams へ自動通知 |

## 技術スタック

- React 19 + TypeScript + Vite + Tailwind CSS
- Firebase Authentication + Firestore
- vite-plugin-pwa (Service Worker + Web App Manifest)
- jsPDF + jsPDF-AutoTable (PDF出力)
- SheetJS / xlsx (Excel出力)
- LINE Messaging API / Teams Incoming Webhook

## セットアップ

### 1. Firebase プロジェクトの作成

1. https://console.firebase.google.com/ でプロジェクト作成
2. Firestore Database を有効化
3. ウェブアプリを追加して設定値を取得

### 2. 環境変数の設定

.env.example をコピーして .env.local を作成：

  cp .env.example .env.local

必要な値を入力してください。

### 3. ローカル開発サーバー起動

  npm install
  npm run dev

### 4. ビルド

  npm run build

公開は`.github/workflows/deploy.yml`からGitHub Pagesへ行います。

## 複数団体とログイン

- ログインには管理者が発行したユーザーIDと一時パスワードを使います。
- `users/{uid}.passwordChangeRequired`が`true`の利用者は、通常画面より先に専用のパスワード変更画面が表示されます。
- 通常データはすべて`organizations/{organizationId}/...`配下へ保存されます。団体IDが未解決の状態でルートコレクションへフォールバックしません。
- owner/adminは設定画面から一般利用者アカウントを申請できます。申請にパスワードは保存されず、roleは常に`member`です。
- memberは閲覧、自分の出欠、掲示板投稿が中心です。管理データの変更はowner/adminに限定されます。

## Firestore コレクション

| パス | 内容 |
|---|---|
| `users/{uid}` | 利用者プロフィールと既定団体 |
| `loginIds/{loginId}` | 管理ツール専用のユーザーID予約 |
| `organizations/{organizationId}` | 団体 |
| `organizations/{organizationId}/memberships/{uid}` | 団体内roleと状態 |
| `organizations/{organizationId}/accountRequests/{loginId}` | 一般利用者アカウント申請 |
| `organizations/{organizationId}/events/{id}` | イベント |
| `organizations/{organizationId}/members/{id}` | 部員 |
| `organizations/{organizationId}/attendances/{id}` | 参加/欠席 |
| `organizations/{organizationId}/doublesSchedules/{eventId}` | 組み合わせ |
| `organizations/{organizationId}/expenses/{id}` | 経費 |
| `organizations/{organizationId}/settings/appConfig` | 団体設定 |
| `organizations/{organizationId}/posts/{id}` | 掲示板 |

## staging管理手順

管理スクリプトはサービスアカウントの`project_id`が
`tennis-club-app-staging`と完全一致しない限り停止します。
`tennis-club-app-cb7d2`では実行しないでください。

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\安全な場所\staging-service-account.json"
npm.cmd run admin:check
npm.cmd run admin:list-account-requests
npm.cmd run admin:approve-account-request
```

承認コマンドはpending申請だけを処理し、ユーザーID予約、Firebase Auth、
`users`、`memberships`、申請状態を更新します。一時パスワードは成功時に一度だけ
端末へ表示されるため、安全な経路で本人へ渡してください。画面やファイルへ保存しないでください。

### 既存ルートデータの移行

最初は必ずdry-runで件数と競合を確認します。

```powershell
npm.cmd run admin:migrate-root-data -- --organization=<団体ID>
```

コピーする場合だけ、団体IDを含む確認値を明示します。

```powershell
npm.cmd run admin:migrate-root-data -- --organization=<団体ID> --apply --confirm=COPY_TO_<団体ID>
```

同一文書は再実行時にスキップされ、内容が異なる移行先文書がある場合は上書きせず停止します。
コピー後の全件照合に成功しても、元データは既定で保持されます。削除が必要な場合のみ、
十分なバックアップと停止時間を確保したうえで、さらに
`--delete-source --delete-confirm=DELETE_ROOT_DATA_<団体ID>`を指定します。

### Firestore Security Rules

`firestore.rules`は団体分離、active状態、role、本人ユーザー文書、
アカウント申請、ユーザーID予約のクライアント拒否を強制します。
RulesテストにはJava 21以上が必要です。

```powershell
npm.cmd run test:rules
```

stagingへの反映前は必ずdry-runし、対象プロジェクト名を目視確認します。

```powershell
.\node_modules\.bin\firebase.cmd deploy --only firestore:rules --project tennis-club-app-staging --dry-run
```

dry-runに成功した後、承認された作業時だけ同じコマンドから`--dry-run`を外します。
本番`tennis-club-app-cb7d2`へこのRulesをデプロイしないでください。

### 権限分離の確認項目

1. 団体Aのowner/adminが団体Aの管理データを作成・変更できる。
2. 団体Aのmemberは閲覧、自分の出欠、本人名義の投稿のみ行える。
3. 団体Aの利用者は団体Bの文書を読み書きできない。
4. `users`または`memberships`が`suspended`の利用者は団体データを読み書きできない。
5. クライアントから`loginIds`を読み書きできない。
6. owner/adminはmember固定のpending申請を作成・閲覧できるが、クライアントから承認できない。
7. 利用者本人は初回パスワード変更時に`passwordChangeRequired`を`true`から`false`へ変更できるが、既定団体、status、roleは変更できない。

上記は`scripts/firestore-rules.test.ts`でも2団体とrole差を使って検証します。

## Firestoreのローカルバックアップ

Sparkプラン向けの読み取り専用バックアップです。本番データや接続情報をGitHubへ追加しないでください。

1. PowerShellで`Copy-Item .env.backup.example .env.backup.local`を実行し、FirebaseコンソールのWebアプリ設定を入力します。
2. `.env.backup.local`の`VITE_FIREBASE_PROJECT_ID`が`tennis-club-app-cb7d2`であることを確認します。
3. Firebaseへ接続しない設定検査を実行します。

```powershell
npm.cmd run backup:check
```

4. 設定検査が成功したら、バックアップを実行します。

```powershell
npm.cmd run backup -- --project=tennis-club-app-cb7d2
```

成功すると、`backups`フォルダへ日時付きJSONとSHA-256ファイルが作成されます。バックアップには個人情報や`settings/appConfig`の通知資格情報が含まれる可能性があるため、会社管理の暗号化済み保存先で保管してください。

5. 最新バックアップの形式、件数、SHA-256を確認します。

```powershell
npm.cmd run backup:verify
```

このバックアップにはFirebase Authentication、Firestore Security Rules、Indexes、App Check設定は含まれません。

## PWA インストール方法

iPhone (Safari): 共有ボタン → ホーム画面に追加
Android (Chrome): アドレスバー右のインストールアイコン
