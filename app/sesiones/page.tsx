"use client";

// Historial de sesiones: al abrir una se ve su resumen, el acceso al chat y la
// transcripción. Las sesiones sin resumen (viejas o que fallaron) se pueden
// terminar de procesar desde acá.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Mic, Plus, Clock, ChevronDown, Loader2, Trash2, Sparkles, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SessionSummary } from "@/components/sesion/SessionSummary";

type Sesion = {
  id: string;
  titulo: string | null;
  fecha: string;
  estado: "activa" | "finalizada";
  resumen: string | null;
  document_id: string | null;
};

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
      .select("id, titulo, fecha, estado, resumen, document_id")
      .order("fecha", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Error al cargar las sesiones");
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
    if (error) toast.error("Error al cargar la transcripción");
    else setLineas(prev => ({ ...prev, [id]: data || [] }));
  }

  async function eliminar(e: React.MouseEvent, s: Sesion) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${s.titulo}"?`)) return;
    const { error } = await supabase.from("sesiones").delete().eq("id", s.id);
    // El documento del chat se borra junto con la sesión
    if (!error && s.document_id) await supabase.from("documents").delete().eq("id", s.document_id);
    if (error) toast.error("Error al eliminar");
    else setSesiones(prev => prev.filter(x => x.id !== s.id));
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
        ? { ...x, estado: "finalizada", resumen: data.resumen, document_id: data.documentId }
        : x));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Documentos
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-3">
            <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold">
              Sesiones
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none">
              Mis <span className="text-primary">sesiones</span>
            </h1>
            <p className="text-muted-foreground max-w-sm text-base leading-relaxed">
              Videos, clases y reuniones transcriptas.
            </p>
          </div>
          <Button onClick={() => router.push("/sesion")}
            className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-[0_0_25px_rgba(124,58,237,0.2)] gap-2">
            <Plus className="w-4 h-4" /> Nueva sesión
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-[20px] bg-muted/30 animate-pulse" />)}
          </div>
        ) : sesiones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-muted/20 rounded-[32px] border border-dashed border-border/40">
            <Mic className="w-10 h-10 text-primary/40 mb-4" />
            <h2 className="text-xl font-bold">Sin sesiones aún</h2>
            <p className="text-muted-foreground mt-2 max-w-xs text-sm">
              Iniciá una sesión mientras mirás un video o estás en una reunión.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sesiones.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-[20px] border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden">
                <div onClick={() => toggle(s.id)} className="group flex items-center gap-4 p-5 cursor-pointer hover:bg-primary/[0.03] transition-colors">
                  <div className="p-2.5 rounded-xl bg-primary/10"><Mic className="w-4 h-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold tracking-tight truncate">{s.titulo}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.fecha).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {s.estado === "activa" && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 rounded-full">Sin finalizar</Badge>
                  )}
                  {s.document_id && (
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary rounded-full hidden sm:inline-flex">En el chat</Badge>
                  )}
                  <button onClick={e => eliminar(e, s)} className="p-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${abierta === s.id ? "rotate-180" : ""}`} />
                </div>

                {abierta === s.id && (
                  <div className="border-t border-border/30 px-5 py-5 space-y-5">
                    {/* Resumen, o el botón para generarlo */}
                    {s.resumen ? (
                      <SessionSummary resumen={s.resumen} documentId={s.document_id} />
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl bg-primary/5 border border-primary/15 px-4 py-3">
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          Esta sesión todavía no tiene resumen ni está disponible en el chat.
                        </p>
                        <Button onClick={() => generarResumen(s)} disabled={procesando !== null} className="rounded-2xl gap-2 shrink-0">
                          {procesando === s.id
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando… (hasta 1 min)</>
                            : <><Sparkles className="w-4 h-4" /> Generar resumen y preparar chat</>}
                        </Button>
                      </div>
                    )}
                    {s.resumen && !s.document_id && (
                      <Button variant="outline" onClick={() => generarResumen(s)} disabled={procesando !== null} className="rounded-2xl gap-2">
                        {procesando === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        Preparar chat con esta sesión
                      </Button>
                    )}

                    {/* Transcripción completa */}
                    <button onClick={() => setVerTranscripcion(v => !v)} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verTranscripcion ? "rotate-180" : ""}`} />
                      Transcripción completa
                    </button>
                    {verTranscripcion && (
                      <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                        {!lineas[s.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : lineas[s.id].length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Esta sesión no tiene transcripción.</p>
                        ) : lineas[s.id].map((l, j) => (
                          <div key={j} className="flex gap-4">
                            <span className="font-mono text-[11px] text-muted-foreground pt-1 shrink-0 tabular-nums">{formatTime(l.timestamp_segundos)}</span>
                            <p className="text-sm leading-relaxed">{l.texto}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
