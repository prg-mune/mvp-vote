# AWS CloudFormation デプロイ手順

このアプリは CloudFormation で AWS 側の土台を作り、GitHub Actions で Docker イメージを ECS Fargate にデプロイします。

## 作成される主なリソース

- Amazon ECR: Docker イメージ置き場
- Amazon ECS Fargate: アプリ実行環境
- Amazon EFS: `/app/data` の永続化
- Application Load Balancer: 外部公開
- AWS Systems Manager Parameter Store: 管理者パスワード
- CloudWatch Logs: アプリログ
- IAM OIDC Role: GitHub Actions から AWS へ接続

## 事前準備

AWS CLI でログインします。SSO を使う場合は次の形です。

```powershell
aws configure sso
aws sso login --profile your-profile
```

通常のアクセスキー設定でも動きます。

```powershell
aws configure
```

## 1. CloudFormation スタック作成

管理者パスワードは `AdminPassword` に指定します。8文字以上にしてください。

```powershell
aws cloudformation deploy `
  --stack-name mvp-voting-app `
  --template-file infra/cloudformation/mvp-voting-app.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    AdminPassword="change-this-password" `
    GitHubRepository="prg-mune/mvp-vote"
```

リージョンを固定したい場合は `--region ap-northeast-1` を付けます。

既に GitHub Actions 用の OIDC Provider が AWS アカウントに存在する場合は、重複作成を避けるため ARN を渡します。

```powershell
aws cloudformation deploy `
  --stack-name mvp-voting-app `
  --template-file infra/cloudformation/mvp-voting-app.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    AdminPassword="change-this-password" `
    GitHubRepository="prg-mune/mvp-vote" `
    ExistingGitHubOidcProviderArn="arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
```

## 2. 出力値を確認

```powershell
aws cloudformation describe-stacks `
  --stack-name mvp-voting-app `
  --query "Stacks[0].Outputs" `
  --output table
```

重要な出力値:

- `AppUrl`: アプリの公開URL
- `GitHubActionsRoleArn`: GitHub Actions に登録する IAM Role ARN
- `EcrRepositoryUri`: 作成された ECR リポジトリ

## 3. GitHub Secret を登録

GitHub リポジトリの `Settings > Secrets and variables > Actions` に次を登録します。

```text
AWS_ROLE_TO_ASSUME=GitHubActionsRoleArn の値
```

## 4. GitHub Actions でデプロイ

GitHub の画面で次を実行します。

```text
Actions > Deploy to AWS ECS > Run workflow
```

ワークフローは次を行います。

1. Docker イメージをビルド
2. ECR に push
3. CloudFormation が作った ECS タスク定義を取得
4. コンテナイメージだけ新しいものに差し替え
5. ECS Service にデプロイ
6. 初回起動用に ECS Service を `desired-count=1` へ更新

CloudFormation 作成直後は `ServiceDesiredCount=0` なので、GitHub Actions 実行後にアプリが起動します。

## ローカルで Docker 確認

```powershell
docker build -t mvp-voting-app .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" -e ADMIN_PASSWORD=preview mvp-voting-app
```

確認URL:

```text
http://localhost:3000/admin
```

## 注意

- `data/` は Git 管理外です。本番では EFS を `/app/data` にマウントします。
- CloudFormation の `AWS::SSM::Parameter` は `SecureString` を直接作れないため、テンプレートでは `String` として作成しています。本番運用でより厳密にしたい場合は、作成後に SecureString へ移行するか、Secrets Manager を使う構成に変更してください。
- 現在のテンプレートは HTTP 公開です。本番利用では ACM 証明書と HTTPS Listener、必要に応じて CloudFront を追加してください。
