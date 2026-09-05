<div align="center">

<img src="packages/web/public/icons/logo.png" alt="Lume" width="144" />

# Lume

**Um lugar para conversar, reunir comunidades e estar perto de quem importa.**

[![CI](https://github.com/talismanbruno/lumesync/actions/workflows/ci.yml/badge.svg)](https://github.com/talismanbruno/lumesync/actions/workflows/ci.yml)
[![Versão](https://img.shields.io/badge/versão-beta.11-f2a900.svg)](https://github.com/talismanbruno/lumesync/releases)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933.svg)](https://nodejs.org/)

[Abrir o Lume](https://lumesocial.online) · [Baixar o aplicativo](https://github.com/talismanbruno/lumesync/releases) · [Relatar um problema](https://github.com/talismanbruno/lumesync/issues)

</div>

## Sobre o Lume

O Lume é um aplicativo de comunicação em tempo real, atualmente em beta. Ele
reúne mensagens, chamadas de voz e vídeo, compartilhamento de tela, amizades e
comunidades em uma experiência única para navegador e computador.

O produto está sendo desenvolvido com três prioridades:

- chamadas estáveis e com boa qualidade de áudio;
- segurança e controle claro para usuários e administradores;
- uma identidade visual própria, simples e reconhecível.

## O que já funciona

- Conversas privadas e em grupo.
- Servidores com canais de texto e voz, cargos e permissões.
- Chamadas de voz e vídeo com compartilhamento de tela.
- Controle individual de volume e configurações de qualidade da transmissão.
- Envio de arquivos, imagens, reações, respostas e pesquisa de mensagens.
- Perfis, amizades, presença e atividades.
- Ferramentas administrativas, moderação, auditoria e visão de saúde do sistema.
- Aplicativo para computador e versão instalável pelo navegador.
- Comunicação entre instâncias autorizadas do Lume.

## Estado atual

O Lume está na versão **1.0.0 beta 11**. A instância oficial é monitorada, possui
limites preventivos de armazenamento e chamadas, cópias de segurança automáticas
e validações de código antes de cada publicação.

Como ainda é um beta, problemas podem acontecer. Relatos enviados pelo próprio
aplicativo ou pelo GitHub ajudam a priorizar as próximas correções.

## Desenvolvimento

Requisitos: **Node.js 20 LTS** e **pnpm 10**.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Antes de publicar uma alteração:

```bash
pnpm typecheck
pnpm test
pnpm build
```

O projeto é organizado em quatro partes:

```text
packages/
  shared/   tipos e regras compartilhadas
  server/   API, tempo real, banco de dados e administração
  web/      interface do navegador
  desktop/  aplicativo para computador
```

Os documentos técnicos de cada sistema ficam em [`docs/systems/`](docs/systems/).

## Segurança

Não publique vulnerabilidades em uma issue aberta. Use o canal privado de
segurança do GitHub descrito em [`SECURITY.md`](SECURITY.md), para que a correção
possa ser preparada antes da divulgação.

## Contribuições

O código está em uma fase de consolidação e não recebe pull requests externos
por enquanto. Feedback, testes e relatos de bugs continuam bem-vindos. Veja
[`CONTRIBUTING.md`](CONTRIBUTING.md).
