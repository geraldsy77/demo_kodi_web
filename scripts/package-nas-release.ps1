$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$outputRoot = Join-Path $repositoryRoot 'dist-nas'
$stagingRoot = Join-Path $outputRoot 'staging'
$releaseRoot = Join-Path $stagingRoot 'kodi-web'
$archivePath = Join-Path $outputRoot 'kodi-web-nas-release.tar.gz'

function Assert-SafeGeneratedPath([string]$Path) {
  $absolutePath = [IO.Path]::GetFullPath($Path)
  $expectedPrefix = [IO.Path]::GetFullPath($outputRoot) + [IO.Path]::DirectorySeparatorChar
  if (-not $absolutePath.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify a path outside $outputRoot."
  }
}

function Invoke-NpmBuild([string]$Workspace) {
  & npm.cmd run build --workspace $Workspace
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed for $Workspace."
  }
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
Assert-SafeGeneratedPath $stagingRoot
if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
Assert-SafeGeneratedPath $archivePath
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Push-Location -LiteralPath $repositoryRoot
try {
  Invoke-NpmBuild '@kodi/api'
  Invoke-NpmBuild '@kodi/web'

  New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot 'apps/api') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot 'apps/web') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot 'scripts') | Out-Null

  Copy-Item -LiteralPath (Join-Path $repositoryRoot 'apps/api/dist') -Destination (Join-Path $releaseRoot 'apps/api') -Recurse
  Copy-Item -LiteralPath (Join-Path $repositoryRoot 'apps/web/dist') -Destination (Join-Path $releaseRoot 'apps/web') -Recurse
  Copy-Item -LiteralPath (Join-Path $repositoryRoot 'scripts/nas') -Destination (Join-Path $releaseRoot 'scripts') -Recurse
  Copy-Item -LiteralPath (Join-Path $repositoryRoot 'scripts/nas/.env.example') -Destination (Join-Path $releaseRoot '.env.example')
  Copy-Item -LiteralPath (Join-Path $repositoryRoot 'docs/NATIVE_DSM_HOSTING.md') -Destination (Join-Path $releaseRoot 'README-NAS.md')

  $apiPackage = Get-Content -LiteralPath (Join-Path $repositoryRoot 'apps/api/package.json') -Raw | ConvertFrom-Json
  $runtimePackage = [ordered]@{
    name = '@kodi/api'
    private = $true
    version = $apiPackage.version
    type = 'module'
    engines = [ordered]@{ node = '>=18.18' }
    scripts = [ordered]@{ start = 'node dist/server.js' }
    dependencies = $apiPackage.dependencies
  }
  $runtimePackagePath = Join-Path $releaseRoot 'apps/api/package.json'
  $utf8WithoutBom = [Text.UTF8Encoding]::new($false)
  [IO.File]::WriteAllText(
    $runtimePackagePath,
    ($runtimePackage | ConvertTo-Json -Depth 10) + "`n",
    $utf8WithoutBom
  )

  Push-Location -LiteralPath (Join-Path $releaseRoot 'apps/api')
  try {
    & npm.cmd install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund --workspaces=false
    if ($LASTEXITCODE -ne 0) {
      throw 'Unable to generate the NAS production package lock.'
    }
  } finally {
    Pop-Location
  }

  Get-ChildItem -LiteralPath (Join-Path $releaseRoot 'scripts/nas') -Filter '*.sh' | ForEach-Object {
    $content = [IO.File]::ReadAllText($_.FullName).Replace("`r`n", "`n")
    [IO.File]::WriteAllText($_.FullName, $content, $utf8WithoutBom)
  }

  $tar = Get-Command tar.exe -ErrorAction Stop
  & $tar.Source -czf $archivePath -C $stagingRoot 'kodi-web'
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to create the NAS release archive.'
  }
} finally {
  Pop-Location
  if (Test-Path -LiteralPath $stagingRoot) {
    Assert-SafeGeneratedPath $stagingRoot
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}

$archive = Get-Item -LiteralPath $archivePath
$sha256 = [Security.Cryptography.SHA256]::Create()
$stream = [IO.File]::OpenRead($archivePath)
try {
  $checksum = ([BitConverter]::ToString($sha256.ComputeHash($stream)) -replace '-', '')
} finally {
  $stream.Dispose()
  $sha256.Dispose()
}
Write-Output "NAS release: $($archive.FullName)"
Write-Output "Size: $($archive.Length) bytes"
Write-Output "SHA256: $checksum"
