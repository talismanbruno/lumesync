import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => (
    <div className="min-h-screen bg-[#050505] text-zinc-400 p-8 font-mono text-xs overflow-auto">
      <div className="max-w-3xl mx-auto space-y-6 whitespace-pre-wrap">
        <h1 className="text-[#00D1FF] text-lg font-bold">CORREÇÃO CRÍTICA DE WEBRTC: RENEGOCIAÇÃO DE STREAM DE VÍDEO (OFFER/ANSWER PARA SCREEN SHARE)</h1>
        
        <p className="text-red-400">Problema: Ao clicar em "Assistir Transmissão", aparece o aviso "Aguardando sinal de vídeo do participante..." porque o WebRTC não está executando a renegociação de SDP ao adicionar a faixa de vídeo na conexão ativa.</p>
        
        <div className="space-y-4">
          <h2 className="text-zinc-200 font-bold border-b border-zinc-800 pb-2">TAREFAS DE CORREÇÃO NO useVoiceRoom.ts:</h2>
          
          <section>
            <h3 className="text-[#00D1FF] mb-2">1. RENEGOCIAÇÃO AO COMPARTILHAR TELA:</h3>
            <p>Quando o usuário transmissor adicionar o track da tela (screenStream.getVideoTracks()[0]):</p>
            <pre className="bg-[#121212] p-4 rounded border border-zinc-800 mt-2 overflow-x-auto text-zinc-300">
{`// 1. Adiciona a faixa de vídeo em todas as conexões peer ativas
peerConnections.current.forEach(async (pc, peerId) => {
  const videoTrack = screenStream.getVideoTracks()[0];
  pc.addTrack(videoTrack, screenStream);
  
  // 2. CRIA UM NOVO OFFER DE RENEGOCIAÇÃO
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  // 3. Envia o novo offer via broadcast
  voiceChannelRef.current?.send({
    type: 'broadcast',
    event: 'screen-offer',
    payload: { fromUserId: user.id, toUserId: peerId, sdp: offer }
  });
});`}
            </pre>
          </section>

          <section>
            <h3 className="text-[#00D1FF] mb-2">2. RECEPTOR PROCESSA O NOVO OFFER E RESPONDE COM ANSWER:</h3>
            <p>No listener de broadcast do Supabase Realtime:</p>
            <pre className="bg-[#121212] p-4 rounded border border-zinc-800 mt-2 overflow-x-auto text-zinc-300">
{`// Ao receber 'screen-offer'
voiceChannel.on('broadcast', { event: 'screen-offer' }, async ({ payload }) => {
  if (payload.toUserId !== user.id) return;
  const pc = peerConnections.current.get(payload.fromUserId);
  if (!pc) return;
  
  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  
  // Responde com o answer de volta
  voiceChannel.send({
    type: 'broadcast',
    event: 'screen-answer',
    payload: { fromUserId: user.id, toUserId: payload.fromUserId, sdp: answer }
  });
});

// Ao receber 'screen-answer'
voiceChannel.on('broadcast', { event: 'screen-answer' }, async ({ payload }) => {
  if (payload.toUserId !== user.id) return;
  const pc = peerConnections.current.get(payload.fromUserId);
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
});`}
            </pre>
          </section>

          <section>
            <h3 className="text-[#00D1FF] mb-2">3. CAPTURA DO TRACK DE VÍDEO NO pc.ontrack:</h3>
            <p>No evento pc.ontrack de cada conexão:</p>
            <pre className="bg-[#121212] p-4 rounded border border-zinc-800 mt-2 overflow-x-auto text-zinc-300">
{`pc.ontrack = (event) => {
  const [stream] = event.streams;
  if (event.track.kind === 'video') {
    // Salva o stream de vídeo remoto imediatamente
    remoteVideoStreams.current.set(peerUserId, stream);
    setRemoteStreamsVersion(v => v + 1);
    toast.success("Transmissão de vídeo recebida!");
  } else if (event.track.kind === 'audio') {
    playRemoteAudio(peerUserId, stream);
  }
};`}
            </pre>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800">
          <h2 className="text-zinc-200 font-bold mb-4">VALIDAÇÃO OBRIGATÓRIA:</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Na conta Brunao, compartilhe uma janela ou aba do navegador.</li>
            <li>Na conta admin, clique em "Assistir Transmissão".</li>
            <li>O vídeo do Brunao deve abrir no player central imediatamente, exibindo a tela compartilhada em tempo real e sem o toast de aviso.</li>
          </ul>
        </div>

        <div className="mt-8 p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-lg">
          <p className="text-[#00D1FF] font-bold">IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.</p>
        </div>
      </div>
    </div>
  )
});
