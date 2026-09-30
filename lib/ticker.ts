// lib/ticker.ts
// Temporizador que sigue andando aunque la pestaña esté oculta.
//
// Chrome frena los setInterval de las pestañas que no se ven (y después de
// 5 minutos los lleva a una vez por minuto). Durante una sesión la pestaña de
// archiChat casi siempre está oculta detrás del video, así que el reloj corre
// dentro de un Web Worker, que no tiene ese freno, y avisa con un mensaje.

export function createTicker(intervalMs: number, onTick: () => void): () => void {
  if (typeof Worker === "undefined") {
    const id = setInterval(onTick, intervalMs);
    return () => clearInterval(id);
  }
  const code = `setInterval(() => postMessage(0), ${intervalMs});`;
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const worker = new Worker(url);
  worker.onmessage = () => onTick();
  return () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}
