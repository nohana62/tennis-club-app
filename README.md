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
- `users/{uid}.passwordChangeRequired`が`true`の利用者は、通常画面より先に専用のパスワード変更画面が表示されます。ログイン直後にFirebase Authのパスワードを変更し、成功後に本人のユーザー文書の変更必須フラグだけを解除します。
- 通常データはすべて`organizations/{organizationId}/...`配下へ保存されます。団体IDが未解決の状態でルートコレクションへフォールバックしません。
- 複数団体に所属する利用者はヘッダーで利用団体を切り替えられます。候補は`users/{uid}.organizationIds`から取得しますが、アクセス時は各団体のactive membershipを必ず再検証します。
- owner/adminは設定画面から`member`または`admin`アカウントを申請できます。memberは既存部員との紐づけが必須です。パスワードは申請へ保存しません。
- ownerだけが設定画面で申請を承認・却下できます。owner承認後もログインアカウントは未作成であり、staging限定管理ツールでの発行が必要です。
- memberは閲覧、自分の出欠、掲示板投稿が中心です。管理データの変更はowner/adminに限定されます。

## Firestore コレクション

| パス | 内容 |
|---|---|
| `users/{uid}` | 利用者プロフィール、既定団体、所属団体ID一覧 |
| `loginIds/{loginId}` | 管理ツール専用のユーザーID予約 |
| `organizations/{organizationId}` | 団体 |
| `organizations/{organizationId}/memberships/{uid}` | 団体内roleと状態 |
| `organizations/{organizationId}/accountRequests/{loginId}` | member/adminアカウント申請とowner承認状態 |
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
npm.cmd run admin:link-owner-organization
```

画面でowner承認された`ownerApproved`申請だけを発行コマンドで処理します。
コマンドの確認語は`PROVISION`です。ユーザーID予約、Firebase Auth、
`users`、`memberships`、申請状態を整合的に更新します。一時パスワードは成功時に一度だけ
端末へ表示されるため、安全な経路で本人へ渡してください。画面やファイルへ保存しないでください。
発行が中断して`provisioning`のまま残った場合は状態を確認し、
`npm.cmd run admin:approve-account-request -- --recover`を実行して追加の`RECOVER`確認を行います。

既存ownerを別のactive団体にもownerとして紐づける場合は
`npm.cmd run admin:link-owner-organization`を使います。確認語は`LINK`です。
既存のowner membershipは再実行しても重複作成せず、owner以外のmembershipがある場合は停止します。

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

`firestore.rules`は団体分離、active状態、初回パスワード変更状態、role、本人ユーザー文書、
アカウント申請、ユーザーID予約のクライアント拒否を強制します。
RulesテストにはJava 21以上が必要です。

管理者権限なしでJavaを用意する場合は、Temurin 21 JREのWindows x64 ZIPを
`%LOCALAPPDATA%\CopilotTools\temurin-jre-21`などのユーザー領域へ展開します。
配布元のSHA-256を照合し、システム全体のPATHは変更せず、テストを実行するPowerShellだけで
`JAVA_HOME`と`PATH`を設定してください。

```powershell
$env:JAVA_HOME = "$env:LOCALAPPDATA\CopilotTools\temurin-jre-21"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm.cmd run test:rules
```

staging用Web設定を使ったビルドも確認します。

```powershell
npm.cmd run build:staging
```

このリポジトリの`firebase.json`にあるFirebaseデプロイ対象はFirestore Rulesだけです。
Firebase FunctionsとFirebase Hostingの定義はありません。Webアプリ本体は
`.github/workflows/deploy.yml`からGitHub Pagesへ公開されます。

stagingへの反映前はFirebase CLIへログインし、対象プロジェクトを目視確認してからdry-runします。

```powershell
.\node_modules\.bin\firebase.cmd login:list
.\node_modules\.bin\firebase.cmd projects:list
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
6. owner/adminはmember/admin申請を作成・閲覧でき、ownerだけが`pending`から`ownerApproved`または`rejected`へ変更できる。
7. adminによる承認、ownerへの権限昇格、申請の団体ID・ログインID・申請者の改ざんは拒否される。
8. `passwordChangeRequired=true`の利用者は団体データを利用できず、本人だけがフラグを`true`から`false`へ変更できる。ほかのユーザー属性は変更できない。

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
