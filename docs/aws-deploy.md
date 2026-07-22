# AWS デプロイ準備メモ

## 推奨構成

このアプリは `data/events` にJSONファイルでイベント・候補者・投票データを保存します。
AWSではコンテナ再起動でローカルファイルが消えないように、まずは次の構成を推奨します。

- Amazon ECR: Dockerイメージ置き場
- Amazon ECS Fargate: アプリ実行
- Amazon EFS: `/app/data` の永続化
- Application Load Balancer: HTTPS公開
- AWS Systems Manager Parameter Store: `ADMIN_PASSWORD` の保存
- CloudWatch Logs: アプリログ
- GitHub Actions: ECR push と ECS deploy

## GitHub は必要？

手動デプロイだけなら必須ではありません。
ただし、AWSへ継続的に更新するならGitHub登録を推奨します。

GitHubを使うと、`main` ブランチへpushしたタイミングで次の流れを自動化できます。

1. Dockerイメージをビルド
2. ECRへpush
3. ECSタスク定義を更新
4. ECSサービスへデプロイ

## 追加済みファイル

- `Dockerfile`
- `.dockerignore`
- `app/api/health/route.ts`
- `aws/ecs-task-definition.json`
- `.github/workflows/deploy-aws.yml`

## AWS 側で作るもの

### 1. ECR

リポジトリ名:

```text
mvp-voting-app
```

### 2. EFS

ECSタスクからマウントできるEFSを作成します。
タスク定義では次の場所にマウントします。

```text
/app/data
```

### 3. SSM Parameter Store

管理者パスワードをSecureStringで作成します。

```text
/mvp-voting-app/admin-password
```

アプリは環境変数 `ADMIN_PASSWORD` として読み込みます。

### 4. ECS

クラスター名:

```text
mvp-voting-app
```

サービス名:

```text
mvp-voting-app
```

コンテナポート:

```text
3000
```

ALBヘルスチェック:

```text
/api/health
```

### 5. IAM

GitHub Actions用にOIDC連携ロールを作成し、GitHub SecretsにARNを登録します。

```text
AWS_ROLE_TO_ASSUME
```

ECSタスク実行ロールには、少なくとも次が必要です。

- ECR pull
- CloudWatch Logs write
- SSM Parameter Store read
- EFS mount

## タスク定義テンプレートの置換

`aws/ecs-task-definition.json` の次のプレースホルダーをAWS環境に合わせて置換します。

- `<AWS_ACCOUNT_ID>`
- `<AWS_REGION>`
- `<EFS_FILE_SYSTEM_ID>`

デフォルトリージョンはGitHub Actions側で `ap-northeast-1` にしています。

## ローカル確認

```bash
npm.cmd test
docker build -t mvp-voting-app .
docker run --rm -p 3000:3000 -v "%cd%/data:/app/data" -e ADMIN_PASSWORD=preview mvp-voting-app
```

確認URL:

```text
http://localhost:3000/admin
```

## 注意点

- `data/` は `.gitignore` と `.dockerignore` で除外しています。本番データはEFSに保存します。
- 画像URLにSlackなど認証が必要なURLを使うと、参加者や発表画面で表示できない場合があります。
- 本番公開時はALBまたはCloudFrontでHTTPS化してください。
