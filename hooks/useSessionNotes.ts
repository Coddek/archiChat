// hooks/useSessionNotes.ts
// Notas rápidas y momentos marcados durante una sesión en vivo.
// Una nota sin texto es solo una marca: "esto es importante", con su minuto.
// Vive en la página, así la ventana flotante y la página muestran lo mismo.

"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Nota {
  texto: string;
  timestamp_segundos: number;
}

export const MAX_NOTA_LENGTH = 500;

export function useSessionNotes(getSesionId: () => string | null, getSegundos: () => number) {
  const [notas, setNotas] = useState<Nota[]>([]);   // más recientes primero
  const [error, setError] = useState<string | null>(null);

  const agregar = useCallback(async (texto = "") => {
    const sesionId = getSesionId();
    if (!sesionId) return;
    const nota: Nota = {
      texto: texto.trim().slice(0, MAX_NOTA_LENGTH),
      timestamp_segundos: Math.floor(getSegundos()),
    };

    // Aparece al instante; si no se pudo guardar, se saca y se avisa
    setNotas(prev => [nota, ...prev]);
    setError(null);
    // RLS verifica que la sesión sea del usuario
    const { error: saveError } = await createClient()
      .from("notas_sesion")
      .insert({ sesion_id: sesionId, ...nota });
    if (saveError) {
      console.error("No se pudo guardar la nota:", saveError);
      setNotas(prev => prev.filter(n => n !== nota));
      setError("No se pudo guardar la nota. Probá de nuevo.");
    }
  }, [getSesionId, getSegundos]);

  const reiniciar = useCallback(() => {
    setNotas([]);
    setError(null);
  }, []);

  return { notas, error, agregar, reiniciar };
}
