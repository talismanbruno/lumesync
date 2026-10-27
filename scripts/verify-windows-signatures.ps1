param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [switch]$RequireSignature
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Directory).Path
$files = @(Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object {
    $_.Name -eq 'Lume.exe' -or $_.Name -match '^Lume-.+-(x64|arm64)\.exe$'
})
if ($files.Count -eq 0) { throw 'No Lume Windows executables found to verify.' }

$signed = 0
$unsigned = 0
foreach ($file in $files) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    if ($signature.Status -eq 'NotSigned' -and -not $RequireSignature) {
        $unsigned++
        Write-Warning "$($file.Name): unsigned beta; SmartScreen trust has not been established."
        continue
    }
    if ($signature.Status -ne 'Valid') {
        throw "$($file.Name): Authenticode validation failed ($($signature.Status))."
    }
    if ($null -eq $signature.TimeStamperCertificate) {
        throw "$($file.Name): signature has no trusted timestamp."
    }
    $signed++
    Write-Output "$($file.Name): valid, timestamped Authenticode signature."
}

$summary = "Windows signing: $signed verified, $unsigned unsigned."
Write-Output $summary
if ($env:GITHUB_STEP_SUMMARY) {
    Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $summary
    if ($unsigned -gt 0) {
        Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value 'Signing credentials are not configured. These beta downloads may show Windows SmartScreen warnings.'
    }
}
