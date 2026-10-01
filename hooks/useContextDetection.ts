// hooks/useContextDetection.ts
// Detección automática de conceptos: junta lo que se va transcribiendo y cada
// ~20 segundos (2 tramos) o ~50 palabras lo manda a /api/analizar-concepto.
// Analizar cada tramo suelto daría poco contexto y el doble de pedidos.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Transcripcion } from "./useTranscription";

export interface Concepto {
  concepto: string;
  explicacion: string;
  timestamp_segundos: number;
}

const MIN_TRAMOS = 2;
const MIN_PALABRAS = 50;
const CONTEXTO_PALABRAS = 200;

const palabras = (t: string) => t.split(/\s+/).filter(Boolean);

export function useContextDetection(
  getSesionId: () => string | null,
  transcripciones: Transcripcion[],
  activo: boolean,
) {
  const [conceptos, setConceptos] = useState<Concepto[]>([]);   // más recientes primero
  const [analizando, setAnalizando] = useState(false);
  const analizadasRef = useRef(0);     // cuántas transcripciones ya se mandaron a analizar
  const enCursoRef = useRef(false);
  const conceptosRef = useRef<Concepto[]>([]);
  conceptosRef.current = conceptos;

  const analizar = useCallback(async (forzar = false) => {
    const sesionId = getSesionId();
    if (!sesionId || enCursoRef.current) return;

    const nuevas = transcripciones.slice(analizadasRef.current);
    const texto = nuevas.map(t => t.texto).join(" ");
    const suficiente = nuevas.length >= MIN_TRAMOS || palabras(texto).length >= MIN_PALABRAS;
    if (nuevas.length === 0 || (!suficiente && !forzar)) return;

    const previas = transcripciones.slice(0, analizadasRef.current).map(t => t.texto).join(" ");
    const contextoPrevio = palabras(previas).slice(-CONTEXTO_PALABRAS).join(" ");
    analizadasRef.current = transcripciones.length;
    enCursoRef.current = true;
    setAnalizando(true);

    try {
      const res = await fetch("/api/analizar-concepto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesionId,
          texto: texto.slice(0, 4000),
          contextoPrevio: contextoPrevio.slice(0, 4000),
          conocidos: conceptosRef.current.map(c => c.concepto).slice(0, 100),
          timestampSegundos: nuevas[0].timestampSegundos,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.conceptos) && data.conceptos.length > 0) {
        setConceptos(prev => [...[...data.conceptos].reverse(), ...prev]);
      }
    } catch {
      // Es una ayuda extra: si falla, la sesión sigue igual
    } finally {
      enCursoRef.current = false;
      setAnalizando(false);
    }
  }, [getSesionId, transcripciones]);

  // Cada vez que llega una transcripción nueva
  useEffect(() => {
    if (activo) analizar();
  }, [activo, transcripciones.length, analizar]);

  const reiniciar = useCallback(() => {
    analizadasRef.current = 0;
    setConceptos([]);
  }, []);

  // Nombres bien escritos de lo detectado: se usan como vocabulario para Whisper
  const nombres = conceptos.map(c => c.concepto);

  return { conceptos, analizando, nombres, analizarResto: () => analizar(true), reiniciar };
}
