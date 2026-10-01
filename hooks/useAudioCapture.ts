// hooks/useAudioCapture.ts
// Captura audio de una pestaña, de la pantalla completa (audio del sistema)
// o del micrófono, y lo entrega en tramos de 10 segundos.
//
// Cada tramo es un archivo completo: en vez de usar MediaRecorder.start(timeslice)
// (solo el primer blob tendría el encabezado del webm y Whisper rechazaría el resto),
// cada 10 s se arranca un MediaRecorder nuevo y se detiene el anterior.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTicker } from "@/lib/ticker";

export type AudioSource = "pestana" | "pantalla" | "microfono";
export type CaptureState = "inactivo" | "pidiendo-permiso" | "grabando" | "pausado" | "detenido";

export interface AudioChunk {
  blob: Blob;
  mimeType: string;
  inicioSegundos: number;   // segundo de la sesión en que empieza el tramo
  duracionSegundos: number;
  silencioso: boolean;      // nadie habló ni sonó nada: no hace falta transcribirlo
}

export interface AudioSupport {
  mediaRecorder: boolean;
  displayAudio: boolean;    // captura de pestaña / sistema (solo Chrome y Edge de escritorio)
  isIOS: boolean;
  mimeType: string;
}

const CHUNK_MS = 10_000;
const MIN_CHUNK_SECONDS = 1;  // tramos más cortos (al pausar justo después de rotar) se descartan

// Medidor de volumen: cada 250 ms se mide el nivel (RMS) del audio. Si en todo
// el tramo nunca supera este umbral (~-48 dB), es silencio: video en pausa,
// recreo, nadie hablando. Así no se gasta cupo de Whisper en silencio.
const LEVEL_SAMPLE_MS = 250;
const SILENCE_RMS = 0.004;

// Qué puede hacer este navegador. Se llama en el cliente, después de montar.
export function getAudioSupport(): AudioSupport {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const mediaRecorder = typeof MediaRecorder !== "undefined";
  const isChromium = /Chrome|Edg\//.test(navigator.userAgent) && !/Mobile|Android/.test(navigator.userAgent);
  const mimeType = !mediaRecorder ? ""
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
  return {
    mediaRecorder,
    // Firefox y Safari tienen getDisplayMedia pero ignoran el audio
    displayAudio: !isIOS && isChromium && !!navigator.mediaDevices?.getDisplayMedia,
    isIOS,
    mimeType,
  };
}

// Mensaje entendible para los errores de permisos del navegador
function permissionError(error: unknown, source: AudioSource): string {
  const name = (error as DOMException)?.name;
  if (name === "NotAllowedError") {
    return source === "microfono"
      ? "No se dio permiso para usar el micrófono."
      : "Se canceló la selección de pestaña o pantalla.";
  }
  if (name === "NotFoundError") return "No se encontró ningún micrófono.";
  return "No se pudo acceder al audio.";
}

interface Options {
  onChunk: (chunk: AudioChunk) => void;
  onSourceEnded?: () => void;   // el usuario dejó de compartir desde la barra del navegador
}

export function useAudioCapture({ onChunk, onSourceEnded }: Options) {
  const [estado, setEstado] = useState<CaptureState>("inactivo");
  const [error, setError] = useState<string | null>(null);

  const streamsRef   = useRef<MediaStream[]>([]);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const recordStream = useRef<MediaStream | null>(null);
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const stopTickerRef = useRef<(() => void) | null>(null);
  const configRef    = useRef<{ source: AudioSource; includeMic: boolean } | null>(null);

  // Medidor de volumen
  const meterCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const peakRef      = useRef(0);                         // nivel máximo del tramo en curso
  const chunkPeaks   = useRef(new WeakMap<MediaRecorder, number>());
  const stopMeterRef = useRef<(() => void) | null>(null);

  // Tiempo grabado, sin contar las pausas
  const accumulatedRef = useRef(0);
  const resumedAtRef   = useRef<number | null>(null);

  // Los callbacks cambian en cada render: se leen desde refs
  const onChunkRef = useRef(onChunk);
  const onEndedRef = useRef(onSourceEnded);
  const pausarRef  = useRef<() => void>(() => {});
  onChunkRef.current = onChunk;
  onEndedRef.current = onSourceEnded;

  const elapsedSeconds = useCallback(() => {
    const running = resumedAtRef.current ? (Date.now() - resumedAtRef.current) / 1000 : 0;
    return accumulatedRef.current + running;
  }, []);

  // Arranca un MediaRecorder que al detenerse entrega su tramo completo
  const startRecorder = useCallback(() => {
    const stream = recordStream.current;
    if (!stream) return;
    const { mimeType } = getAudioSupport();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const parts: Blob[] = [];
    const inicio = elapsedSeconds();

    recorder.ondataavailable = e => { if (e.data.size > 0) parts.push(e.data); };
    recorder.onstop = () => {
      const duracion = elapsedSeconds() - inicio;
      if (parts.length === 0 || duracion < MIN_CHUNK_SECONDS) return;
      const type = recorder.mimeType || mimeType || "audio/webm";
      const peak = chunkPeaks.current.get(recorder) ?? Infinity;
      onChunkRef.current({
        blob: new Blob(parts, { type }),
        mimeType: type,
        inicioSegundos: Math.floor(inicio),
        duracionSegundos: Math.round(duracion),
        silencioso: peak < SILENCE_RMS,
      });
    };
    recorder.start();
    recorderRef.current = recorder;
  }, [elapsedSeconds]);

  // Guarda el nivel máximo del tramo que termina y empieza a medir el siguiente.
  // Si el medidor no está andando, el nivel queda "desconocido" y el tramo se manda igual.
  const closeChunkLevel = useCallback((recorder: MediaRecorder) => {
    const meterOk = analyserRef.current && meterCtxRef.current?.state === "running";
    chunkPeaks.current.set(recorder, meterOk ? peakRef.current : Infinity);
    peakRef.current = 0;
  }, []);

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    stopMeterRef.current = createTicker(LEVEL_SAMPLE_MS, () => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      peakRef.current = Math.max(peakRef.current, Math.sqrt(sum / buffer.length));
    });
  }, []);

  // Cada 10 s: arranca el recorder nuevo y recién después detiene el viejo (sin huecos).
  // El temporizador corre en un Worker para que no se frene con la pestaña oculta.
  const startRotation = useCallback(() => {
    peakRef.current = 0;
    startRecorder();
    startMeter();
    stopTickerRef.current = createTicker(CHUNK_MS, () => {
      const old = recorderRef.current;
      if (old) closeChunkLevel(old);
      startRecorder();
      if (old?.state === "recording") old.stop();
    });
  }, [startRecorder, startMeter, closeChunkLevel]);

  // Resuelve cuando el último tramo ya se entregó con onChunk
  const stopRotation = useCallback(() => {
    stopTickerRef.current?.();
    stopTickerRef.current = null;
    stopMeterRef.current?.();
    stopMeterRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) closeChunkLevel(recorder);
    if (recorder?.state !== "recording") return Promise.resolve();
    return new Promise<void>(resolve => {
      // Se registra después de onstop, así corre cuando el tramo ya se entregó
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
  }, [closeChunkLevel]);

  const releaseStreams = useCallback(() => {
    streamsRef.current.forEach(s => s.getTracks().forEach(t => { t.onended = null; t.stop(); }));
    streamsRef.current = [];
    recordStream.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    meterCtxRef.current?.close().catch(() => {});
    meterCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // Pide los permisos y arma el stream que se va a grabar
  const acquire = useCallback(async (source: AudioSource, includeMic: boolean) => {
    const streams: MediaStream[] = [];
    try {
      if (source !== "microfono") {
        // Permite quedarse en archiChat después de elegir la pestaña (Chrome 122+)
        const controller = "CaptureController" in window
          ? new (window as unknown as { CaptureController: new () => { setFocusBehavior(b: string): void } }).CaptureController()
          : undefined;
        // Chrome exige pedir video para compartir pestaña/pantalla; el video no se graba
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: source === "pestana" ? "browser" : "monitor" },
          audio: true,
          // Opciones de Chrome que no están en los tipos de TypeScript
          ...({ systemAudio: "include", selfBrowserSurface: "exclude", preferCurrentTab: false, controller } as object),
        });
        // Tiene que llamarse enseguida; con pantalla completa no aplica y tira error
        try { controller?.setFocusBehavior("no-focus-change"); } catch {}
        streams.push(display);
        if (display.getAudioTracks().length === 0) {
          throw new Error(source === "pestana"
            ? "No se compartió el audio. Volvé a intentarlo y activá \"Compartir audio de la pestaña\"."
            : "No se compartió el audio. Volvé a intentarlo y activá \"Compartir audio del sistema\".");
        }
        display.getVideoTracks().forEach(t => { t.enabled = false; });
        // Si el usuario corta el compartir desde la barra del navegador
        display.getTracks().forEach(t => {
          t.onended = () => { pausarRef.current(); onEndedRef.current?.(); };
        });
      }
      if (source === "microfono" || includeMic) {
        streams.push(await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }));
      }
    } catch (e) {
      streams.forEach(s => s.getTracks().forEach(t => t.stop()));
      throw e instanceof Error && !(e instanceof DOMException) ? e : new Error(permissionError(e, source));
    }

    streamsRef.current = streams;
    const audioTracks = streams.flatMap(s => s.getAudioTracks());
    if (streams.length === 1) {
      recordStream.current = new MediaStream(audioTracks);
    } else {
      // Pestaña/sistema + micrófono: se mezclan en un solo stream
      const ctx = new AudioContext();
      const destination = ctx.createMediaStreamDestination();
      streams.forEach(s => {
        if (s.getAudioTracks().length > 0) ctx.createMediaStreamSource(s).connect(destination);
      });
      audioCtxRef.current = ctx;
      recordStream.current = destination.stream;
    }

    // Medidor de volumen sobre lo mismo que se graba. Si el navegador no lo
    // permite, no pasa nada: los tramos se mandan todos, como antes.
    try {
      const meter = new AudioContext();
      const analyser = meter.createAnalyser();
      analyser.fftSize = 2048;
      meter.createMediaStreamSource(recordStream.current).connect(analyser);
      // Conectado a la salida con volumen 0: algunos navegadores no procesan
      // nodos que no terminan en la salida. No se escucha nada.
      const mute = meter.createGain();
      mute.gain.value = 0;
      analyser.connect(mute).connect(meter.destination);
      meterCtxRef.current = meter;
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }
  }, []);

  const iniciar = useCallback(async (source: AudioSource, includeMic = false) => {
    setError(null);
    setEstado("pidiendo-permiso");
    try {
      await acquire(source, includeMic);
    } catch (e) {
      setError((e as Error).message);
      setEstado("inactivo");
      return false;
    }
    configRef.current = { source, includeMic };
    accumulatedRef.current = 0;
    resumedAtRef.current = Date.now();
    startRotation();
    setEstado("grabando");
    return true;
  }, [acquire, startRotation]);

  const pausar = useCallback(() => {
    if (estado !== "grabando") return;
    stopRotation();   // entrega el tramo en curso
    accumulatedRef.current = elapsedSeconds();
    resumedAtRef.current = null;
    setEstado("pausado");
  }, [estado, stopRotation, elapsedSeconds]);

  pausarRef.current = pausar;

  // Si se dejó de compartir, vuelve a pedir la pestaña/pantalla
  const reanudar = useCallback(async () => {
    if (estado !== "pausado" || !configRef.current) return false;
    const alive = streamsRef.current.some(s => s.getAudioTracks().some(t => t.readyState === "live"));
    if (!alive) {
      releaseStreams();
      setEstado("pidiendo-permiso");
      try {
        await acquire(configRef.current.source, configRef.current.includeMic);
      } catch (e) {
        setError((e as Error).message);
        setEstado("pausado");
        return false;
      }
    }
    setError(null);
    resumedAtRef.current = Date.now();
    startRotation();
    setEstado("grabando");
    return true;
  }, [estado, acquire, releaseStreams, startRotation]);

  // Resuelve cuando el último tramo ya se entregó (para poder esperar su transcripción)
  const detener = useCallback(async () => {
    const lastChunk = stopRotation();
    accumulatedRef.current = elapsedSeconds();
    resumedAtRef.current = null;
    await lastChunk;
    releaseStreams();
    setEstado("detenido");
  }, [stopRotation, releaseStreams, elapsedSeconds]);

  // Si se sale de la página, se libera el micrófono / la pantalla
  useEffect(() => () => {
    stopTickerRef.current?.();
    releaseStreams();
  }, [releaseStreams]);

  return { iniciar, pausar, reanudar, detener, estado, error, elapsedSeconds };
}
