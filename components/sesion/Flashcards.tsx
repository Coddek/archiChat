"use client";

// Modo estudio: tarjetas de repaso de una sesión, a pantalla completa.
// La tarjeta se da vuelta, se marca si se sabía o no, y al final se pueden
// repasar solo las que faltan o bajar todo en un archivo que Anki importa directo.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Download, RotateCcw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toAnkiTSV, type Tarjeta } from "@/lib/estudio";

interface Props {
  tarjetas: Tarjeta[];
  titulo?: string;
  onClose: () => void;
}

const CARA =
  "absolute inset-0 flex flex-col rounded-3xl p-6 sm:p-10 text-white shadow-2xl [backface-visibility:hidden]";
const ETIQUETA = "text-xs font-bold uppercase tracking-[0.2em] text-white/70";

export function Flashcards({ tarjetas, titulo = "sesion", onClose }: Props) {
  const todas = tarjetas.map((_, i) => i);
  // La cola son los índices de las tarjetas de esta vuelta (todas, o las que faltan)
  const [cola, setCola] = useState<number[]>(todas);
  const [pos, setPos] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [sabidas, setSabidas] = useState<Set<number>>(new Set());

  const terminado = pos >= cola.length;
  const tarjeta = terminado ? null : tarjetas[cola[pos]];
  const faltan = todas.filter(i => !sabidas.has(i));

  function ir(nuevo: number) {
    if (nuevo < 0) return;
    setPos(nuevo);
    setVolteada(false);
  }

  function marcar(sabia: boolean) {
    if (terminado) return;
    const id = cola[pos];
    setSabidas(prev => {
      const s = new Set(prev);
      if (sabia) s.add(id);
      else s.delete(id);
      return s;
    });
    ir(pos + 1);
  }

  function empezar(indices: number[], borrarAvance = false) {
    if (borrarAvance) setSabidas(new Set());
    setCola(indices);
    ir(0);
  }

  function exportar() {
    const url = URL.createObjectURL(new Blob([toAnkiTSV(tarjetas)], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[\\/:*?"<>|]/g, "-")} - tarjetas.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Mientras está abierto, la página de atrás no scrollea
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, []);

  // Atajos de teclado. Sin lista de dependencias: se vuelve a registrar en cada
  // render, así siempre ve el estado actual.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (terminado) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setVolteada(v => !v); }
      else if (e.key === "ArrowRight") ir(pos + 1);
      else if (e.key === "ArrowLeft") ir(pos - 1);
      else if (e.key === "1") marcar(false);
      else if (e.key === "2") marcar(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo estudio"
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
    >
      {/* Encabezado: título, avance y cerrar */}
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Modo estudio</div>
          <div className="truncate text-sm font-medium">{titulo}</div>
        </div>
        <div className="text-sm tabular-nums text-muted-foreground">
          {Math.min(pos + 1, cola.length)} / {cola.length}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" className="rounded-full">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="mx-auto mt-3 w-full max-w-3xl px-4 sm:px-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${cola.length ? (Math.min(pos, cola.length) / cola.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 overflow-y-auto px-4 py-6 sm:px-6">
        {tarjeta ? (
          <>
            {/* key: cada tarjeta nueva entra del lado de la pregunta, sin mostrar la respuesta al girar */}
            <div
              key={`${cola[pos]}-${pos}`}
              role="button"
              tabIndex={0}
              aria-label={volteada ? "Ver la pregunta" : "Ver la respuesta"}
              onClick={() => setVolteada(v => !v)}
              className="h-[min(26rem,52vh)] cursor-pointer select-none outline-none [perspective:1600px] animate-in fade-in zoom-in-95 duration-300"
            >
              <div
                className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
                  volteada ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                <div className={`${CARA} bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600`}>
                  <div className={ETIQUETA}>Pregunta</div>
                  <p className="my-auto text-balance text-center text-2xl font-semibold leading-snug sm:text-3xl">
                    {tarjeta.pregunta}
                  </p>
                  <div className="text-center text-xs text-white/70">Tocá o apretá espacio para ver la respuesta</div>
                </div>
                <div
                  className={`${CARA} bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 [transform:rotateY(180deg)]`}
                >
                  <div className={ETIQUETA}>Respuesta</div>
                  <div className="my-auto overflow-y-auto">
                    <p className="text-balance text-center text-lg leading-relaxed sm:text-xl">{tarjeta.respuesta}</p>
                  </div>
                  <div className="text-center text-xs text-white/70">¿La sabías?</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <Button
                variant="ghost" size="icon" onClick={() => ir(pos - 1)} disabled={pos === 0}
                aria-label="Anterior" className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => marcar(false)}
                className="h-12 flex-1 gap-2 rounded-2xl bg-amber-500 text-base text-white hover:bg-amber-600 sm:flex-none sm:px-8"
              >
                <RotateCcw className="h-4 w-4" /> A repasar
              </Button>
              <Button
                onClick={() => marcar(true)}
                className="h-12 flex-1 gap-2 rounded-2xl bg-emerald-600 text-base text-white hover:bg-emerald-700 sm:flex-none sm:px-8"
              >
                <Check className="h-4 w-4" /> La sabía
              </Button>
              <Button
                variant="ghost" size="icon" onClick={() => ir(pos + 1)}
                aria-label="Siguiente" className="rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <p className="hidden text-center text-xs text-muted-foreground sm:block">
              Espacio: dar vuelta · 1: a repasar · 2: la sabía · ← →: moverse · Esc: cerrar
            </p>
          </>
        ) : (
          <div className="mx-auto w-full max-w-md space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-emerald-500 text-white shadow-xl">
              <Trophy className="h-9 w-9" />
            </div>
            <div>
              <div className="text-4xl font-bold tabular-nums">
                {sabidas.size} <span className="text-muted-foreground">de {tarjetas.length}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {faltan.length === 0 ? "Las sabías todas." : `Te quedan ${faltan.length} para repasar.`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {faltan.length > 0 && (
                <Button onClick={() => empezar(faltan)} className="h-12 gap-2 rounded-2xl text-base">
                  <RotateCcw className="h-4 w-4" /> Repasar las que faltan
                </Button>
              )}
              <Button variant="outline" onClick={() => empezar(todas, true)} className="rounded-2xl">
                Empezar de nuevo
              </Button>
              <Button variant="outline" onClick={exportar} className="gap-2 rounded-2xl">
                <Download className="h-4 w-4" /> Bajar para Anki
              </Button>
              <Button variant="ghost" onClick={onClose} className="rounded-2xl text-muted-foreground">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
