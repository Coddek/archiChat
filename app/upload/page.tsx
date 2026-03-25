"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  BookOpen,
  PenLine,
  Globe,
  ArrowLeft,
  Loader2,
  Sparkles,
  UploadCloud,
  AlertTriangle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

type SourceType = "pdf" | "text" | "url";
type ProcessingState = "idle" | "processing" | "error";

const PROCESSING_TIMEOUT = 3 * 60 * 1000;

const sources: {
  type: SourceType;
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  bg: string;
  glow: string;
}[] = [
  {
    type: "pdf",
    icon: BookOpen,
    title: "PDF",
    desc: "Hasta 10 MB",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    glow: "rgba(239,68,68,0.13)",
  },
  {
    type: "text",
    icon: PenLine,
    title: "Texto",
    desc: "Copiá y pegá",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    glow: "rgba(59,130,246,0.13)",
  },
  {
    type: "url",
    icon: Globe,
    title: "URL",
    desc: "Enlace web",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    glow: "rgba(16,185,129,0.13)",
  },
];

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [selected, setSelected] = useState<SourceType | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No estás autenticado"); setLoading(false); return; }

    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: user.id, title: title.trim(), source_type: selected })
      .select()
      .single();

    if (error) { toast.error("Error al guardar"); setLoading(false); return; }

    setProcessingState("processing");
    setLoading(false);

    const formData = new FormData();
    formData.append("documentId", data.id);
    formData.append("sourceType", selected);
    if (selected === "pdf" && file) formData.append("content", file);
    else if (selected === "url") formData.append("content", url);
    else formData.append("content", text);

    try {
      const processPromise = fetch("/api/process", { method: "POST", body: formData }).then(
        async (res) => {
          if (res.status === 413) throw new Error("Archivo demasiado grande (máx 10 MB).");
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          return result;
        }
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tiempo de espera agotado.")), PROCESSING_TIMEOUT)
      );

      await Promise.race([processPromise, timeoutPromise]);
      await waitForChunks(data.id);
      router.push(`/chat/${data.id}`);
    } catch (err: any) {
      setErrorMessage(err.message);
      setProcessingState("error");
      await supabase.from("documents").delete().eq("id", data.id);
    }
  }

  async function waitForChunks(docId: string) {
    const start = Date.now();
    while (Date.now() - start < PROCESSING_TIMEOUT) {
      const { count } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", docId);
      if ((count ?? 0) > 0) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("No se generaron fragmentos.");
  }

  return (
    <div className="min-h-screen bg-transparent text-foreground selection:bg-primary/30">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 dark:border-white/5 bg-background/80 backdrop-blur-xl px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-violet-700 flex items-center justify-center shadow-[0_0_14px_rgba(124,58,237,0.35)]">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span
                className="font-bold text-base tracking-tighter bg-clip-text text-transparent animate-shimmer"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--foreground) / 0.9) 28%, hsl(var(--primary)) 50%, #a78bfa 75%, hsl(var(--foreground) / 0.9) 100%)",
                  backgroundSize: "200% auto",
                }}
              >
                archiChat
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-14">
        <AnimatePresence mode="wait">

          {/* ── Estado: procesando ──────────────────────────── */}
          {processingState === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center gap-8 py-16"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                <div className="relative w-24 h-24 rounded-3xl bg-background/60 dark:bg-white/[0.03] border border-border/40 dark:border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-md">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  Leyendo tu documento…
                </h2>
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm leading-relaxed">
                  Esto puede tardar unos segundos. La IA está procesando el contenido para poder responderte después.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Estado: error ───────────────────────────────── */}
          {processingState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center gap-6 py-16"
            >
              <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-9 h-9 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Algo salió mal</h2>
                <p className="text-red-400 mt-2 text-sm">{errorMessage}</p>
              </div>
              <Button
                onClick={() => setProcessingState("idle")}
                className="gap-2 rounded-xl bg-muted/50 hover:bg-muted border border-border/40 dark:border-white/10 text-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                Reintentar
              </Button>
            </motion.div>
          )}

          {/* ── Estado: idle ────────────────────────────────── */}
          {processingState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Hero */}
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black tracking-tighter text-foreground">
                  Nuevo <span className="text-primary">documento</span>
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Elegí cómo querés agregar el contenido y la IA lo va a leer por vos.
                </p>
              </div>

              {/* Selector de tipo — cards con MagicCard */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                {sources.map((s) => {
                  const Icon = s.icon;
                  const isSelected = selected === s.type;

                  return (
                    <MagicCard
                      key={s.type}
                      gradientColor={s.glow}
                      gradientSize={200}
                      className="rounded-2xl"
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(s.type)}
                        className={`relative w-full flex flex-col items-center gap-2 p-3 md:p-6 rounded-2xl border transition-all duration-300 ${
                          isSelected
                            ? "bg-primary/[0.05] dark:bg-white/[0.05] border-primary/40 shadow-[0_0_30px_-8px_rgba(124,58,237,0.4)]"
                            : "bg-background/60 dark:bg-white/[0.02] border-border/40 dark:border-white/5 hover:bg-muted/40 dark:hover:bg-white/[0.04] hover:border-border/60 dark:hover:border-white/10"
                        }`}
                      >
                        <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl border flex items-center justify-center transition-transform duration-300 ${s.bg} ${isSelected ? "scale-110" : ""}`}>
                          <Icon className={`w-6 h-6 ${s.color}`} />
                        </div>
                        <div className="text-center">
                          <p className={`font-bold text-xs md:text-sm ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                            {s.title}
                          </p>
                          <p className="hidden md:block text-[11px] text-muted-foreground/60 mt-0.5">{s.desc}</p>
                        </div>

                        {/* Indicador de selección */}
                        {isSelected && (
                          <motion.div
                            layoutId="selected-indicator"
                            className="absolute -top-px left-4 right-4 h-[2px] bg-primary rounded-full"
                          />
                        )}
                      </button>
                    </MagicCard>
                  );
                })}
              </div>

              {/* Formulario — aparece al seleccionar tipo */}
              <AnimatePresence>
                {selected && (
                  <motion.form
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5 bg-card/60 dark:bg-white/[0.02] backdrop-blur-md border border-border/40 dark:border-white/5 rounded-[24px] p-7"
                  >
                    {/* Línea superior animada */}
                    <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                    {/* Título */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        ¿Cómo querés llamarlo?
                      </Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Manual de producto, Informe Q3…"
                        className="bg-background/70 dark:bg-black/40 border-border/40 dark:border-white/5 h-11 rounded-xl focus:ring-primary/20 focus:border-primary/30 placeholder:text-muted-foreground/40 text-sm"
                      />
                    </div>

                    {/* Input específico por tipo */}
                    {selected === "pdf" && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Archivo
                        </Label>
                        <div className="group relative border-2 border-dashed border-border/50 dark:border-white/10 rounded-2xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
                          <input
                            type="file"
                            id="pdf-input"
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="pdf-input" className="cursor-pointer flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <UploadCloud className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {file ? file.name : "Hacé click para subir un PDF"}
                              </p>
                              <p className="text-xs text-muted-foreground/60 mt-0.5">Máximo 10 MB</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {selected === "text" && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Texto a cargar
                        </Label>
                        <Textarea
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="Pegá el texto aquí…"
                          className="min-h-[180px] bg-background/70 dark:bg-black/40 border-border/40 dark:border-white/5 rounded-xl focus:ring-primary/20 focus:border-primary/30 placeholder:text-muted-foreground/40 text-sm resize-none"
                        />
                      </div>
                    )}

                    {selected === "url" && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          URL
                        </Label>
                        <Input
                          type="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://…"
                          className="bg-background/70 dark:bg-black/40 border-border/40 dark:border-white/5 h-11 rounded-xl focus:ring-primary/20 focus:border-primary/30 placeholder:text-muted-foreground/40 text-sm"
                        />
                      </div>
                    )}

                    {/* Submit */}
                    <ShimmerButton type="submit" disabled={loading}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Procesando…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Cargar y listo
                        </span>
                      )}
                    </ShimmerButton>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
