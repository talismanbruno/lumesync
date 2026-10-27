$ErrorActionPreference = 'Stop'
$verifier = Join-Path $PSScriptRoot 'verify-windows-signatures.ps1'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('lume-signing-tests-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $fixture | Out-Null
[IO.File]::WriteAllBytes((Join-Path $fixture 'Lume-1.0.0-beta.24-x64.exe'), [byte[]](0))

# Exercise release-policy decisions without a private key or network trust
# dependency. The public beta is also checked separately with the real cmdlet.
function Get-AuthenticodeSignature {
    param([string]$LiteralPath)
    $global:LumeSignatureTestResult
}
$passed = 0
$savedSummary = $env:GITHUB_STEP_SUMMARY
$env:GITHUB_STEP_SUMMARY = $null
function Check-Case {
    param([string]$Name, [string]$Status, [bool]$HasTimestamp, [bool]$Required, [bool]$ShouldFail)
    $global:LumeSignatureTestResult = [pscustomobject]@{
        Status = $Status
        TimeStamperCertificate = if ($HasTimestamp) { [pscustomobject]@{ Subject = 'test timestamp' } } else { $null }
    }
    $failed = $false
    try { & $verifier -Directory $fixture -RequireSignature:$Required | Out-Null }
    catch { $failed = $true; if (-not $ShouldFail) { Write-Output $_.Exception.Message } }
    if ($failed -ne $ShouldFail) { throw "Unexpected result: $Name" }
    $script:passed++
    Write-Output "PASS: $Name"
}

try {
    Check-Case 'Explicit unsigned beta is reported' 'NotSigned' $false $false $false
    Check-Case 'Missing configured signature fails' 'NotSigned' $false $true $true
    Check-Case 'Tampered signature fails even in beta mode' 'HashMismatch' $true $false $true
    Check-Case 'Untrusted publisher fails' 'NotTrusted' $true $true $true
    Check-Case 'Missing timestamp fails' 'Valid' $false $true $true
    Check-Case 'Trusted timestamped signature passes' 'Valid' $true $true $false
    Write-Output "$passed signing policy checks passed."
} finally {
    $env:GITHUB_STEP_SUMMARY = $savedSummary
    Remove-Variable -Name LumeSignatureTestResult -Scope Global -ErrorAction SilentlyContinue
    $resolved = (Resolve-Path -LiteralPath $fixture).Path
    if ($resolved -ne [IO.Path]::GetFullPath($fixture)) { throw 'Unexpected signing-test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
