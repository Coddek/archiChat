"use client";

// Página de sesión en vivo: el usuario elige qué escuchar (pestaña, pantalla o
// micrófono), y la transcripción va apareciendo cada ~10 segundos.
// Durante la sesión se puede preguntar en vivo, acá o en la ventana flotante.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, AppWindow, Monitor, Mic, Pause, Play, Square,
  Loader2, PictureInPicture2, Bookmark, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { createTicker } from "@/lib/ticker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAudioCapture, getAudioSupport, type AudioSource, type AudioSupport } from "@/hooks/useAudioCapture";
import { useTranscription } from "@/hooks/useTranscription";
import { useLiveQuestions } from "@/hooks/useLiveQuestions";
import { useContextDetection } from "@/hooks/useContextDetection";
import { useDocumentPiP } from "@/hooks/useDocumentPiP";
import { useSessionNotes } from "@/hooks/useSessionNotes";
import { LiveSidePanel } from "@/components/sesion/LiveSidePanel";
import { FloatingPanel } from "@/components/sesion/FloatingPanel";
import { SessionSummary } from "@/components/sesion/SessionSummary";

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
  const [etapaFinal, setEtapaFinal] = useState<"transcribiendo" | "resumiendo">("transcribiendo");
  const [resumen, setResumen]     = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  const sesionIdRef = useRef<string | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const resumenRef = useRef<HTMLDivElement>(null);

  const getSesionId = useCallback(() => sesionIdRef.current, []);
  // Vocabulario para Whisper: el título (si lo escribió el usuario) y los
  // conceptos detectados, bien escritos. Así mejora a medida que avanza la sesión.
  const vocabularioRef = useRef("");
  const getVocabulario = useCallback(() => vocabularioRef.current, []);
  const transcripcion = useTranscription(getSesionId, getVocabulario);
  const pip = useDocumentPiP();
  const captura = useAudioCapture({
    onChunk: transcripcion.encolar,
    onSourceEnded: () => toast.warning("Se dejó de compartir el audio. Tocá Reanudar para volver a elegir la pestaña."),
  });
  const enVivo = useLiveQuestions(getSesionId, captura.elapsedSeconds);
  const deteccion = useContextDetection(getSesionId, transcripcion.transcripciones, fase === "en-curso");
  const apuntes = useSessionNotes(getSesionId, captura.elapsedSeconds);

  useEffect(() => {
    const tituloUtil = titulo.startsWith("Sesión del ") ? "" : titulo;
    vocabularioRef.current = [tituloUtil, ...deteccion.nombres].filter(Boolean).join(", ").slice(0, 300);
  }, [titulo, deteccion.nombres]);

  // En iPhone, Safari congela la página al pasar a segundo plano: se pausa
  // a propósito para que no quede un hueco sin aviso
  const { pausar: pausarCaptura } = captura;
  useEffect(() => {
    if (!soporte?.isIOS || captura.estado !== "grabando") return;
    const onHide = () => {
      if (document.hidden) {
        pausarCaptura();
        toast.warning("Se pausó la sesión porque Safari pasó a segundo plano. Tocá Reanudar para seguir.");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [soporte?.isIOS, captura.estado, pausarCaptura]);

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

  // Mostrar el resumen apenas está listo
  useEffect(() => {
    if (resumen) resumenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resumen]);

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
      toast.error("No se pudo crear la sesión. Probá de nuevo.");
      return;
    }
    sesionIdRef.current = data.id;
    setTitulo(tituloFinal);
    setSegundos(0);
    transcripcion.reiniciar();
    enVivo.reiniciar();
    deteccion.reiniciar();
    apuntes.reiniciar();
    setResumen(null);
    setDocumentId(null);
    setFase("en-curso");
  }

  async function finalizar() {
    await captura.detener();          // entrega el último tramo
    setSegundos(captura.elapsedSeconds());
    setEtapaFinal("transcribiendo");
    setFase("finalizando");
    pip.close();
    await transcripcion.esperarCola(); // espera que se transcriba todo

    // Resumen + documento para el chat normal
    setEtapaFinal("resumiendo");
    try {
      const res = await fetch("/api/finalizar-sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesionId: sesionIdRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo generar el resumen");
      if (data.error) toast.warning(data.error);
      setResumen(data.resumen);
      setDocumentId(data.documentId);
    } catch (e) {
      toast.error(`${(e as Error).message}. Podés generarlo después desde Sesiones.`);
    }
    setFase("finalizada");
  }

  function pausarReanudar() {
    if (captura.estado === "grabando") captura.pausar();
    else captura.reanudar();
  }

  const grabando = captura.estado === "grabando";
  const pausado  = captura.estado === "pausado";

  const ancho = fase === "configurar" ? "max-w-3xl" : "max-w-6xl";
  const btn = "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className={`${ancho} mx-auto flex h-14 items-center justify-between gap-4 px-5 sm:px-8`}>
          <button
            type="button"
            onClick={() => router.push("/sesiones")}
            disabled={fase === "en-curso" || fase === "finalizando"}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Sesiones
          </button>

          {fase === "en-curso" && (
            <div className="flex items-center gap-2.5 text-sm" role="status">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${grabando ? "bg-live animate-live" : "bg-muted-foreground"}`}
              />
              <span className="font-medium tabular">{formatTime(segundos)}</span>
              <span className="hidden text-muted-foreground sm:inline">{grabando ? "Escuchando" : "En pausa"}</span>
            </div>
          )}

          <ThemeToggle />
        </div>
      </header>

      <div className={`${ancho} mx-auto px-5 py-10 sm:px-8 sm:py-12`}>

        {fase === "configurar" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Nueva sesión</h1>
              <p className="mt-2 max-w-lg text-muted-foreground">
                Poné el video o entrá a la reunión, elegí de dónde sale el audio y archiChat va
                escribiendo lo que se dice.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sesion-titulo">Nombre</Label>
              <Input
                id="sesion-titulo"
                placeholder="Opcional. Por ejemplo: Economía, clase 4"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                maxLength={100}
                className="h-11"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Qué escuchar</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                {fuentes.map(f => {
                  const disponible = !f.requiereDisplay || !!soporte?.displayAudio;
                  const Icon = f.icon;
                  const activa = fuente === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={activa}
                      disabled={!disponible}
                      onClick={() => setFuente(f.id)}
                      className={`rounded-lg border p-4 text-left hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                        activa ? "border-primary bg-secondary/60" : ""
                      }`}
                    >
                      <Icon className={`mb-3 h-5 w-5 ${activa ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="block text-sm font-medium">{f.titulo}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{f.desc}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {fuente !== "microfono" && (
              <label className="flex cursor-pointer select-none items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={incluirMic}
                  onChange={e => setIncluirMic(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span>
                  Incluir también mi micrófono
                  <span className="block text-muted-foreground">Para que se transcriba lo que digo en la reunión.</span>
                </span>
              </label>
            )}

            {soporte && !soporte.displayAudio && (
              <p className="border-l-2 border-primary pl-3 text-sm leading-relaxed">
                {soporte.isIOS
                  ? "En iPhone y iPad solo se puede usar el micrófono. Mantené la pantalla encendida y Safari abierto mientras dura la sesión."
                  : "Este navegador no puede capturar el audio de una pestaña o de la computadora. Para transcribir videos o reuniones usá Chrome o Edge en una computadora."}
              </p>
            )}
            {fuente !== "microfono" && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Al empezar, el navegador te pide que elijas {fuente === "pestana" ? "la pestaña" : "la pantalla"}.
                Activá <strong className="font-medium text-foreground">{fuente === "pestana" ? "«Compartir audio de la pestaña»" : "«Compartir audio del sistema»"}</strong>;
                si no, no se escucha nada.
              </p>
            )}

            {captura.error && <p className="text-sm text-destructive" role="alert">{captura.error}</p>}

            <button
              type="button"
              onClick={iniciar}
              disabled={!soporte?.mediaRecorder || captura.estado === "pidiendo-permiso"}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {captura.estado === "pidiendo-permiso"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Esperando el permiso</>
                : "Empezar a escuchar"}
            </button>
          </div>
        )}

        {fase !== "configurar" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>

              {fase === "en-curso" && (
                <div className="flex flex-wrap gap-2">
                  {pip.supported && (
                    <button type="button" onClick={() => pip.pipWindow ? pip.close() : pip.open()} className={btn}>
                      <PictureInPicture2 className="h-4 w-4" />
                      {pip.pipWindow ? "Cerrar ventana flotante" : "Ventana flotante"}
                    </button>
                  )}
                  <button type="button" onClick={() => apuntes.agregar()} title="Queda con su minuto y aparece en el resumen" className={btn}>
                    <Bookmark className="h-4 w-4" /> Marcar momento
                  </button>
                  <button type="button" onClick={pausarReanudar} disabled={captura.estado === "pidiendo-permiso"} className={btn}>
                    {grabando ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Reanudar</>}
                  </button>
                  <button
                    type="button"
                    onClick={finalizar}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
                  >
                    <Square className="h-3.5 w-3.5" /> Finalizar
                  </button>
                </div>
              )}
            </div>

            {fase === "en-curso" && pip.supported && !pip.pipWindow && (
              <p className="border-l-2 border-primary pl-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Abrí la ventana flotante y volvé al video.</span>{" "}
                Queda encima de todo, con la transcripción y el chat, para preguntar sin salir de la reunión.
              </p>
            )}

            {captura.error && pausado && <p className="text-sm text-destructive" role="alert">{captura.error}</p>}
            {transcripcion.error && <p className="text-sm text-destructive">{transcripcion.error}</p>}
            {transcripcion.aviso && <p className="text-sm text-muted-foreground">{transcripcion.aviso}</p>}

            <div className="grid gap-0 overflow-hidden rounded-xl border bg-card md:grid-cols-[1fr_22rem]">
              <section aria-label="Transcripción" className="max-h-[65vh] min-h-[50vh] space-y-4 overflow-y-auto p-5 md:p-6">
                {transcripcion.transcripciones.length === 0 && (
                  <p className="text-muted-foreground">
                    {fase === "en-curso" ? "Escuchando. El primer texto aparece a los diez segundos." : "No se transcribió nada en esta sesión."}
                  </p>
                )}
                {transcripcion.transcripciones.map((t, i) => (
                  <div key={i} className="animate-line-in grid grid-cols-[3rem_1fr] gap-3">
                    <span className="pt-1 text-xs text-muted-foreground tabular">{formatTime(t.timestampSegundos)}</span>
                    <p className="font-read text-[1.02rem] leading-relaxed">{t.texto}</p>
                  </div>
                ))}
                {transcripcion.procesando && (
                  <p className="flex items-center gap-2 pl-[3.75rem] text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribiendo
                  </p>
                )}
                <div ref={transcriptEnd} />
              </section>

              <div className="flex h-[65vh] flex-col border-t p-4 md:border-l md:border-t-0">
                <LiveSidePanel
                  mensajes={enVivo.mensajes} cargando={enVivo.cargando} onPreguntar={enVivo.preguntar}
                  conceptos={deteccion.conceptos} analizando={deteccion.analizando}
                  notas={apuntes.notas} notaError={apuntes.error} onNota={apuntes.agregar}
                />
              </div>
            </div>

            {fase === "finalizando" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                {etapaFinal === "transcribiendo"
                  ? "Terminando de transcribir los últimos segundos"
                  : "Armando el resumen y preparando la sesión para el chat. Puede tardar hasta un minuto."}
              </p>
            )}
            {fase === "finalizada" && (
              <div className="flex flex-col justify-between gap-4 border-y py-4 sm:flex-row sm:items-center">
                <p className="text-sm">
                  Sesión guardada, <span className="tabular">{formatTime(segundos)}</span> de audio.
                </p>
                <div className="flex gap-2">
                  <button type="button" className={btn} onClick={() => router.push("/sesiones")}>Ver sesiones</button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => { setFase("configurar"); setTitulo(""); sesionIdRef.current = null; }}
                  >
                    Nueva sesión
                  </button>
                </div>
              </div>
            )}
            {fase === "finalizada" && resumen && (
              <section ref={resumenRef} aria-labelledby="resumen-titulo" className="scroll-mt-24">
                <h2 id="resumen-titulo" className="mb-4 text-xl font-semibold tracking-tight">Resumen</h2>
                <SessionSummary resumen={resumen} documentId={documentId} sesionId={sesionIdRef.current} titulo={titulo} />
              </section>
            )}
          </div>
        )}
      </div>

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
          conceptos={deteccion.conceptos}
          analizando={deteccion.analizando}
          notas={apuntes.notas}
          notaError={apuntes.error}
          onNota={apuntes.agregar}
          aviso={transcripcion.aviso}
          onPausarReanudar={pausarReanudar}
          onFinalizar={finalizar}
        />,
        pip.pipWindow.document.body
      )}
    </div>
  );
}
