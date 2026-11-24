"use client";

// Panel de la sesión en vivo con dos pestañas: el chat para preguntar y los
// conceptos que se detectan solos. Se usa en la página y en la ventana flotante
// (sin framer-motion: ver LiveChat).

import { useEffect, useState } from "react";
import { Lightbulb, MessageCircle, Loader2, Bookmark, Plus } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { LiveChat } from "./LiveChat";
import type { MensajeEnVivo } from "@/hooks/useLiveQuestions";
import type { Concepto } from "@/hooks/useContextDetection";
import { MAX_NOTA_LENGTH, type Nota } from "@/hooks/useSessionNotes";

type Tab = "chat" | "conceptos" | "notas";

interface Props {
  mensajes: MensajeEnVivo[];
  cargando: boolean;
  onPreguntar: (pregunta: string) => void;
  conceptos: Concepto[];
  analizando: boolean;
  notas: Nota[];
  notaError: string | null;
  onNota: (texto?: string) => void;   // sin texto: solo marca el momento
  compact?: boolean;
}

export function LiveSidePanel({ mensajes, cargando, onPreguntar, conceptos, analizando, notas, notaError, onNota, compact = false }: Props) {
  const [tab, setTab] = useState<Tab>("chat");
  const [nota, setNota] = useState("");
  const [vistos, setVistos] = useState(0);
  const sinVer = tab === "conceptos" ? 0 : conceptos.length - vistos;

  useEffect(() => {
    if (tab === "conceptos") setVistos(conceptos.length);
  }, [tab, conceptos.length]);

  // Al empezar una sesión nueva la lista vuelve a cero
  useEffect(() => {
    if (conceptos.length === 0) setVistos(0);
  }, [conceptos.length]);

  const tabClass = (t: Tab) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
      tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 mb-3">
        <button className={tabClass("chat")} onClick={() => setTab("chat")}>
          <MessageCircle className="w-3.5 h-3.5" /> Preguntar
        </button>
        <button className={tabClass("conceptos")} onClick={() => setTab("conceptos")}>
          <Lightbulb className="w-3.5 h-3.5" /> Conceptos
          {conceptos.length > 0 && <span className="text-[10px] tabular opacity-70">{conceptos.length}</span>}
          {sinVer > 0 && <span className="w-1.5 h-1.5 rounded-full bg-chalk-blue" aria-label="Conceptos nuevos" />}
        </button>
        <button className={tabClass("notas")} onClick={() => setTab("notas")}>
          <Bookmark className="w-3.5 h-3.5" /> Notas
          {notas.length > 0 && <span className="text-[10px] tabular opacity-70">{notas.length}</span>}
        </button>
        {analizando && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      <div className="flex-1 min-h-0">
        {tab === "chat" ? (
          <LiveChat mensajes={mensajes} cargando={cargando} onPreguntar={onPreguntar} compact={compact} />
        ) : tab === "notas" ? (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {notas.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Marcá un momento importante o escribí una nota corta. Quedan con su minuto y aparecen en el resumen.
                </p>
              ) : notas.map((n, i) => (
                <div key={notas.length - i} className="flex gap-2 rounded-md border-l-2 border-primary bg-secondary/60 px-3 py-2 animate-line-in">
                  <span className="tabular text-[10px] text-muted-foreground pt-0.5 shrink-0">{formatTime(n.timestamp_segundos)}</span>
                  <p className={"text-xs leading-relaxed " + (n.texto ? "text-foreground/90" : "text-muted-foreground italic")}>
                    {n.texto || "Momento marcado"}
                  </p>
                </div>
              ))}
            </div>
            {notaError && <p className="text-[11px] text-destructive pt-2">{notaError}</p>}
            <form
              onSubmit={e => { e.preventDefault(); onNota(nota); setNota(""); }}
              className="flex items-center gap-2 pt-2"
            >
              <input
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Nota rápida (vacío: solo marca el momento)"
                maxLength={MAX_NOTA_LENGTH}
                className="flex-1 min-w-0 h-10 rounded-md bg-background border px-3 text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="h-10 w-10 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center"
                title={nota.trim() ? "Guardar nota" : "Marcar este momento"}
              >
                {nota.trim() ? <Plus className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            </form>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-2.5 pr-1">
            {conceptos.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cuando aparezca un término técnico o una sigla, la explicación aparece acá sola, sin que preguntes.
              </p>
            ) : conceptos.map((c, i) => (
              <div key={`${c.concepto}-${c.timestamp_segundos}`}
                className={`rounded-md border-l-2 border-chalk-blue py-2.5 pl-3 pr-2 animate-line-in ${
                  i < sinVer ? "bg-chalk-blue/15" : "bg-chalk-blue/5"
                }`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-chalk-blue">{c.concepto}</span>
                  <span className="tabular text-[10px] text-muted-foreground">{formatTime(c.timestamp_segundos)}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">{c.explicacion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
