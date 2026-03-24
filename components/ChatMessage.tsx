"use client";

// components/ChatMessage.tsx
// Componente que renderiza una sola burbuja de chat.
// Separado de la página principal para que cada archivo tenga
// una única responsabilidad: este dibuja mensajes, la página maneja lógica.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Props tipadas: le decimos exactamente qué datos necesita este componente
type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
};

export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={`flex gap-3 ${role === "user" ? "flex-row-reverse" : ""}`}>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="text-xs">
          {role === "user" ? "Vos" : "AI"}
        </AvatarFallback>
      </Avatar>
      <div
        className={`rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed ${
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border prose prose-sm prose-invert max-w-none"
        }`}
      >
        {role === "user" ? (
          content
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
              code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
              table: ({ children }) => (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr className="border-b border-border/50">{children}</tr>,
              th: ({ children }) => <th className="text-left py-1 px-2 font-semibold text-muted-foreground">{children}</th>,
              td: ({ children }) => <td className="py-1 px-2">{children}</td>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
                >
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
