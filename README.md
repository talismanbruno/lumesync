# lume

PROJETO: LUME – PLATAFORMA DE COMUNICAÇÃO MINIMALISTA

Inicie um novo projeto do zero chamado LUME. O objetivo é criar um espaço de comunicação premium, clean e ultra-veloz.

1. IDENTIDADE VISUAL (AESTHETIC):

Paleta de Cores: Fundo principal #050505 (quase preto), Superfícies e Cards #121212, Acento principal (Glow): Cyan suave #00D1FF ou Teal vibrante.

Estilo: Minimalismo absoluto. Bordas finas, sombras de profundidade (glow) nos elementos ativos e tipografia Sans-serif de alta legibilidade (Inter ou Geist).

2. ARQUITETURA DO BANCO DE DADOS (SUPABASE):
Configure o Supabase com as seguintes tabelas e regras antes de gerar a interface:

profiles: id (PK, references auth.users), username (unique), display_name, avatar_url, status (online/offline).

servers: id (PK), name, owner_id (references profiles), invite_code (unique).

members: server_id (references servers), user_id (references profiles), role (owner/member).

3. LÓGICA DE AUTENTICAÇÃO E ONBOARDING (CRÍTICO):

Implemente login por E-mail e Google.

Trigger Automática: Crie uma função/trigger no Supabase que insira automaticamente um registro na tabela public.profiles sempre que um novo usuário for criado no auth.users. Isso evita que o usuário fique "fantasma" no sistema.

Fluxo de Entrada: Se um usuário logar mas não tiver um username definido em profiles, ele deve ser obrigado a preencher uma tela de "Bem-vindo ao Lume" para escolher seu username antes de ver o dashboard.

4. INTERFACE INICIAL:

Uma tela de Login "Clean & Dark" com o logo/nome "LUME".

Um esqueleto do Dashboard (Layout de 3 colunas padrão Discord, mas no estilo Lume) que só é acessível após o perfil estar completo.

VALIDAÇÃO OBRIGATÓRIA:

Teste o login. Verifique no Console do Navegador se, após o login, o objeto user está retornando os dados do profiles.

O botão de login deve ter estado de loading e tratar erros de forma visível via toast.

NÃO IMPLEMENTE CHAT AINDA. Foque em garantir que o usuário loga e o perfil existe no banco.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lumesync.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/df4fda12-367f-4a18-99c1-f7f7967c8758).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
