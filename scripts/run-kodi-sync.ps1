param(
  [string]$RepositoryPath = (Split-Path -Parent $PSScriptRoot)
)

$mutex = [System.Threading.Mutex]::new($false, 'Global\KodiWebSnapshotSync')
$acquired = $false
try {
  $acquired = $mutex.WaitOne(0)
  if (-not $acquired) {
    Write-Output 'KODI snapshot synchronization is already running; this invocation was skipped.'
    exit 0
  }
  Push-Location -LiteralPath $RepositoryPath
  try {
    & npm.cmd run sync:kodi --workspace '@kodi/api'
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  if ($acquired) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
