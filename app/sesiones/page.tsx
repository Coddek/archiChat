"use client";

// Historial de sesiones: al abrir una se ve su resumen, el acceso al chat y la
// transcripción. Las sesiones sin resumen (viejas o que fallaron) se pueden
// terminar de procesar desde acá.

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, ChevronDown, Loader2, Trash2, MessageSquare, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { AppHeader } from "@/components/AppHeader";
import { SessionSummary } from "@/components/sesion/SessionSummary";
import { buildSessionDocument, describirSesion, terminosClave } from "@/lib/sesion";
import { CHALK, chalkFor } from "@/lib/chalk";
import { cn } from "@/lib/utils";

type Sesion = {
  id: string;
  titulo: string | null;
  fecha: string;
  estado: "activa" | "finalizada";
  resumen: string | null;
  document_id: string | null;
  contextos: { count: number }[];
};

// "Hoy", "Ayer" o la fecha, para agrupar la lista
function grupoFecha(fecha: string) {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

type Linea = { texto: string; timestamp_segundos: number };

export default function SesionesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [abierta, setAbierta]   = useState<string | null>(null);
  const [lineas, setLineas]     = useState<Record<string, Linea[]>>({});
  const [verTranscripcion, setVerTranscripcion] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("sesiones")
      .select("id, titulo, fecha, estado, resumen, document_id, contextos(count)")
      .order("fecha", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("No se pudieron cargar las sesiones. Recargá la página.");
        else setSesiones(data || []);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(id: string) {
    if (abierta === id) { setAbierta(null); return; }
    setAbierta(id);
    setVerTranscripcion(false);
    if (lineas[id]) return;
    const { data, error } = await supabase
      .from("transcripciones")
      .select("texto, timestamp_segundos")
      .eq("sesion_id", id)
      .order("timestamp_segundos", { ascending: true });
    if (error) toast.error("No se pudo cargar la transcripción.");
    else setLineas(prev => ({ ...prev, [id]: data || [] }));
  }

  async function eliminar(e: React.MouseEvent, s: Sesion) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${s.titulo}"?`)) return;
    const { error } = await supabase.from("sesiones").delete().eq("id", s.id);
    // El documento del chat se borra junto con la sesión
    if (!error && s.document_id) await supabase.from("documents").delete().eq("id", s.document_id);
    if (error) toast.error("No se pudo eliminar la sesión.");
    else setSesiones(prev => prev.filter(x => x.id !== s.id));
  }

  // Descarga la sesión completa en Markdown: es el mismo texto que usa el chat
  async function exportar(s: Sesion) {
    const [{ data: ls }, { data: preguntas }, { data: conceptos }, { data: notas }] = await Promise.all([
      supabase.from("transcripciones").select("texto, timestamp_segundos").eq("sesion_id", s.id).order("timestamp_segundos"),
      supabase.from("preguntas_sesion").select("pregunta, respuesta, timestamp_segundos").eq("sesion_id", s.id).order("timestamp_segundos"),
      supabase.from("contextos").select("concepto, explicacion, timestamp_segundos").eq("sesion_id", s.id).order("timestamp_segundos"),
      supabase.from("notas_sesion").select("texto, timestamp_segundos").eq("sesion_id", s.id).order("timestamp_segundos"),
    ]);
    const titulo = s.titulo || "Sesión";
    const md = buildSessionDocument(titulo, s.fecha, s.resumen ?? "", ls ?? [], preguntas ?? [], conceptos ?? [], notas ?? []);
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Resumen + documento para sesiones que no lo tienen
  async function generarResumen(s: Sesion) {
    setProcesando(s.id);
    try {
      const res = await fetch("/api/finalizar-sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesionId: s.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo generar el resumen");
      if (data.error) toast.warning(data.error);
      if (!data.resumen) toast.info("La sesión no tiene transcripción para resumir");
      setSesiones(prev => prev.map(x => x.id === s.id
        ? { ...x, estado: "finalizada" as const, resumen: data.resumen, document_id: data.documentId }
        : x));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcesando(null);
    }
  }

  const timeFmt = (f: string) => new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const quietBtn = "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-60";

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Sesiones</h1>
            <p className="mt-2 text-muted-foreground">Clases, videos y reuniones que transcribiste.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/sesion")}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Mic className="h-4 w-4" />
            Nueva sesión
          </button>
        </div>

        <div className="mt-10">
          {loading ? (
            <ul className="divide-y border-y" aria-busy>
              {[...Array(3)].map((_, i) => (
                <li key={i} className="flex h-16 items-center px-2"><div className="h-4 w-1/3 rounded bg-secondary" /></li>
              ))}
            </ul>
          ) : sesiones.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-16 text-center">
              <h2 className="text-lg font-medium">Todavía no hay sesiones</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                Empezá una mientras mirás un video, una clase o una reunión.
              </p>
            </div>
          ) : (
            <div>
              {sesiones.map((s, i) => (
                <Fragment key={s.id}>
                  {(i === 0 || grupoFecha(sesiones[i - 1].fecha) !== grupoFecha(s.fecha)) && (
                    <h2 className="pb-2 pt-8 text-sm font-medium text-muted-foreground first:pt-0 first-letter:uppercase">
                      {grupoFecha(s.fecha)}
                    </h2>
                  )}
                  <div className="border-t last:border-b">
                    <div className="group flex items-center gap-4 px-2 py-4 hover:bg-secondary/60">
                      <button
                        type="button"
                        onClick={() => toggle(s.id)}
                        aria-expanded={abierta === s.id}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", CHALK[chalkFor(s.titulo ?? s.id)].tile)}
                        >
                          <Mic className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-3">
                            <span className="truncate font-medium">{s.titulo}</span>
                            <span className="shrink-0 text-sm text-muted-foreground tabular">{timeFmt(s.fecha)}</span>
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground line-clamp-2">
                            {describirSesion(s.resumen)
                              ?? (s.estado === "activa" ? "Sin finalizar." : "Todavía no tiene resumen.")}
                          </span>
                          {(terminosClave(s.resumen).length > 0 || s.document_id) && (
                            <span className="mt-2 flex flex-wrap items-center gap-1.5">
                              {terminosClave(s.resumen).map(t => (
                                <span key={t} className={cn("rounded px-2 py-0.5 text-xs", CHALK[chalkFor(s.titulo ?? s.id)].chip)}>
                                  {t}
                                </span>
                              ))}
                              {(s.contextos?.[0]?.count ?? 0) > 0 && (
                                <span className="px-1 text-xs text-muted-foreground">
                                  {s.contextos[0].count} conceptos explicados
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierta === s.id ? "rotate-180" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={e => eliminar(e, s)}
                        aria-label={`Eliminar ${s.titulo ?? "sesión"}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {abierta === s.id && (
                      <div className="space-y-6 px-2 pb-8 pt-2 sm:pl-[4.5rem]">
                        {s.resumen ? (
                          <SessionSummary resumen={s.resumen} documentId={s.document_id} sesionId={s.id} titulo={s.titulo || "Sesión"} />
                        ) : (
                          <div className="flex flex-col justify-between gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center">
                            <p className="text-sm text-muted-foreground">
                              Esta sesión todavía no tiene resumen ni está disponible en el chat.
                            </p>
                            <button type="button" onClick={() => generarResumen(s)} disabled={procesando !== null} className={quietBtn}>
                              {procesando === s.id && <Loader2 className="h-4 w-4 animate-spin" />}
                              {procesando === s.id ? "Generando (hasta 1 minuto)" : "Generar resumen"}
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {s.resumen && !s.document_id && (
                            <button type="button" onClick={() => generarResumen(s)} disabled={procesando !== null} className={quietBtn}>
                              {procesando === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                              Preparar el chat
                            </button>
                          )}
                          <button type="button" onClick={() => exportar(s)} className={quietBtn}>
                            <Download className="h-4 w-4" />
                            Descargar en Markdown
                          </button>
                          <button
                            type="button"
                            onClick={() => setVerTranscripcion(v => !v)}
                            aria-expanded={verTranscripcion}
                            className={quietBtn}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${verTranscripcion ? "rotate-180" : ""}`} />
                            {verTranscripcion ? "Ocultar transcripción" : "Ver transcripción"}
                          </button>
                        </div>

                        {verTranscripcion && (
                          <div className="max-h-96 space-y-3 overflow-y-auto border-l pl-4 pr-2">
                            {!lineas[s.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : lineas[s.id].length === 0 ? (
                              <p className="text-sm text-muted-foreground">Esta sesión no tiene transcripción.</p>
                            ) : lineas[s.id].map((l, j) => (
                              <div key={j} className="grid grid-cols-[3rem_1fr] gap-3">
                                <span className="pt-1 text-xs text-muted-foreground tabular">{formatTime(l.timestamp_segundos)}</span>
                                <p className="font-read text-[0.98rem] leading-relaxed">{l.texto}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
