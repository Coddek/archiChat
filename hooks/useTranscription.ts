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

// Esperas entre reintentos (sin internet, límite de Groq, error del servidor):
// ~2,5 minutos en total antes de dar el tramo por perdido
const RETRY_DELAYS_MS = [3_000, 6_000, 12_000, 24_000, 48_000, 60_000];

class TranscripcionError extends Error {
  constructor(message: string, readonly reintentable: boolean) { super(message); }
}

function extensionFor(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

// Si no hay internet, espera a que vuelva
function esperarConexion() {
  if (navigator.onLine) return Promise.resolve();
  return new Promise<void>(resolve => window.addEventListener("online", () => resolve(), { once: true }));
}

export function useTranscription(
  getSesionId: () => string | null,
  getVocabulario: () => string = () => "",
) {
  const [transcripciones, setTranscripciones] = useState<Transcripcion[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);   // reintentando, sin conexión…
  const [silencios, setSilencios] = useState(0);

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
    form.append("vocabulario", getVocabulario().slice(0, 300));

    let res: Response;
    try {
      res = await fetch("/api/transcribir", { method: "POST", body: form });
    } catch {
      throw new TranscripcionError("Sin conexión", true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 429 (límite) y 5xx se reintentan; 4xx (datos inválidos, sesión ajena) no
      throw new TranscripcionError(data.error || "Error al transcribir", res.status === 429 || res.status >= 500);
    }
    return data.texto as string;
  }, [getVocabulario]);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    while (queueRef.current.length > 0) {
      const chunk = queueRef.current[0];
      const sesionId = getSesionId();
      if (!sesionId) break;

      let texto: string | null = null;
      for (let intento = 0; texto === null; intento++) {
        try {
          await esperarConexion();
          texto = await send(chunk, sesionId);
          setError(null);
          setAviso(null);
        } catch (e) {
          const err = e as TranscripcionError;
          if (!err.reintentable || intento >= RETRY_DELAYS_MS.length) {
            setAviso(null);
            setError(`Se perdió un tramo de audio (${err.message})`);
            break;
          }
          const espera = RETRY_DELAYS_MS[intento];
          setAviso(navigator.onLine
            ? `${err.message}. Reintentando en ${espera / 1000} s… (no se pierde nada)`
            : "Sin conexión a internet. Se transcribe todo cuando vuelva.");
          await esperar(espera);
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
    // Silencio (video en pausa, recreo): no se gasta cupo de Whisper
    if (chunk.silencioso) {
      setSilencios(n => n + 1);
      return;
    }
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
    setAviso(null);
    setSilencios(0);
  }, []);

  return {
    transcripciones, pendientes, procesando: pendientes > 0, error, aviso, silencios,
    encolar, esperarCola, reiniciar,
  };
}
