# MVP Voting App

イベント会場で MVP 候補者への投票、管理、順位発表を行うための Web アプリです。
管理者はイベント作成、候補者登録、投票受付、集計、発表操作を行えます。参加者はスマートフォンから投票でき、発表画面は会場スクリーン共有向けにリアルタイム更新されます。

## 主な機能

- 管理者パスワードによるログイン
- イベント作成、編集、削除
- 候補者の個別登録、一括登録、編集、削除
- 候補者画像 URL の登録、または画像アップロード
- 候補者は最大 50 名
- 1 人あたり複数名の MVP 候補者へ投票
- 投票受付、締切、順位確定
- 同票時の順位調整
- 投票一覧と集計結果の CSV 出力
- QR コード表示用の別画面
- 発表画面のリアルタイム反映
- イベント初期化、投票結果リセット、イベント削除
- Docker / AWS ECS Fargate デプロイ対応

## 技術構成

- Vinext
- Next.js App Router
- React
- TypeScript
- JSON file storage under `data/events`
- Docker
- AWS CloudFormation
- Amazon ECS Fargate / ECR / EFS / ALB

## 必要環境

- Node.js `>=22.13.0`
- npm

Windows PowerShell では `npm` が実行ポリシーでブロックされる場合があるため、基本的に `npm.cmd` を使います。

## ローカル起動

```powershell
npm.cmd install
npm.cmd run dev -- --host localhost --port 5173
```

アクセス先:

```text
http://localhost:5173/admin
```

トップ `/` は管理画面 `/admin` へリダイレクトします。

## ログイン情報

管理者パスワードのデフォルト:

```text
preview
```

本番環境では環境変数で変更してください。

```text
ADMIN_PASSWORD=任意の管理者パスワード
```

デモイベントの参加パスワード:

```text
mvp2026
```

## よく使うコマンド

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd test
npm.cmd run lint
```

`npm.cmd test` はビルド後に API と主要画面レンダリングを検証します。

## データ保存

イベント、候補者、投票データはローカルでは次に保存されます。

```text
data/events
```

`data/` は Git 管理外です。本番では EFS などの永続ボリュームを `/app/data` にマウントしてください。

## 主な画面

- `/admin`: 管理画面
- `/admin/:eventId`: イベント管理詳細
- `/vote/:eventId`: 投票者画面
- `/presentation/:eventId`: 発表画面
- `/qr/:eventId`: QR コード表示画面
- `/api/health`: ヘルスチェック

## AWS デプロイ

AWS 側のリソースは CloudFormation で作成し、アプリのデプロイは PowerShell CLI スクリプトで行います。GitHub Actions は使いません。

主な追加ファイル:

- `Dockerfile`
- `.dockerignore`
- `infra/cloudformation/mvp-voting-app.yml`
- `scripts/deploy-aws.ps1`
- `docs/aws-deploy.md`

手順の詳細は [docs/aws-deploy.md](docs/aws-deploy.md) を参照してください。

大まかな流れ:

1. AWS CLI でログイン
2. `infra/cloudformation/mvp-voting-app.yml` を CloudFormation にデプロイ
3. `scripts/deploy-aws.ps1` で Docker build / ECR push / ECS 更新を実行
4. CloudFormation の出力 `AppUrl` にアクセス

CLI デプロイ:

```powershell
.\scripts\deploy-aws.ps1
```

## Docker ローカル確認

```powershell
docker build -t mvp-voting-app .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" -e ADMIN_PASSWORD=preview mvp-voting-app
```

確認 URL:

```text
http://localhost:3000/admin
```

## 注意事項

- Slack など認証が必要な画像 URL は、投票画面や発表画面で表示できない場合があります。
- 壊れたイベント JSON が混ざっていても一覧全体は落ちないようにしていますが、対象イベントは修復または再作成してください。
- 開発環境では日本語を含む OneDrive パスで Cloudflare/Vite plugin が不安定になることがあるため、dev サーバー時は Cloudflare plugin を外しています。
- 現在の CloudFormation テンプレートは HTTP 公開です。本番公開時は ALB または CloudFront で HTTPS 化してください。
