// hooks/useLiveQuestions.ts
// Estado del chat de preguntas rápidas durante una sesión en vivo.
// Vive en la página, así la ventana flotante y la página muestran lo mismo.

"use client";

import { useCallback, useRef, useState } from "react";
import { formatTime } from "@/lib/utils";

export interface MensajeEnVivo {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  segundo?: number;   // minuto de la sesión en que se hizo la pregunta
}

// Preguntas y respuestas anteriores que se mandan para entender seguimientos
const HISTORY_LENGTH = 6;

export function useLiveQuestions(getSesionId: () => string | null, getSegundos: () => number) {
  const [mensajes, setMensajes] = useState<MensajeEnVivo[]>([]);
  const [cargando, setCargando] = useState(false);
  const mensajesRef = useRef<MensajeEnVivo[]>([]);
  mensajesRef.current = mensajes;

  const preguntar = useCallback(async (pregunta: string) => {
    const sesionId = getSesionId();
    const texto = pregunta.trim();
    if (!sesionId || texto.length < 2 || cargando) return;

    // Cada pregunta anterior lleva su minuto: así "¿qué me perdí desde lo último
    // que pregunté?" se puede responder
    const historial = mensajesRef.current
      .filter(m => !m.error)
      .slice(-HISTORY_LENGTH)
      .map(({ role, content, segundo }) => ({
        role,
        content: role === "user" && segundo !== undefined ? `[minuto ${formatTime(segundo)}] ${content}` : content,
      }));
    const segundo = Math.floor(getSegundos());

    setMensajes(prev => [...prev, { role: "user", content: texto, segundo }]);
    setCargando(true);
    try {
      const res = await fetch("/api/sesion-pregunta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesionId, pregunta: texto, historial, segundoActual: segundo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo responder");
      setMensajes(prev => [...prev, { role: "assistant", content: data.respuesta }]);
    } catch (e) {
      setMensajes(prev => [...prev, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setCargando(false);
    }
  }, [getSesionId, getSegundos, cargando]);

  const reiniciar = useCallback(() => setMensajes([]), []);

  return { mensajes, cargando, preguntar, reiniciar };
}
