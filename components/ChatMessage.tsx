"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { nivelRespaldo } from "@/lib/confianza";
import { partirSaltos, recortarFragmento } from "@/lib/respuesta";

// En las celdas de tabla, los <br> que escribe el modelo pasan a ser saltos reales
function conSaltos(children: React.ReactNode): React.ReactNode {
  const partes = Array.isArray(children) ? children : [children];
  return partes.flatMap((c, i) =>
    typeof c === "string"
      ? partirSaltos(c).flatMap((t, j) => (j === 0 ? [t] : [<br key={`${i}-${j}`} />, t]))
      : [c],
  );
}

export type Source = {
  content: string;
  chunk_index: number;
  similarity: number;
};

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number | null;
  streaming?: boolean;
};

// Las citas son lo distintivo de archiChat: van debajo de la respuesta, como notas al pie.
function Sources({ sources, confidence }: { sources: Source[]; confidence?: number | null }) {
  const [open, setOpen] = useState(false);
  const n = sources.length;
  const respaldo = confidence !== null && confidence !== undefined ? nivelRespaldo(confidence) : null;

  return (
    <div className="mt-5 border-t pt-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left text-muted-foreground hover:text-foreground"
      >
        {respaldo && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
              respaldo.nivel === "fuerte" && "bg-chalk-green/15 text-chalk-green",
              respaldo.nivel === "parcial" && "bg-primary/15 text-primary",
              respaldo.nivel === "debil" && "bg-chalk-pink/15 text-chalk-pink",
            )}
          >
            {respaldo.titulo}
          </span>
        )}
        <span>
          {respaldo
            ? `${n} ${n === 1 ? "fragmento" : "fragmentos"} del documento`
            : `Basada en ${n} partes repartidas por todo el documento`}
        </span>
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && respaldo && (
        <p className="mt-3 text-muted-foreground">{respaldo.explicacion}</p>
      )}

      {open && (
        <ol className="mt-4 space-y-4">
          {sources.map((s, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2">
              <span className="pt-0.5 text-muted-foreground tabular">{i + 1}.</span>
              <div>
                <blockquote className="border-l-2 border-primary/50 pl-3 font-read text-[0.95rem] leading-relaxed text-muted-foreground">
                  {recortarFragmento(s.content, s.chunk_index)}
                  {s.content.length >= 300 && "…"}
                </blockquote>
                <p className="mt-1.5 pl-3 text-xs text-muted-foreground">
                  Fragmento {s.chunk_index}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ChatMessage({ role, content, sources, confidence, streaming }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-secondary px-4 py-2.5 text-[0.95rem] leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  return (
    <article className="group/msg">
      <div className="prose-read text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>,
            ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>,
            code: ({ children }) => (
              <code className="rounded bg-secondary px-1.5 py-0.5 font-sans text-[0.85em]">{children}</code>
            ),
            table: ({ children }) => (
              <div className="my-5 overflow-x-auto rounded-md border font-sans text-sm">
                <table className="w-full text-left">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="border-b bg-secondary px-3 py-2 align-top font-medium">{conSaltos(children)}</th>,
            td: ({ children }) => <td className="border-t px-3 py-2 align-top">{conSaltos(children)}</td>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
        {streaming && (
          <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-primary animate-caret" aria-label="Escribiendo" />
        )}
      </div>

      {!streaming && (
        <>
          {sources && sources.length > 0 && <Sources sources={sources} confidence={confidence} />}
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover/msg:opacity-100"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiada" : "Copiar respuesta"}
          </button>
        </>
      )}
    </article>
  );
}
