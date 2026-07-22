# AWS CLI デプロイ手順

このアプリは CloudFormation で AWS 側の土台を作り、PowerShell スクリプトで Docker イメージを ECS Fargate にデプロイします。GitHub Actions は使いません。

## 作成される主なリソース

- Amazon ECR: Docker イメージ置き場
- Amazon ECS Fargate: アプリ実行環境
- Amazon EFS: `/app/data` の永続化
- Application Load Balancer: 外部公開
- AWS Systems Manager Parameter Store: 管理者パスワード
- CloudWatch Logs: アプリログ

## 事前準備

必要なもの:

- AWS CLI
- Docker Desktop
- Node.js / npm

AWS CLI でログインします。SSO の場合:

```powershell
aws configure sso
aws sso login --profile your-profile
```

通常のアクセスキー設定の場合:

```powershell
aws configure
```

## 1. CloudFormation スタック作成または更新

管理者パスワードは `AdminPassword` に指定します。8文字以上にしてください。

```powershell
aws cloudformation deploy `
  --stack-name mvp-voting-app `
  --template-file infra/cloudformation/mvp-voting-app.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides AdminPassword="change-this-password" `
  --region ap-northeast-1
```

プロファイルを使う場合:

```powershell
aws cloudformation deploy `
  --stack-name mvp-voting-app `
  --template-file infra/cloudformation/mvp-voting-app.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides AdminPassword="change-this-password" `
  --region ap-northeast-1 `
  --profile your-profile
```

既に GitHub Actions 用パラメータ `GitHubRepository` を指定して作成した場合も、今後は指定不要です。

## 2. 出力値を確認

```powershell
aws cloudformation describe-stacks `
  --stack-name mvp-voting-app `
  --query "Stacks[0].Outputs" `
  --output table `
  --region ap-northeast-1
```

重要な出力値:

- `AppUrl`: アプリの公開 URL
- `EcrRepositoryUri`: 作成された ECR リポジトリ
- `EcsClusterName`: ECS クラスター名
- `EcsServiceName`: ECS サービス名
- `EcsTaskFamily`: ECS タスク定義 family

## 3. CLI でアプリをデプロイ

次のスクリプトで、Docker build、ECR push、ECS タスク定義更新、ECS サービス更新まで行います。

```powershell
.\scripts\deploy-aws.ps1
```

プロファイル、リージョン、スタック名を指定する場合:

```powershell
.\scripts\deploy-aws.ps1 `
  -StackName mvp-voting-app `
  -Region ap-northeast-1 `
  -Profile your-profile
```

PowerShell の実行ポリシーで止まる場合:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-aws.ps1
```

任意のイメージタグでデプロイする場合:

```powershell
.\scripts\deploy-aws.ps1 -ImageTag manual-001
```

ビルド済みイメージを push だけしたい場合:

```powershell
.\scripts\deploy-aws.ps1 -ImageTag manual-001 -SkipBuild
```

CloudFormation 作成直後は ECS の `desired-count` が `0` です。デプロイスクリプトはデフォルトで `1` に更新します。

## 4. アプリにアクセス

デプロイ完了後、スクリプト末尾に表示される `App URL` にアクセスします。

手動で確認する場合:

```powershell
aws cloudformation describe-stacks `
  --stack-name mvp-voting-app `
  --query "Stacks[0].Outputs[?OutputKey=='AppUrl'].OutputValue" `
  --output text `
  --region ap-northeast-1
```

## よく使う運用コマンド

ECS サービスを停止:

```powershell
aws ecs update-service `
  --cluster mvp-voting-app `
  --service mvp-voting-app `
  --desired-count 0 `
  --region ap-northeast-1
```

ECS サービスを起動:

```powershell
aws ecs update-service `
  --cluster mvp-voting-app `
  --service mvp-voting-app `
  --desired-count 1 `
  --region ap-northeast-1
```

ログ確認:

```powershell
aws logs tail /ecs/mvp-voting-app `
  --follow `
  --region ap-northeast-1
```

スタック削除:

```powershell
aws cloudformation delete-stack `
  --stack-name mvp-voting-app `
  --region ap-northeast-1
```

## ローカルで Docker 確認

```powershell
docker build -t mvp-voting-app .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" -e ADMIN_PASSWORD=preview mvp-voting-app
```

確認 URL:

```text
http://localhost:3000/admin
```

## 注意

- `data/` は Git 管理外です。本番では EFS を `/app/data` にマウントします。
- CloudFormation の `AWS::SSM::Parameter` は `SecureString` を直接作れないため、テンプレートでは `String` として作成しています。本番運用でより厳密にしたい場合は、作成後に SecureString へ移行するか、Secrets Manager を使う構成に変更してください。
- 現在のテンプレートは HTTP 公開です。本番利用では ACM 証明書と HTTPS Listener、必要に応じて CloudFront を追加してください。
