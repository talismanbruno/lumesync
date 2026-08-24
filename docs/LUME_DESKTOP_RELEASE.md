# Publicação do Lume Desktop

O pipeline `Lume Desktop Release` gera instaladores em máquinas limpas do
GitHub para:

- Windows x64 (`.exe`)
- macOS Intel (`.dmg` e `.zip`)
- macOS Apple Silicon (`.dmg` e `.zip`)

## Build de validação

Abra **Actions > Lume Desktop Release > Run workflow**. Esse modo compila os
três sistemas e mantém os arquivos como artefatos privados da execução por 14
dias, sem criar uma versão pública.

## Versão pública

Depois que o build de validação passar, crie e envie uma tag no formato:

```text
lume-desktop-v1.0.0-beta.1
```

O pipeline cria automaticamente uma Release no GitHub e anexa todos os
instaladores. A atualização automática do aplicativo continuará desabilitada
durante o beta, até os binários serem assinados para Windows e macOS.

## Checklist antes de publicar

1. Login e criação de conta.
2. DM, grupo e comunidade.
3. Entrada e saída de chamada.
4. Microfone, câmera e compartilhamento de tela.
5. Ícone, nome `Lume` e protocolo `lume://`.
6. Instalação limpa e abertura após reiniciar o computador.
