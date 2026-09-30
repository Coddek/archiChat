// hooks/useTranscription.ts
// Recibe los tramos de audio de useAudioCapture y los manda de a uno a
// /api/transcribir (que además los guarda en Supabase).
// Si llega un tramo mientras otro se procesa, queda en cola: así el texto
// siempre aparece en orden y Whisper recibe como contexto lo último transcripto.

"use client";

import { useCallback, useRef, useState } from "react";
import type { AudioChunk } from "./useAudioCapture";

export interface Transcripcion {
  texto: string;
  timestampSegundos: number;
}

const RETRY_DELAY_MS = 3_000;

function extensionFor(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

export function useTranscription(getSesionId: () => string | null) {
  const [transcripciones, setTranscripciones] = useState<Transcripcion[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const queueRef   = useRef<AudioChunk[]>([]);
  const runningRef = useRef(false);
  const lastTextRef = useRef("");
  // Para esperar a que se vacíe la cola al finalizar la sesión
  const idleResolvers = useRef<(() => void)[]>([]);

  const send = useCallback(async (chunk: AudioChunk, sesionId: string) => {
    const form = new FormData();
    form.append("audio", new File([chunk.blob], `tramo.${extensionFor(chunk.mimeType)}`, { type: chunk.mimeType }));
    form.append("sesion_id", sesionId);
    form.append("timestamp_segundos", String(chunk.inicioSegundos));
    form.append("texto_previo", lastTextRef.current.slice(-200));
    const res = await fetch("/api/transcribir", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al transcribir");
    return data.texto as string;
  }, []);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    while (queueRef.current.length > 0) {
      const chunk = queueRef.current[0];
      const sesionId = getSesionId();
      if (!sesionId) break;

      let texto: string | null = null;
      // Un reintento: los errores de red o de límite suelen ser momentáneos
      for (let intento = 0; intento < 2 && texto === null; intento++) {
        try {
          texto = await send(chunk, sesionId);
          setError(null);
        } catch (e) {
          if (intento === 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          else setError(`Se perdió un tramo de audio (${(e as Error).message})`);
        }
      }

      if (texto) {
        lastTextRef.current = texto;
        setTranscripciones(prev => [...prev, { texto: texto!, timestampSegundos: chunk.inicioSegundos }]);
      }
      queueRef.current.shift();
      setPendientes(queueRef.current.length);
    }

    runningRef.current = false;
    idleResolvers.current.forEach(resolve => resolve());
    idleResolvers.current = [];
  }, [getSesionId, send]);

  const encolar = useCallback((chunk: AudioChunk) => {
    queueRef.current.push(chunk);
    setPendientes(queueRef.current.length);
    processQueue();
  }, [processQueue]);

  // Resuelve cuando no queda ningún tramo por transcribir
  const esperarCola = useCallback(() => {
    if (!runningRef.current && queueRef.current.length === 0) return Promise.resolve();
    return new Promise<void>(resolve => idleResolvers.current.push(resolve));
  }, []);

  const reiniciar = useCallback(() => {
    queueRef.current = [];
    lastTextRef.current = "";
    setTranscripciones([]);
    setPendientes(0);
    setError(null);
  }, []);

  return { transcripciones, pendientes, procesando: pendientes > 0, error, encolar, esperarCola, reiniciar };
}
