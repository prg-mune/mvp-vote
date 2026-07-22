param(
  [string]$StackName = "mvp-voting-app",
  [string]$Region = "ap-northeast-1",
  [string]$Profile = "",
  [string]$EventId = "",
  [string]$VoteUrl = "",
  [string]$Since = "30m"
)

$ErrorActionPreference = "Stop"

if (-not [string]::IsNullOrWhiteSpace($Profile)) {
  $env:AWS_PROFILE = $Profile
}

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "==== $Title ===="
}

function Invoke-HttpCheck {
  param(
    [string]$Name,
    [string]$Url
  )

  Write-Section $Name
  Write-Host $Url

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Content-Type: $($response.Headers["Content-Type"])"
    $content = [string]$response.Content
    Write-Host "Length: $($content.Length)"
    if ($content.Length -gt 0) {
      Write-Host "Body head:"
      Write-Host $content.Substring(0, [Math]::Min(800, $content.Length))
    }
    return @{ ok = $true; status = [int]$response.StatusCode; body = $content }
  } catch {
    Write-Host "Request failed: $($_.Exception.Message)"
    $statusCode = $null
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      Write-Host "Status: $statusCode"
    }
    return @{ ok = $false; status = $statusCode; body = "" }
  }
}

function Get-StackOutputMap {
  $outputs = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json

  if ($LASTEXITCODE -ne 0) {
    throw "aws cloudformation describe-stacks failed."
  }

  $map = @{}
  foreach ($output in $outputs) {
    $map[$output.OutputKey] = $output.OutputValue
  }
  return $map
}

if ([string]::IsNullOrWhiteSpace($EventId) -and -not [string]::IsNullOrWhiteSpace($VoteUrl)) {
  if ($VoteUrl -match "/vote/([^/?#]+)") {
    $EventId = $Matches[1]
  }
}

if ([string]::IsNullOrWhiteSpace($EventId)) {
  throw "Specify -EventId or -VoteUrl."
}

$outputs = Get-StackOutputMap
$appUrl = [string]$outputs["AppUrl"]
if ([string]::IsNullOrWhiteSpace($appUrl)) {
  throw "CloudFormation output AppUrl was not found."
}

$baseUrl = $appUrl.TrimEnd("/")
if ([string]::IsNullOrWhiteSpace($VoteUrl)) {
  $VoteUrl = "$baseUrl/vote/$EventId"
}

Write-Section "Target"
Write-Host "Stack: $StackName"
Write-Host "Region: $Region"
Write-Host "AppUrl: $baseUrl"
Write-Host "EventId: $EventId"

$health = Invoke-HttpCheck -Name "Health endpoint" -Url "$baseUrl/api/health"
$eventApi = Invoke-HttpCheck -Name "Event API" -Url "$baseUrl/api/events/$EventId"
$votePage = Invoke-HttpCheck -Name "Vote page HTML" -Url $VoteUrl

Write-Section "Likely diagnosis"
if (-not $health.ok) {
  Write-Host "ALB or ECS app is not reachable. Check ECS service/task health first."
} elseif ($eventApi.status -eq 404) {
  Write-Host "The event ID was not found in production data. Create/open the event from the production /admin screen and use that vote URL."
} elseif ($eventApi.ok -and $votePage.ok) {
  Write-Host "The event API and page HTML are reachable. If the browser is still blank, check browser DevTools Console for a client-side JavaScript error."
} elseif (-not $votePage.ok) {
  Write-Host "The event API may be reachable, but the vote page HTML failed. Check ECS logs below for server-side rendering errors."
} else {
  Write-Host "The result is mixed. Review the status codes above and ECS logs below."
}

Write-Section "Recent ECS logs"
aws logs tail "/ecs/$StackName" --since $Since --region $Region
if ($LASTEXITCODE -ne 0) {
  Write-Host "Could not read CloudWatch logs. Confirm AWS credentials and logs permission."
}
