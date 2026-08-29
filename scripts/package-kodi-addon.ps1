[CmdletBinding()]
param(
  [string]$OutputDirectory = 'dist-kodi-addon'
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$addonId = 'script.glabs.kodi-sync'
$sourceDirectory = Join-Path $repositoryRoot "kodi-addon\$addonId"
$manifestPath = Join-Path $sourceDirectory 'addon.xml'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Missing add-on manifest: $manifestPath"
}

[xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
if ($manifest.addon.id -ne $addonId) {
  throw "The manifest add-on ID must be '$addonId'."
}

$version = [string]$manifest.addon.version
if ($version -notmatch '^\d+\.\d+\.\d+(?:[.+~-][0-9A-Za-z.-]+)?$') {
  throw "The manifest version '$version' is not a supported version string."
}

$requiredFiles = @(
  'addon.xml',
  'addon.py',
  'resources\icon.png',
  'resources\settings.xml',
  'resources\lib\kodi_sync.py',
  'resources\language\resource.language.en_gb\strings.po'
)

foreach ($relativePath in $requiredFiles) {
  $requiredPath = Join-Path $sourceDirectory $relativePath
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Missing required add-on file: $relativePath"
  }
}

$forbiddenFiles = Get-ChildItem -LiteralPath $sourceDirectory -Recurse -Force |
  Where-Object {
    $_.Name -in @('.env', '.git', '__pycache__') -or
    $_.Extension -in @('.crt', '.key', '.p12', '.pem', '.pfx', '.pyc', '.pyo') -or
    $_.FullName -match '[\\/]addon_data[\\/]'
  }

if ($forbiddenFiles) {
  $relativeForbiddenFiles = $forbiddenFiles | ForEach-Object {
    $_.FullName.Substring($sourceDirectory.Length).TrimStart('\', '/')
  }
  throw "Forbidden generated, secret, or certificate material found: $($relativeForbiddenFiles -join ', ')"
}

$resolvedOutputDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory
} else {
  Join-Path $repositoryRoot $OutputDirectory
}
$resolvedOutputDirectory = (New-Item -ItemType Directory -Force $resolvedOutputDirectory).FullName
$zipPath = Join-Path $resolvedOutputDirectory "$addonId-$version.zip"

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Push-Location (Split-Path -Parent $sourceDirectory)
try {
  tar.exe -a -c -f $zipPath $addonId
  if ($LASTEXITCODE -ne 0) {
    throw "tar.exe failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object FullName)
  $invalidEntries = @($entries | Where-Object {
    $_ -match '\\' -or -not $_.StartsWith("$addonId/", [System.StringComparison]::Ordinal)
  })

  if ($invalidEntries) {
    throw "Invalid ZIP entry names: $($invalidEntries -join ', ')"
  }

  foreach ($relativePath in $requiredFiles) {
    $requiredEntry = "$addonId/$($relativePath.Replace('\', '/'))"
    if ($requiredEntry -notin $entries) {
      throw "Missing required ZIP entry: $requiredEntry"
    }
  }
} finally {
  $archive.Dispose()
}

Write-Output $zipPath
