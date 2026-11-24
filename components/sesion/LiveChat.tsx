"use client";

// Chat de preguntas rápidas durante una sesión en vivo.
// Se usa en la página y en la ventana flotante: sin framer-motion, porque la
// ventana flotante sigue visible cuando la pestaña de archiChat está oculta
// y ahí las animaciones de framer-motion se congelan.

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Loader2 } from "lucide-react";
import type { MensajeEnVivo } from "@/hooks/useLiveQuestions";

const ACCIONES_RAPIDAS = [
  { label: "¿Qué dijo recién?",       pregunta: "¿Qué dijo en el último minuto? Resumilo en pocas palabras." },
  { label: "Explicámelo más simple",  pregunta: "Explicame lo último que se dijo de forma más simple, con un ejemplo." },
  { label: "Resumen hasta ahora",     pregunta: "Haceme un resumen corto de todo lo que se dijo hasta ahora." },
];

interface Props {
  mensajes: MensajeEnVivo[];
  cargando: boolean;
  onPreguntar: (pregunta: string) => void;
  compact?: boolean;
}

export function LiveChat({ mensajes, cargando, onPreguntar, compact = false }: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length, cargando]);

  function enviar(texto: string) {
    if (!texto.trim() || cargando) return;
    onPreguntar(texto);
    setInput("");
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className={`flex-1 min-h-0 overflow-y-auto space-y-3 ${compact ? "pr-1" : "pr-2"}`}>
        {mensajes.length === 0 && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Preguntá lo que no entendiste sin dejar de mirar. Las respuestas usan lo que se dijo en los últimos diez minutos.
          </p>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed animate-line-in ${
              m.role === "user"
                ? "bg-primary/15 text-foreground "
                : m.error
                  ? "bg-destructive/10 text-destructive "
                  : "bg-secondary text-foreground "
            }`}>
              {m.role === "assistant" && !m.error
                ? <div className="prose prose-sm dark:prose-invert max-w-none font-read prose-p:my-1 prose-ul:my-1 prose-li:my-0"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                : m.content}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Respondiendo
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5 pt-3">
        {ACCIONES_RAPIDAS.map(a => (
          <button
            key={a.label}
            onClick={() => enviar(a.pregunta)}
            disabled={cargando}
            className="text-xs px-2.5 py-1 rounded-md border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); enviar(input); }}
        className="flex items-center gap-2 pt-2"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Preguntá algo de la clase"
          maxLength={500}
          className="flex-1 min-w-0 h-10 rounded-md bg-background border px-3 text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={cargando || input.trim().length < 2}
          className="h-10 w-10 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          title="Preguntar"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
