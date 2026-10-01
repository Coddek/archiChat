"use client";

// Panel de la sesión en vivo con dos pestañas: el chat para preguntar y los
// conceptos que se detectan solos. Se usa en la página y en la ventana flotante
// (sin framer-motion: ver LiveChat).

import { useEffect, useState } from "react";
import { Lightbulb, MessageCircle, Loader2 } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { LiveChat } from "./LiveChat";
import type { MensajeEnVivo } from "@/hooks/useLiveQuestions";
import type { Concepto } from "@/hooks/useContextDetection";

type Tab = "chat" | "conceptos";

interface Props {
  mensajes: MensajeEnVivo[];
  cargando: boolean;
  onPreguntar: (pregunta: string) => void;
  conceptos: Concepto[];
  analizando: boolean;
  compact?: boolean;
}

export function LiveSidePanel({ mensajes, cargando, onPreguntar, conceptos, analizando, compact = false }: Props) {
  const [tab, setTab] = useState<Tab>("chat");
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
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
      tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 mb-3">
        <button className={tabClass("chat")} onClick={() => setTab("chat")}>
          <MessageCircle className="w-3.5 h-3.5" /> Preguntar
        </button>
        <button className={tabClass("conceptos")} onClick={() => setTab("conceptos")}>
          <Lightbulb className="w-3.5 h-3.5" /> Conceptos
          {conceptos.length > 0 && <span className="text-[10px] font-mono opacity-70">{conceptos.length}</span>}
          {sinVer > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        </button>
        {analizando && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      <div className="flex-1 min-h-0">
        {tab === "chat" ? (
          <LiveChat mensajes={mensajes} cargando={cargando} onPreguntar={onPreguntar} compact={compact} />
        ) : (
          <div className="h-full overflow-y-auto space-y-2.5 pr-1">
            {conceptos.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cuando aparezca un término técnico o una sigla, la explicación aparece acá sola, sin que preguntes.
              </p>
            ) : conceptos.map((c, i) => (
              <div key={`${c.concepto}-${c.timestamp_segundos}`}
                className={`rounded-xl border p-3 animate-in fade-in slide-in-from-top-1 duration-500 ${
                  i < sinVer ? "border-amber-400/40 bg-amber-400/5" : "border-border/40 bg-muted/20"
                }`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold">{c.concepto}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{formatTime(c.timestamp_segundos)}</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed mt-1">{c.explicacion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
