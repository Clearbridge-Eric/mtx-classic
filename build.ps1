# Packages the add-on for upload to addons.mozilla.org.
# Usage: right-click > Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File build.ps1
# Bump "version" in manifest.json (and @version in mtx-classic.user.js) before each new upload.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$version = (Get-Content manifest.json -Raw | ConvertFrom-Json).version
$scriptVersion = (Select-String -Path mtx-classic.user.js -Pattern '@version\s+(\S+)').Matches[0].Groups[1].Value
if ($version -ne $scriptVersion) {
    throw "Version mismatch: manifest.json says $version, mtx-classic.user.js says $scriptVersion"
}

New-Item -ItemType Directory -Force -Path dist | Out-Null
$zip = "dist\mtx-classic-$version.zip"
if (Test-Path $zip) { Remove-Item $zip }

# Files only, at the root of the zip (AMO rejects a zip with manifest.json in a subfolder).
Compress-Archive -Path manifest.json, mtx-classic.user.js, background.js, icon.svg -DestinationPath $zip
Write-Host "Built $zip"
