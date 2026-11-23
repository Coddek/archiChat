"use client";

// Contenido de la ventana flotante (Document Picture-in-Picture):
// reloj y controles, las últimas líneas de la transcripción, el chat en vivo
// y los conceptos detectados.

import { useEffect, useRef } from "react";
import { Pause, Play, Square, Loader2, Bookmark } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { LiveSidePanel } from "./LiveSidePanel";
import type { Transcripcion } from "@/hooks/useTranscription";
import type { MensajeEnVivo } from "@/hooks/useLiveQuestions";
import type { Concepto } from "@/hooks/useContextDetection";
import type { Nota } from "@/hooks/useSessionNotes";

// Líneas de transcripción visibles en la ventana (la completa está en la página)
const VISIBLE_LINES = 4;

interface Props {
  titulo: string;
  segundos: number;
  grabando: boolean;
  ocupado: boolean;          // pidiendo permiso, finalizando…
  transcripciones: Transcripcion[];
  transcribiendo: boolean;
  mensajes: MensajeEnVivo[];
  cargando: boolean;
  onPreguntar: (pregunta: string) => void;
  conceptos: Concepto[];
  analizando: boolean;
  notas: Nota[];
  notaError: string | null;
  onNota: (texto?: string) => void;
  aviso: string | null;      // reintentando, sin conexión…
  onPausarReanudar: () => void;
  onFinalizar: () => void;
}

export function FloatingPanel(props: Props) {
  const { titulo, segundos, grabando, ocupado, transcripciones, transcribiendo } = props;
  const endRef = useRef<HTMLDivElement>(null);
  const ultimas = transcripciones.slice(-VISIBLE_LINES);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [transcripciones.length]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground p-3 gap-3">
      {/* Reloj y controles */}
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${grabando ? "bg-live animate-live" : "bg-muted-foreground"}`} />
        <span className="tabular text-xs font-medium">{formatTime(segundos)}</span>
        <span className="text-xs font-medium truncate flex-1" title={titulo}>{titulo}</span>
        <button
          onClick={() => props.onNota()}
          disabled={ocupado}
          className="h-8 w-8 rounded-md border text-primary flex items-center justify-center hover:bg-secondary disabled:opacity-40"
          title="Marcar este momento"
        >
          <Bookmark className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={props.onPausarReanudar}
          disabled={ocupado}
          className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted/50 disabled:opacity-40"
          title={grabando ? "Pausar" : "Reanudar"}
        >
          {grabando ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={props.onFinalizar}
          disabled={ocupado}
          className="h-8 w-8 rounded-md bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 disabled:opacity-40"
          title="Finalizar"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Últimas líneas de la transcripción */}
      <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5 max-h-36 overflow-y-auto space-y-1.5 shrink-0">
        {ultimas.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Escuchando. El primer texto aparece a los diez segundos.</p>
        ) : ultimas.map((t, i) => (
          <p key={transcripciones.length - ultimas.length + i} className="font-read text-[12px] leading-snug text-foreground/90 animate-line-in">
            <span className="tabular text-muted-foreground mr-1.5">{formatTime(t.timestampSegundos)}</span>
            {t.texto}
          </p>
        ))}
        {transcribiendo && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="w-2.5 h-2.5 animate-spin" /> transcribiendo…</p>
        )}
        <div ref={endRef} />
      </div>

      {props.aviso && <p className="text-[11px] text-primary leading-snug -mt-1">{props.aviso}</p>}

      {/* Chat y conceptos */}
      <div className="flex-1 min-h-0">
        <LiveSidePanel
          mensajes={props.mensajes} cargando={props.cargando} onPreguntar={props.onPreguntar}
          conceptos={props.conceptos} analizando={props.analizando}
          notas={props.notas} notaError={props.notaError} onNota={props.onNota} compact
        />
      </div>
    </div>
  );
}
