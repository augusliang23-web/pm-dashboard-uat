$repoRoot = Split-Path -Parent $PSScriptRoot
$javaExe = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Recurse -Filter java.exe -ErrorAction Stop | Select-Object -First 1 -ExpandProperty FullName
$javaBin = Split-Path -Parent $javaExe
$env:JAVA_HOME = Split-Path -Parent $javaBin
$env:Path = "$javaBin;$env:Path"

New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot 'tmp') | Out-Null
$emulatorLog = Join-Path $repoRoot 'tmp\v2.2t-emulator.log'
$previewLog = Join-Path $repoRoot 'tmp\v2.2t-preview.log'

Start-Process -FilePath 'npm.cmd' -ArgumentList '--prefix', 'functions', 'exec', 'firebase', '--', 'emulators:start', '--only', 'auth,firestore,functions' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $emulatorLog -RedirectStandardError $emulatorLog

for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  if ((Test-NetConnection -ComputerName '127.0.0.1' -Port 8080 -InformationLevel Quiet)) { break }
  Start-Sleep -Seconds 1
}
if (-not (Test-NetConnection -ComputerName '127.0.0.1' -Port 8080 -InformationLevel Quiet)) {
  throw "Firestore Emulator did not start. Read $emulatorLog"
}

node (Join-Path $repoRoot 'scripts\seed-v2.2t-emulator.mjs')
Start-Process -FilePath 'npx.cmd' -ArgumentList '--yes', 'http-server', '.', '-p', '4173', '-c-1' -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $previewLog -RedirectStandardError $previewLog
Write-Output 'Open http://127.0.0.1:4173/?emulator=1'
