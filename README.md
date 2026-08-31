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

- React 18 + TypeScript + Vite + Tailwind CSS
- Firebase Firestore + Hosting
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

### 4. 本番ビルド & Firebase Hosting デプロイ

  npm run build
  npm install -g firebase-tools
  firebase login
  firebase init hosting
  firebase deploy

## Firestore コレクション

| コレクション | 内容 |
|---|---|
| events | イベント情報 |
| members | 部員情報 |
| attendances | 参加/欠席記録 |
| expenses | 経費記録 |

## PWA インストール方法

iPhone (Safari): 共有ボタン → ホーム画面に追加
Android (Chrome): アドレスバー右のインストールアイコン
