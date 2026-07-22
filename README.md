# MVP Voting App

イベント会場でMVP候補者への投票、管理、順位発表を行うためのWebアプリです。

管理者はイベント作成、候補者登録、投票受付、集計、発表操作を行えます。参加者はスマートフォンから投票し、発表画面は会場スクリーン共有向けにリアルタイム更新されます。

## 主な機能

- 管理者パスワードによるログイン
- イベント作成、編集、削除
- 候補者の単体登録、一括登録、編集、削除
- 候補者画像URLの登録
- 候補者上限50名
- 1人あたり複数MVP候補者への投票
- 投票受付、締切、順位確定
- 同票時の順位調整
- 投票一覧と集計結果のCSV出力
- QRコード表示用の別画面
- 発表画面のリアルタイム反映
- イベント初期化、投票結果リセット、イベント削除
- AWS ECSデプロイ準備

## 技術構成

- Vinext
- Next.js App Router
- React
- TypeScript
- JSON file storage under `data/events`
- Docker
- AWS ECS Fargate deployment template

## 必要環境

- Node.js `>=22.13.0`
- npm

Windows PowerShellでは `npm` が実行ポリシーでブロックされる場合があるため、基本的に `npm.cmd` を使います。

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

管理者パスワードのデフォルトは次です。

```text
preview
```

本番環境では環境変数で変更してください。

```text
ADMIN_PASSWORD=任意の管理者パスワード
```

デモイベントの参加パスワードは次です。

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

`npm.cmd test` はビルド後にAPIと主要な画面レンダリングを検証します。

## データ保存

イベント、候補者、投票データはローカルでは次に保存されます。

```text
data/events
```

`data/` はGit管理対象外です。本番ではコンテナ内ローカル保存にせず、EFSなどの永続ボリュームを `/app/data` にマウントしてください。

## 主要画面

- `/admin`: 管理画面
- `/admin/:eventId`: イベント管理詳細
- `/vote/:eventId`: 投票者画面
- `/presentation/:eventId`: 発表画面
- `/qr/:eventId`: QRコード表示画面
- `/api/health`: ヘルスチェック

## AWSデプロイ

AWS向けの最小構成は次を想定しています。

- Amazon ECR
- Amazon ECS Fargate
- Amazon EFS
- Application Load Balancer
- AWS Systems Manager Parameter Store
- CloudWatch Logs
- GitHub Actions

追加済みのAWS関連ファイル:

- `Dockerfile`
- `.dockerignore`
- `aws/ecs-task-definition.json`
- `.github/workflows/deploy-aws.yml`
- `docs/aws-deploy.md`

詳細手順は [docs/aws-deploy.md](docs/aws-deploy.md) を参照してください。

## GitHub Actions

AWSデプロイ用ワークフローは手動実行のみ有効です。

```text
Actions > Deploy to AWS ECS > Run workflow
```

AWS側のECR、ECS、EFS、IAM、SSM Parameter Storeを作成してから実行してください。

必要なGitHub Secret:

```text
AWS_ROLE_TO_ASSUME
```

## Dockerローカル確認

```powershell
docker build -t mvp-voting-app .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" -e ADMIN_PASSWORD=preview mvp-voting-app
```

確認URL:

```text
http://localhost:3000/admin
```

## 注意事項

- Slackなど認証が必要な画像URLは、投票画面や発表画面で表示できない場合があります。
- 壊れたイベントJSONが混ざっていても一覧全体は落ちないようにしていますが、対象イベントは修復または再作成してください。
- 開発環境では日本語を含むOneDriveパスでCloudflare/Vite pluginが不安定になることがあるため、devサーバー時はCloudflare pluginを外しています。
- 本番公開時はALBまたはCloudFrontでHTTPS化してください。
