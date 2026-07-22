param(
  [string]$StackName = "mvp-voting-app",
  [string]$Region = "ap-northeast-1",
  [string]$Profile = "",
  [string]$ImageTag = "",
  [int]$DesiredCount = 1,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

if (-not [string]::IsNullOrWhiteSpace($Profile)) {
  $env:AWS_PROFILE = $Profile
}

function Assert-NativeCommandSucceeded {
  param(
    [string]$CommandName
  )

  if ($LASTEXITCODE -ne 0) {
    throw "$CommandName failed with exit code $LASTEXITCODE."
  }
}

function Get-StackOutputMap {
  param(
    [string]$Name,
    [string]$AwsRegion
  )

  $stack = aws cloudformation describe-stacks `
    --stack-name $Name `
    --region $AwsRegion `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json
  Assert-NativeCommandSucceeded "aws cloudformation describe-stacks"

  $map = @{}
  foreach ($output in $stack) {
    $map[$output.OutputKey] = $output.OutputValue
  }
  return $map
}

function Require-Output {
  param(
    [hashtable]$Outputs,
    [string]$Key
  )

  if (-not $Outputs.ContainsKey($Key) -or [string]::IsNullOrWhiteSpace($Outputs[$Key])) {
    throw "CloudFormation output '$Key' was not found. Deploy the stack first."
  }

  return $Outputs[$Key]
}

function Add-PropertyIfPresent {
  param(
    [System.Collections.Specialized.OrderedDictionary]$Target,
    [object]$Source,
    [string]$PropertyName
  )

  $property = $Source.PSObject.Properties[$PropertyName]
  if ($null -ne $property -and $null -ne $property.Value) {
    $Target[$PropertyName] = $property.Value
  }
}

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
  try {
    $ImageTag = (git rev-parse --short HEAD).Trim()
  } catch {
    $ImageTag = Get-Date -Format "yyyyMMddHHmmss"
  }
}

$outputs = Get-StackOutputMap -Name $StackName -AwsRegion $Region
$ecrRepositoryUri = Require-Output -Outputs $outputs -Key "EcrRepositoryUri"
$ecsClusterName = Require-Output -Outputs $outputs -Key "EcsClusterName"
$ecsServiceName = Require-Output -Outputs $outputs -Key "EcsServiceName"
$ecsTaskFamily = Require-Output -Outputs $outputs -Key "EcsTaskFamily"
$appUrl = Require-Output -Outputs $outputs -Key "AppUrl"

$imageUri = "${ecrRepositoryUri}:${ImageTag}"
$registry = $ecrRepositoryUri.Split("/")[0]

Write-Host "Deploying image: $imageUri"
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $registry
Assert-NativeCommandSucceeded "docker login"

if (-not $SkipBuild) {
  docker build -t $imageUri .
  Assert-NativeCommandSucceeded "docker build"
}

docker push $imageUri
Assert-NativeCommandSucceeded "docker push"

$taskDefinition = aws ecs describe-task-definition `
  --task-definition $ecsTaskFamily `
  --region $Region `
  --query taskDefinition `
  --output json | ConvertFrom-Json
Assert-NativeCommandSucceeded "aws ecs describe-task-definition"

foreach ($container in $taskDefinition.containerDefinitions) {
  if ($container.name -eq $ecsTaskFamily) {
    $container.image = $imageUri
  }
}

$registerTaskDefinition = [ordered]@{}
$registerProperties = @(
  "family",
  "taskRoleArn",
  "executionRoleArn",
  "networkMode",
  "containerDefinitions",
  "volumes",
  "placementConstraints",
  "requiresCompatibilities",
  "cpu",
  "memory",
  "pidMode",
  "ipcMode",
  "proxyConfiguration",
  "inferenceAccelerators",
  "ephemeralStorage",
  "runtimePlatform"
)

foreach ($propertyName in $registerProperties) {
  Add-PropertyIfPresent -Target $registerTaskDefinition -Source $taskDefinition -PropertyName $propertyName
}

$taskDefinitionJson = $registerTaskDefinition | ConvertTo-Json -Depth 100 -Compress
$taskDefinitionPath = Join-Path $env:TEMP "mvp-voting-task-definition-${ImageTag}.json"
[System.IO.File]::WriteAllText($taskDefinitionPath, $taskDefinitionJson, [System.Text.UTF8Encoding]::new($false))
$taskDefinitionFile = "file://$taskDefinitionPath"

$newTaskDefinitionArn = aws ecs register-task-definition `
  --cli-input-json $taskDefinitionFile `
  --region $Region `
  --query "taskDefinition.taskDefinitionArn" `
  --output text
Assert-NativeCommandSucceeded "aws ecs register-task-definition"

aws ecs update-service `
  --cluster $ecsClusterName `
  --service $ecsServiceName `
  --task-definition $newTaskDefinitionArn `
  --desired-count $DesiredCount `
  --region $Region | Out-Null
Assert-NativeCommandSucceeded "aws ecs update-service"

aws ecs wait services-stable `
  --cluster $ecsClusterName `
  --services $ecsServiceName `
  --region $Region
Assert-NativeCommandSucceeded "aws ecs wait services-stable"

Write-Host "Deploy complete."
Write-Host "App URL: $appUrl"
