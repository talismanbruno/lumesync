import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex items-center justify-center min-h-screen bg-[#050505] text-zinc-400 p-8">
      <div className="max-w-2xl w-full space-y-6">
        <h1 className="text-xl font-bold text-[#00D1FF] border-b border-zinc-800 pb-4">
          CORREÇÃO CRÍTICA: ELIMINAR LOOP DE MICROFONE E ESTABILIZAR CONEXÃO DA SALA DE VOZ
        </h1>
        
        <p className="text-sm leading-relaxed">
          A chamada de voz está em loop infinito de re-renderização: o microfone é solicitado a cada render (gerando dezenas de toasts de erro), o canal do Supabase fica reconectando (fazendo o nome piscar) e os usuários não sincronizam.
        </p>

        <section className="space-y-4">
          <h2 className="text-[#00D1FF] font-semibold">1. REESTRUTURAR O HOOK useVoiceRoom COM useRef (SEM LOOPS)</h2>
          <p className="text-xs">Substitua a lógica de inicialização de voz por uma estrutura estável:</p>
          <pre className="bg-[#121212] p-4 rounded-lg border border-zinc-800 text-[10px] overflow-x-auto text-[#00D1FF]/80">
{`// Utilize referências para evitar reconexões desnecessárias
const channelRef = useRef<any>(null);
const localStreamRef = useRef<MediaStream | null>(null);
const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

// 1. O Microfone SÓ DEVE SER SOLICITADO UMA VEZ ao clicar para entrar na call
const joinVoiceChannel = async (channelId: string) => {
  if (channelRef.current) return; // Já conectado
  
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
  } catch (err) {
    console.warn("Microfone indisponível ou permissão negada. Entrando no modo ouvinte.");
    toast.warning("Não foi possível acessar o microfone. Você entrou como ouvinte.");
  }

  // 2. Conectar canal de Presence estático
  const voiceChannel = supabase.channel(\`voice-room-\${channelId}\`, {
    config: { presence: { key: user.id } }
  });

  voiceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = voiceChannel.presenceState();
      const users = Object.values(state).flat().map((p: any) => ({
        id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        isMuted: p.isMuted,
        isSpeaking: false
      }));
      setParticipants(users);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await voiceChannel.track({
          user_id: user.id,
          username: profile?.username || 'Usuário',
          display_name: profile?.display_name || 'Usuário',
          avatar_url: profile?.avatar_url,
          isMuted: false
        });
      }
    });

  channelRef.current = voiceChannel;
};`}
          </pre> section
        </section>

        <section className="space-y-4">
          <h2 className="text-[#00D1FF] font-semibold">2. COMPARTILHAMENTO DE TELA DIRETO NO STATE</h2>
          <p className="text-xs">Crie um estado const [screenStream, setScreenStream] = useState&lt;MediaStream | null&gt;(null);.</p>
          <p className="text-xs">Na função de compartilhar tela:</p>
          <pre className="bg-[#121212] p-4 rounded-lg border border-zinc-800 text-[10px] overflow-x-auto text-[#00D1FF]/80">
{`const handleShareScreen = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    setScreenStream(stream);
    
    // Se o usuário parar o compartilhamento pelo navegador
    stream.getVideoTracks()[0].onended = () => {
      setScreenStream(null);
    };
  } catch (err) {
    console.log("Compartilhamento cancelado");
  }
};`}
          </pre>
          <p className="text-xs">Na tela da chamada (VoiceRoom), se screenStream existir, renderize o player com srcObject:</p>
          <pre className="bg-[#121212] p-4 rounded-lg border border-zinc-800 text-[10px] overflow-x-auto text-[#00D1FF]/80">
{`{screenStream ? (
  <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-cyan-500/30">
    <video
      ref={(el) => { if (el) el.srcObject = screenStream; }}
      autoPlay
      playsInline
      className="w-full h-full object-contain"
    />
  </div>
) : (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    {/* Grid de participantes */}
  </div>
)}`}
          </pre>
        </section>

        <section className="space-y-4 border-t border-zinc-800 pt-4">
          <h2 className="text-[#00D1FF] font-semibold">3. LIMPEZA TOTAL AO SAIR DA CALL</h2>
          <ul className="text-xs space-y-2 list-disc pl-4">
            <li>Pare todas as faixas: localStreamRef.current?.getTracks().forEach(t =&gt; t.stop()).</li>
            <li>Pare a tela: screenStream?.getTracks().forEach(t =&gt; t.stop()).</li>
            <li>Desconecte o canal: channelRef.current?.untrack(); supabase.removeChannel(channelRef.current); channelRef.current = null;.</li>
            <li>Limpe os estados (setParticipants([]), setScreenStream(null)).</li>
          </ul>
        </section>

        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
          <h3 className="text-red-500 text-xs font-bold mb-2 uppercase">Validação Obrigatória</h3>
          <ul className="text-[10px] space-y-1 text-zinc-300">
            <li>• Os toasts repetitivos de "Erro ao acessar microfone" DEVEM PARAR completamente.</li>
            <li>• A lista de participantes NÃO DEVE MAIS PISCAR e ambas as contas devem aparecer estáveis.</li>
            <li>• Ao clicar em "Compartilhar Tela", o vídeo da sua tela deve aparecer grande no centro da sala.</li>
          </ul>
        </div>
      </div>
    </div>
  ),
});
