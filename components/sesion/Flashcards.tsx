"use client";

// Modo estudio: tarjetas de repaso de una sesión. Se ve la pregunta, se toca
// para ver la respuesta, y se pueden bajar en un archivo que Anki importa directo.

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toAnkiTSV, type Tarjeta } from "@/lib/estudio";

interface Props {
  tarjetas: Tarjeta[];
  titulo?: string;
}

export function Flashcards({ tarjetas, titulo = "sesion" }: Props) {
  const [indice, setIndice] = useState(0);
  const [mostrarRespuesta, setMostrarRespuesta] = useState(false);
  const tarjeta = tarjetas[indice];

  function ir(nuevo: number) {
    setIndice((nuevo + tarjetas.length) % tarjetas.length);
    setMostrarRespuesta(false);
  }

  function exportar() {
    const url = URL.createObjectURL(new Blob([toAnkiTSV(tarjetas)], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[\\/:*?"<>|]/g, "-")} - tarjetas.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!tarjeta) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setMostrarRespuesta(v => !v)}
        className="w-full min-h-40 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-6 text-left transition-colors hover:border-primary/40"
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-2">
          {mostrarRespuesta ? "Respuesta" : "Pregunta"} · {indice + 1} de {tarjetas.length}
        </div>
        <p className="text-sm leading-relaxed">{mostrarRespuesta ? tarjeta.respuesta : tarjeta.pregunta}</p>
        {!mostrarRespuesta && <p className="text-[11px] text-muted-foreground mt-3">Tocá para ver la respuesta</p>}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => ir(indice - 1)} className="rounded-xl gap-1">
          <ChevronLeft className="w-4 h-4" /> Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => ir(indice + 1)} className="rounded-xl gap-1">
          Siguiente <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => ir(0)} className="rounded-xl gap-1 text-muted-foreground">
          <RotateCcw className="w-4 h-4" /> Empezar de nuevo
        </Button>
        <Button variant="ghost" size="sm" onClick={exportar} className="rounded-xl gap-1 text-muted-foreground ml-auto">
          <Download className="w-4 h-4" /> Bajar para Anki
        </Button>
      </div>
    </div>
  );
}
