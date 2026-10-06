param(
    [ValidateSet('dev', 'typecheck', 'test', 'build', 'desktop', 'instalar')]
    [string]$Comando = 'dev'
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$localNode = Join-Path $projectRoot '.deploy-local\ferramentas\node20\node.exe'
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
    if ($LASTEXITCODE -ne 0 -or $majorVersion -ne '20') {
        throw 'Este projeto requer Node.js 20. Instale essa versao ou restaure o runtime local.'
    }
    $nodeDirectory = Split-Path -Parent $nodeCommand
    $corepack = Join-Path $nodeDirectory 'node_modules\corepack\dist\corepack.js'
    if (-not (Test-Path -LiteralPath $corepack)) {
        throw 'Corepack nao encontrado junto do Node 20. Restaure o runtime local ou instale Corepack.'
    }
    $env:PATH = $nodeDirectory + ';' + $previousPath
    $env:COREPACK_HOME = Join-Path $projectRoot '.deploy-local\cache\corepack'
    $env:NODE_OPTIONS = @($previousNodeOptions, '--max-old-space-size=4096') -join ' '
    if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'pnpm.cmd'))) {
        & $nodeCommand $corepack enable --install-directory $nodeDirectory
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel preparar o pnpm local.' }
    }
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
