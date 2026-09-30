"use client";

// Página de sesión en vivo: el usuario elige qué escuchar (pestaña, pantalla o
// micrófono), y la transcripción va apareciendo cada ~10 segundos.
// Durante la sesión se puede preguntar en vivo, acá o en la ventana flotante.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, AppWindow, Monitor, Mic, Pause, Play, Square,
  Loader2, CheckCircle2, AlertTriangle, PictureInPicture2, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { createTicker } from "@/lib/ticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAudioCapture, getAudioSupport, type AudioSource, type AudioSupport } from "@/hooks/useAudioCapture";
import { useTranscription } from "@/hooks/useTranscription";
import { useLiveQuestions } from "@/hooks/useLiveQuestions";
import { useDocumentPiP } from "@/hooks/useDocumentPiP";
import { LiveChat } from "@/components/sesion/LiveChat";
import { FloatingPanel } from "@/components/sesion/FloatingPanel";

type Fase = "configurar" | "en-curso" | "finalizando" | "finalizada";

const fuentes: { id: AudioSource; icon: LucideIcon; titulo: string; desc: string; requiereDisplay: boolean }[] = [
  { id: "pestana",   icon: AppWindow, titulo: "Pestaña del navegador", desc: "Meet, Zoom web, Teams, YouTube, clases grabadas", requiereDisplay: true },
  { id: "pantalla",  icon: Monitor,   titulo: "Audio de la computadora", desc: "Apps de escritorio: Zoom, Teams, Discord",     requiereDisplay: true },
  { id: "microfono", icon: Mic,       titulo: "Micrófono",              desc: "Clase o reunión presencial",                   requiereDisplay: false },
];

export default function SesionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fase, setFase]           = useState<Fase>("configurar");
  const [titulo, setTitulo]       = useState("");
  const [fuente, setFuente]       = useState<AudioSource>("pestana");
  const [incluirMic, setIncluirMic] = useState(false);
  const [soporte, setSoporte]     = useState<AudioSupport | null>(null);
  const [segundos, setSegundos]   = useState(0);

  const sesionIdRef = useRef<string | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const getSesionId = useCallback(() => sesionIdRef.current, []);
  const transcripcion = useTranscription(getSesionId);
  const pip = useDocumentPiP();
  const captura = useAudioCapture({
    onChunk: transcripcion.encolar,
    onSourceEnded: () => toast.warning("Se dejó de compartir el audio. Tocá Reanudar para volver a elegir la pestaña."),
  });
  const enVivo = useLiveQuestions(getSesionId, captura.elapsedSeconds);

  // Soporte del navegador (solo existe en el cliente)
  useEffect(() => {
    const s = getAudioSupport();
    setSoporte(s);
    if (!s.displayAudio) setFuente("microfono");
  }, []);

  // Reloj de la sesión (en un Worker: la pestaña suele estar oculta detrás del video)
  const { elapsedSeconds } = captura;
  useEffect(() => {
    if (fase !== "en-curso") return;
    return createTicker(1000, () => setSegundos(elapsedSeconds()));
  }, [fase, elapsedSeconds]);

  // Seguir el texto nuevo
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcripcion.transcripciones.length]);

  // Avisar antes de cerrar la pestaña con una sesión en curso
  useEffect(() => {
    if (fase !== "en-curso") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [fase]);

  async function iniciar() {
    // Primero el permiso: si el usuario cancela, no se crea una sesión vacía
    const ok = await captura.iniciar(fuente, fuente !== "microfono" && incluirMic);
    if (!ok) return;

    const { data: { user } } = await supabase.auth.getUser();
    const tituloFinal = titulo.trim() || `Sesión del ${new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    const { data, error } = await supabase
      .from("sesiones")
      .insert({ owner_id: user!.id, titulo: tituloFinal })
      .select("id")
      .single();

    if (error || !data) {
      await captura.detener();
      toast.error("No se pudo crear la sesión");
      return;
    }
    sesionIdRef.current = data.id;
    setTitulo(tituloFinal);
    setSegundos(0);
    transcripcion.reiniciar();
    enVivo.reiniciar();
    setFase("en-curso");
  }

  async function finalizar() {
    await captura.detener();          // entrega el último tramo
    setSegundos(captura.elapsedSeconds());
    setFase("finalizando");
    await transcripcion.esperarCola(); // espera que se transcriba todo
    const { error } = await supabase
      .from("sesiones")
      .update({ estado: "finalizada" })
      .eq("id", sesionIdRef.current!);
    if (error) toast.error("No se pudo marcar la sesión como finalizada");
    setFase("finalizada");
    pip.close();
  }

  function pausarReanudar() {
    if (captura.estado === "grabando") captura.pausar();
    else captura.reanudar();
  }

  const grabando = captura.estado === "grabando";
  const pausado  = captura.estado === "pausado";

  return (
    <div className="min-h-screen bg-transparent text-foreground">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 md:px-8 py-4">
        <div className={`${fase === "configurar" ? "max-w-4xl" : "max-w-6xl"} mx-auto flex items-center justify-between gap-4`}>
          <button
            onClick={() => router.push("/sesiones")}
            disabled={fase === "en-curso" || fase === "finalizando"}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
            Sesiones
          </button>

          {fase === "en-curso" && (
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {grabando && <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${grabando ? "bg-red-500" : "bg-muted-foreground"}`} />
              </span>
              <span className="font-mono text-sm tabular-nums">{formatTime(segundos)}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {grabando ? "Escuchando" : "En pausa"}
              </span>
            </div>
          )}

          <ThemeToggle />
        </div>
      </header>

      <main className={`${fase === "configurar" ? "max-w-4xl" : "max-w-6xl"} mx-auto px-4 md:px-8 py-8 md:py-12`}>
        <AnimatePresence mode="wait">

          {/* ── Configurar ──────────────────────────────────── */}
          {fase === "configurar" && (
            <motion.div key="config" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              <div className="space-y-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold">
                  Nueva sesión
                </Badge>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none">
                  ¿Qué querés <span className="text-primary">transcribir</span>?
                </h1>
                <p className="text-muted-foreground max-w-md text-base leading-relaxed">
                  Reproducí el video o entrá a la reunión, y archiChat va escribiendo todo lo que se dice.
                </p>
              </div>

              <Input
                placeholder="Nombre de la sesión (opcional)"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                maxLength={100}
                className="h-12 rounded-2xl bg-background/60 border-border/50"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                {fuentes.map(f => {
                  const disponible = !f.requiereDisplay || !!soporte?.displayAudio;
                  const Icon = f.icon;
                  const activa = fuente === f.id;
                  return (
                    <button
                      key={f.id}
                      disabled={!disponible}
                      onClick={() => setFuente(f.id)}
                      className={`text-left p-5 rounded-[20px] border transition-all ${
                        activa ? "border-primary/60 bg-primary/5 shadow-[0_0_30px_-10px_rgba(124,58,237,0.4)]" : "border-border/40 hover:border-primary/30"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Icon className={`w-5 h-5 mb-3 ${activa ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="font-bold text-sm tracking-tight">{f.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</div>
                    </button>
                  );
                })}
              </div>

              {fuente !== "microfono" && (
                <label className="flex items-center gap-3 text-sm text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={incluirMic} onChange={e => setIncluirMic(e.target.checked)} className="accent-primary w-4 h-4" />
                  Incluir también mi micrófono (para que se transcriba lo que yo digo en la reunión)
                </label>
              )}

              {/* Avisos de compatibilidad */}
              {soporte && !soporte.displayAudio && (
                <div className="flex items-start gap-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {soporte.isIOS
                      ? "En iPhone y iPad solo se puede usar el micrófono. Mantené la pantalla encendida y Safari abierto mientras dura la sesión."
                      : "Este navegador no puede capturar el audio de una pestaña o de la computadora. Para transcribir videos o reuniones usá Chrome o Edge en una computadora."}
                  </p>
                </div>
              )}
              {fuente !== "microfono" && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Al empezar, el navegador te va a pedir que elijas {fuente === "pestana" ? "la pestaña" : "la pantalla"}.
                  Activá <strong>{fuente === "pestana" ? "“Compartir audio de la pestaña”" : "“Compartir audio del sistema”"}</strong>, si no, no se escucha nada.
                </p>
              )}

              {captura.error && (
                <p className="text-sm text-red-400">{captura.error}</p>
              )}

              <Button
                onClick={iniciar}
                disabled={!soporte?.mediaRecorder || captura.estado === "pidiendo-permiso"}
                className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-[0_0_25px_rgba(124,58,237,0.2)] gap-2"
              >
                {captura.estado === "pidiendo-permiso"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Esperando permiso…</>
                  : <><Play className="w-4 h-4" /> Iniciar sesión</>}
              </Button>
            </motion.div>
          )}

          {/* ── En curso / finalizando / finalizada ─────────── */}
          {fase !== "configurar" && (
            <motion.div key="live" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-black tracking-tight">{titulo}</h1>

                {fase === "en-curso" && (
                  <div className="flex flex-wrap gap-2">
                    {pip.supported && (
                      <Button
                        variant="outline"
                        onClick={() => pip.pipWindow ? pip.close() : pip.open()}
                        className="rounded-2xl gap-2 border-primary/30 text-primary hover:bg-primary/5"
                      >
                        <PictureInPicture2 className="w-4 h-4" />
                        {pip.pipWindow ? "Cerrar ventana flotante" : "Ventana flotante"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={pausarReanudar}
                      disabled={captura.estado === "pidiendo-permiso"}
                      className="rounded-2xl gap-2"
                    >
                      {grabando ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Reanudar</>}
                    </Button>
                    <Button onClick={finalizar} className="rounded-2xl gap-2 bg-red-500 hover:bg-red-600 text-white">
                      <Square className="w-4 h-4" /> Finalizar
                    </Button>
                  </div>
                )}
              </div>

              {fase === "en-curso" && pip.supported && !pip.pipWindow && (
                <div className="flex items-start gap-3 rounded-2xl bg-primary/5 border border-primary/15 px-4 py-3">
                  <PictureInPicture2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    <strong>Abrí la ventana flotante y volvé al video:</strong> queda encima de todo, con la transcripción y el chat para preguntar sin salir de la reunión.
                  </p>
                </div>
              )}

              {captura.error && pausado && <p className="text-sm text-red-400">{captura.error}</p>}
              {transcripcion.error && <p className="text-xs text-amber-500">{transcripcion.error}</p>}

              <div className="grid gap-6 md:grid-cols-[1fr_380px]">
                {/* Transcripción */}
                <div className="rounded-[24px] border border-border/40 bg-card/50 backdrop-blur-md p-5 md:p-6 min-h-[50vh] max-h-[65vh] overflow-y-auto space-y-4">
                  {transcripcion.transcripciones.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      {fase === "en-curso" ? "Escuchando… el primer texto aparece a los ~10 segundos." : "No se transcribió nada en esta sesión."}
                    </p>
                  )}
                  {transcripcion.transcripciones.map((t, i) => (
                    <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                      <span className="font-mono text-[11px] text-muted-foreground pt-1 shrink-0 tabular-nums">{formatTime(t.timestampSegundos)}</span>
                      <p className="text-sm leading-relaxed">{t.texto}</p>
                    </div>
                  ))}
                  {transcripcion.procesando && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Transcribiendo…
                    </div>
                  )}
                  <div ref={transcriptEnd} />
                </div>

                {/* Preguntas en vivo */}
                <div className="rounded-[24px] border border-border/40 bg-card/50 backdrop-blur-md p-4 h-[65vh] flex flex-col">
                  <div className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Preguntar en vivo</div>
                  <div className="flex-1 min-h-0">
                    <LiveChat mensajes={enVivo.mensajes} cargando={enVivo.cargando} onPreguntar={enVivo.preguntar} />
                  </div>
                </div>
              </div>

              {fase === "finalizando" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Terminando de transcribir los últimos segundos…
                </div>
              )}
              {fase === "finalizada" && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl bg-emerald-500/5 border border-emerald-500/20 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Sesión guardada · {formatTime(segundos)}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={() => router.push("/sesiones")}>Ver sesiones</Button>
                    <Button className="rounded-2xl" onClick={() => { setFase("configurar"); setTitulo(""); sesionIdRef.current = null; }}>Nueva sesión</Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Ventana flotante: mismo estado que la página, renderizado en otra ventana */}
      {pip.pipWindow && createPortal(
        <FloatingPanel
          titulo={titulo}
          segundos={segundos}
          grabando={grabando}
          ocupado={captura.estado === "pidiendo-permiso" || fase !== "en-curso"}
          transcripciones={transcripcion.transcripciones}
          transcribiendo={transcripcion.procesando}
          mensajes={enVivo.mensajes}
          cargando={enVivo.cargando}
          onPreguntar={enVivo.preguntar}
          onPausarReanudar={pausarReanudar}
          onFinalizar={finalizar}
        />,
        pip.pipWindow.document.body
      )}
    </div>
  );
}
