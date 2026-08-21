import React from "react";

/**
 * Renderizador leve de markdown para mensagens do Lume.
 * Suporta: **negrito**, quebras de linha e emojis nativos.
 * Não usa dangerouslySetInnerHTML (evita injeção de HTML).
 */
export function MessageText({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.split("\n");

  return (
    <div className={`text-sm text-zinc-300 leading-relaxed break-words whitespace-pre-wrap ${className}`}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
              <strong key={j} className="font-bold text-white">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <React.Fragment key={j}>{part}</React.Fragment>
            )
          )}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default MessageText;
