[CmdletBinding()]
param(
    [switch]$Conferir,
    [string]$Chave
)

$ErrorActionPreference = 'Stop'
$repo = 'talismanbruno/lumesync'
$registro = "ghcr.io/$repo"
$destino = 'ubuntu@lumesocial.online'
$api = "https://api.github.com/repos/$repo"
if (-not $Chave) { $Chave = Join-Path $PSScriptRoot '.deploy-local/ssh/oracle-lume-core' }

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "O Git falhou ($LASTEXITCODE)." }
}

function Get-GitHubHeaders {
    $interativo = $env:GCM_INTERACTIVE
    $prompt = $env:GIT_TERMINAL_PROMPT
    try {
        $env:GCM_INTERACTIVE = 'Never'
        $env:GIT_TERMINAL_PROMPT = '0'
        $credencial = "protocol=https`nhost=github.com`nusername=talismanbruno`n`n" | & git credential fill
        if ($LASTEXITCODE -ne 0) { throw 'Entre no GitHub pelo Git Credential Manager e tente novamente.' }
        $senha = $credencial | Where-Object { $_.StartsWith('password=') } | Select-Object -First 1
        if (-not $senha -or $senha.Length -le 9) { throw 'Credencial do GitHub indisponivel.' }
        return @{
            Authorization = 'Bearer ' + $senha.Substring(9)
            Accept = 'application/vnd.github+json'
            'X-GitHub-Api-Version' = '2026-03-10'
        }
    } finally {
        $env:GCM_INTERACTIVE = $interativo
        $env:GIT_TERMINAL_PROMPT = $prompt
    }
}

function Invoke-GitHub([string]$Rota, [hashtable]$Dados) {
    $opcoes = @{
        Uri = "$api/$Rota"
        Headers = $cabecalhos
        TimeoutSec = 30
        MaximumRedirection = 0
    }
    if ($Dados) {
        $opcoes.Method = 'Post'
        $opcoes.ContentType = 'application/json'
        $opcoes.Body = $Dados | ConvertTo-Json -Depth 4 -Compress
    }
    Invoke-RestMethod @opcoes
}

function Wait-Workflow([string]$Nome, [string]$Rota, [string]$Commit, [int]$Minutos) {
    $limite = [DateTime]::UtcNow.AddMinutes($Minutos)
    $anterior = ''
    while ([DateTime]::UtcNow -lt $limite) {
        $resposta = Invoke-GitHub $Rota
        $execucao = if ($Rota.StartsWith('actions/workflows/')) {
            $resposta.workflow_runs | Select-Object -First 1
        } else {
            $resposta
        }
        $status = if ($execucao) { $execucao.status } else { 'aguardando inicio' }
        if ($status -ne $anterior) {
            Write-Host "$Nome - $status $($execucao.html_url)"
            $anterior = $status
        }
        if ($execucao -and $execucao.head_sha -cne $Commit) {
            throw "$Nome executou outro commit. Confira a main e tente novamente."
        }
        if ($status -eq 'completed') {
            if ($execucao.conclusion -ne 'success') {
                throw "$Nome terminou com $($execucao.conclusion). Veja $($execucao.html_url)"
            }
            return
        }
        Start-Sleep -Seconds 15
    }
    throw "$Nome ainda esta pendente. Confira https://github.com/$repo/actions e tente novamente."
}

Push-Location -LiteralPath $PSScriptRoot
try {
    $origem = Invoke-Git remote get-url origin
    if ($origem -notmatch '^https://github\.com/talismanbruno/lumesync(?:\.git)?$') {
        throw "A origem do Git deve ser https://github.com/$repo."
    }
    if ((Invoke-Git branch --show-current) -ne 'main') { throw 'Abra a branch main para publicar.' }

    $selecionados = @(Invoke-Git diff --cached --name-status)
    if ($selecionados.Count) {
        $selecao = Invoke-Git write-tree
        Write-Host 'Arquivos selecionados para o commit:'
        $selecionados | Write-Host
        Invoke-Git diff --cached --check
    }
    if (@(Invoke-Git diff --name-only).Count -or @(Invoke-Git ls-files --others --exclude-standard).Count) {
        Write-Host 'Ha outras edicoes na pasta. Entram somente os arquivos selecionados e os commits ja feitos.' -ForegroundColor Yellow
    }

    $cabecalhos = Get-GitHubHeaders
    $remoto = (Invoke-GitHub 'branches/main').commit.sha
    & git merge-base --is-ancestor $remoto HEAD
    if ($LASTEXITCODE -ne 0) { throw 'A main no GitHub mudou. Sincronize os commits antes de publicar.' }
    if (-not (Test-Path -LiteralPath $Chave -PathType Leaf)) { throw "Chave SSH da Oracle ausente: $Chave" }
    $sshOpcoes = @('-i', (Resolve-Path -LiteralPath $Chave).Path, '-o', 'IdentitiesOnly=yes',
        '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10')
    $saude = & ssh @sshOpcoes $destino "test -s /home/ubuntu/lume-core/compose.yml && command -v flock >/dev/null && docker inspect --format '{{.State.Health.Status}}' lume-core"
    if ($LASTEXITCODE -ne 0 -or $saude -ne 'healthy') { throw 'A Oracle nao respondeu com o Lume saudavel.' }

    $commit = Invoke-Git rev-parse HEAD
    Write-Host "GitHub e Oracle acessiveis. Commit local: $commit"
    if ($Conferir) { return }

    $instancia = Invoke-RestMethod 'https://lumesocial.online/api/instance/info' -TimeoutSec 30
    if (-not $selecionados.Count -and $instancia.commit -eq $commit) {
        Write-Host 'Esse commit ja esta no ar. Selecione os arquivos da proxima alteracao no Git.'
        return
    }
    if ($remoto -ne $commit) {
        Write-Host 'Commits locais que serao enviados:'
        Invoke-Git log --oneline "$remoto..$commit"
    }
    if ((Read-Host 'A publicacao reinicia o Lume e interrompe chamadas ativas. Digite PUBLICAR para continuar') -cne 'PUBLICAR') {
        Write-Host 'Publicacao cancelada.'
        return
    }
    if ($selecionados.Count) {
        $mensagem = Read-Host 'Nome curto para esta alteracao'
        if ([string]::IsNullOrWhiteSpace($mensagem)) { throw 'Informe um nome para o commit.' }
        if ((Invoke-Git write-tree) -ne $selecao -or (Invoke-Git rev-parse HEAD) -ne $commit) {
            throw 'A selecao ou o commit mudou. Abra o atalho novamente e confira os arquivos.'
        }
        Invoke-Git commit -m $mensagem
        $commit = Invoke-Git rev-parse HEAD
    }

    Invoke-Git push origin "${commit}:refs/heads/main"
    $filtro = "branch=main&event=push&head_sha=$commit&per_page=1"
    foreach ($workflow in 'ci', 'security', 'codeql') {
        Wait-Workflow $workflow "actions/workflows/$workflow.yml/runs?$filtro" $commit 30
    }
    if ((Invoke-GitHub 'branches/main').commit.sha -cne $commit) { throw 'A main mudou durante as verificacoes.' }

    $release = 'oracle-' + $commit.Substring(0, 10) + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $disparo = Invoke-GitHub 'actions/workflows/docker-publish.yml/dispatches' @{
        ref = 'main'
        inputs = @{ tag = $release }
    }
    if ($disparo.workflow_run_id -notmatch '^\d+$') { throw 'O GitHub nao retornou o numero da publicacao.' }
    Wait-Workflow 'Imagem do Lume' "actions/runs/$($disparo.workflow_run_id)" $commit 60
    if ((Invoke-GitHub 'branches/main').commit.sha -cne $commit) { throw 'A main mudou enquanto a imagem era gerada.' }

    $tag = "${registro}:$release"
    $imagem = & ssh @sshOpcoes $destino "docker pull '$tag' >&2 && docker image inspect --format '{{index .RepoDigests 0}}' '$tag'"
    if ($LASTEXITCODE -ne 0 -or $imagem -cnotmatch '^ghcr\.io/talismanbruno/lumesync@sha256:[a-f0-9]{64}$') {
        throw 'A Oracle nao conseguiu obter a imagem publicada.'
    }
    $promocao = Invoke-Git show "${commit}:deploy/oracle-runtime/promote-container-image.sh"
    Write-Host 'Aplicando na Oracle. Aguarde o backup e o teste de saude.'
    $promocao |
        & ssh @sshOpcoes $destino "tr -d '\r' | flock -n /home/ubuntu/lume-core/.publicar-lume.lock sh -s -- '$imagem' '$release' '$commit'"
    if ($LASTEXITCODE -ne 0) { throw "A publicacao na Oracle falhou ($LASTEXITCODE). Confira a mensagem acima." }
    Write-Host "Publicado em https://lumesocial.online (commit $commit)." -ForegroundColor Green
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
