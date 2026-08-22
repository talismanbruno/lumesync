# Plano de Implementação: Chamadas Privadas 1:1

Este plano detalha a implementação de chamadas de voz e vídeo 1:1 reais entre amigos, utilizando a infraestrutura WebRTC existente, mas adicionando uma camada de sinalização e persistência de sessão para garantir confiabilidade.

## 1. Banco de Dados (Sinalização e Sessão)

Para gerenciar convites e chamadas ativas sem depender apenas de `Presence` (que é volátil), criaremos uma tabela `voice_calls`.

### Esquema: `public.voice_calls`
- `id`: UUID (Primary Key)
- `initiator_id`: UUID (FK `profiles.id`, NOT NULL)
- `recipient_id`: UUID (FK `profiles.id`, NOT NULL)
- `room_key`: TEXT (Identidade determinística, NOT NULL)
- `status`: TEXT (Enum: 'ringing', 'active', 'ended', NOT NULL, DEFAULT 'ringing')
- `created_at`: TIMESTAMP WITH TIME ZONE (DEFAULT now())
- `expires_at`: TIMESTAMP WITH TIME ZONE (now() + INTERVAL '1 minute')

### Regras de Segurança (RLS)
- `SELECT`: Permitido se `auth.uid()` for o `initiator_id` ou `recipient_id`.
- `INSERT`: Permitido se `auth.uid()` for o `initiator_id`.
- `UPDATE`: Permitido se `auth.uid()` for um dos participantes (para aceitar ou encerrar).
- `DELETE`: Permitido pelo `service_role` (via cron/limpeza) ou participantes ao encerrar.

## 2. Interface das Listas (FriendsView)

- Refatorar as listas "Disponível" e "Todos" para usar um componente de ação unificado.
- **Lógica dos botões:**
    - Botão de Mensagem: Abre a DM normalmente.
    - Botão de Chamada:
        - Habilitado se o amigo estiver online.
        - Desabilitado com tooltip "Usuário indisponível" se offline.
        - Oculto para o Lume Bot.
        - Oculto para o próprio usuário.

## 3. Lógica de Chamada (Integração)

### Fluxo do Iniciador (Click no Telefone)
1. Buscar conversa 1:1 existente para obter o `conversationId`.
2. Gerar `room_key` determinística: `dm-1to1-{conversationId}`.
3. Inserir registro em `voice_calls` com status `ringing`.
4. Abrir o `Stage` (UI de chamada) e ativar o hook `useVoiceRoom` com a `room_key`.

### Fluxo do Destinatário (Realtime)
1. Ouvir `INSERT` na tabela `voice_calls` onde `recipient_id = auth.uid()`.
2. Exibir modal/notificação de "Chamada Recebida" com opções "Aceitar" ou "Recusar".
3. **Aceitar:** Atualizar `status` para `active` e entrar na sala com o mesmo `room_key`.
4. **Recusar:** Atualizar `status` para `ended`.

### Encerramento e Limpeza
- Quando o último participante sai, o hook limpa `voice_participants`.
- Implementar um listener que marca `voice_calls` como `ended` quando todos saem ou após expiração.

## 4. Detalhes Técnicos e Segurança

- **Unicidade:** Garantir que apenas uma chamada ativa exista por par de usuários.
- **Realtime:** Habilitar Realtime para `voice_calls`.
- **Reuso:** O hook `useVoiceRoom` já suporta `room_key` genérico, precisando apenas de pequenos ajustes na interface `LumeProfile` para incluir `is_admin` corretamente (já feito na volta anterior).

---

### Migração SQL Requerida

```sql
CREATE TABLE public.voice_calls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    initiator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    room_key text NOT NULL,
    status text DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')) NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '1 minute'),
    CONSTRAINT one_active_call_per_pair UNIQUE (initiator_id, recipient_id, room_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_calls TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes podem ver suas chamadas" ON public.voice_calls
    FOR SELECT TO authenticated USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

CREATE POLICY "Iniciador pode criar chamada" ON public.voice_calls
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Participantes podem atualizar chamada" ON public.voice_calls
    FOR UPDATE TO authenticated USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);
```
