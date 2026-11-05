param(
    [ValidateSet('dev', 'typecheck', 'test', 'build', 'desktop', 'instalar')]
    [string]$Comando = 'dev'
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$localNode = Join-Path $projectRoot '.deploy-local\ferramentas\node24\node.exe'
$shimDirectory = Join-Path $projectRoot '.deploy-local\cache\corepack-shims'
$previousPath = $env:PATH
$previousCorepackHome = $env:COREPACK_HOME
$previousNodeOptions = $env:NODE_OPTIONS
$exitCode = 1

try {
    if (Test-Path -LiteralPath $localNode) {
        $nodeCommand = $localNode
    } else {
        $nodeCommand = (Get-Command node -ErrorAction Stop).Source
    }
    $majorVersion = & $nodeCommand -p 'process.versions.node.split(/\./)[0]'
    if ($LASTEXITCODE -ne 0 -or $majorVersion -ne '24') {
        throw 'Este projeto requer Node.js 24. Instale essa versao ou restaure o runtime local.'
    }
    $nodeDirectory = Split-Path -Parent $nodeCommand
    $corepack = Join-Path $nodeDirectory 'node_modules\corepack\dist\corepack.js'
    if (-not (Test-Path -LiteralPath $corepack)) {
        throw 'Corepack nao encontrado junto do Node 24. Restaure o runtime local ou instale Corepack.'
    }
    $env:PATH = $shimDirectory + ';' + $nodeDirectory + ';' + $previousPath
    $env:COREPACK_HOME = Join-Path $projectRoot '.deploy-local\cache\corepack'
    $env:NODE_OPTIONS = @($previousNodeOptions, '--max-old-space-size=4096') -join ' '
    New-Item -ItemType Directory -Force -Path $shimDirectory | Out-Null
    & $nodeCommand $corepack enable pnpm --install-directory $shimDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel preparar o pnpm local.' }
    Push-Location -LiteralPath $projectRoot
    try {
        switch ($Comando) {
            'instalar' {
                & $nodeCommand $corepack pnpm install --frozen-lockfile --store-dir .deploy-local/cache/pnpm-store
            }
            'desktop' { & $nodeCommand $corepack pnpm dev:desktop }
            default { & $nodeCommand $corepack pnpm $Comando }
        }
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} catch {
    Write-Error $_ -ErrorAction Continue
} finally {
    $env:PATH = $previousPath
    $env:COREPACK_HOME = $previousCorepackHome
    $env:NODE_OPTIONS = $previousNodeOptions
}

exit $exitCode
