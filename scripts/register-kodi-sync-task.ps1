param(
  [string]$DailyAt = '03:00',
  [string]$RepositoryPath = (Split-Path -Parent $PSScriptRoot)
)

$runner = Join-Path $RepositoryPath 'scripts\run-kodi-sync.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -RepositoryPath `"$RepositoryPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'KODI Web Snapshot Sync' -Action $action -Trigger $trigger -Settings $settings -Description 'Copies a read-only KODI snapshot to Cloudflare D1.' -Force
