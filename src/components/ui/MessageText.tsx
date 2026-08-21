import React from "react";

/**
 * Renderizador leve de markdown para mensagens do Lume.
 * Suporta: **negrito**, quebras de linha preservadas e emojis nativos.
 * Não usa dangerouslySetInnerHTML (evita injeção de HTML).
 */
export function MessageText({ content, className = "" }: { content: string; className?: string }) {
  const renderMessageContent = (text: string) => {
    return (
      <div className="flex flex-col gap-0.5">
        {text.split('\n').map((line, lIdx) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={lIdx} className={line.trim().length === 0 ? "min-h-[1rem]" : ""}>
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={pIdx} className="font-bold text-white">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <React.Fragment key={pIdx}>{part}</React.Fragment>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`text-sm text-zinc-300 leading-relaxed break-words whitespace-pre-wrap ${className}`}>
      {renderMessageContent(content)}
    </div>
  );
}

export default MessageText;
