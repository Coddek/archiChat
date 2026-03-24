"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SourceType = "pdf" | "text" | "url";

// Estado del procesamiento — controla qué pantalla se muestra
type ProcessingState = "idle" | "processing" | "error";

const sources: { type: SourceType; icon: string; title: string; desc: string }[] = [
  { type: "pdf", icon: "📄", title: "PDF", desc: "Subí un archivo PDF" },
  { type: "text", icon: "📝", title: "Texto", desc: "Pegá texto directamente" },
  { type: "url", icon: "🔗", title: "URL", desc: "Ingresá un enlace web" },
];

// Tiempo máximo de espera antes de considerar que falló (ms)
const PROCESSING_TIMEOUT = 3 * 60 * 1000 // 3 minutos

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
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No estás autenticado"); setLoading(false); return; }

    // PASO 1: Guardar el documento en Supabase
    const { data, error } = await supabase.from("documents").insert({
      user_id: user.id,
      title: title.trim(),
      source_type: selected,
    }).select().single();

    if (error) {
      toast.error("Error al guardar el documento");
      setLoading(false);
      return;
    }

    // PASO 2: Mostrar pantalla de procesamiento
    setProcessingDocId(data.id);
    setProcessingState("processing");
    setLoading(false);

    // PASO 3: Mandar a procesar
    const formData = new FormData();
    formData.append("documentId", data.id);
    formData.append("sourceType", selected);

    if (selected === "pdf" && file) {
      formData.append("content", file);
    } else if (selected === "url") {
      formData.append("content", url);
    } else {
      formData.append("content", text);
    }

    // Llamamos al pipeline — esta vez SÍ esperamos la respuesta
    const processPromise = fetch("/api/process", { method: "POST", body: formData })
      .then(res => res.json())
      .then(result => {
        if (result.error) throw new Error(result.error)
        return result
      })

    // Timeout de seguridad por si el proceso tarda demasiado
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("El procesamiento tardó demasiado. Intentá con un documento más corto.")), PROCESSING_TIMEOUT)
    )

    try {
      await Promise.race([processPromise, timeoutPromise])

      // PASO 4: Verificar que los chunks están en Supabase
      // (doble confirmación — a veces el pipeline responde OK pero los chunks tardan en guardarse)
      await waitForChunks(data.id)

      // PASO 5: Redirigir al chat con todo listo
      router.push(`/chat/${data.id}`)

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al procesar el documento"
      setErrorMessage(message)
      setProcessingState("error")

      // Eliminamos el documento si falló para no dejar basura en la DB
      await supabase.from("documents").delete().eq("id", data.id)
    }
  }

  // Espera hasta que haya al menos 1 chunk en Supabase
  async function waitForChunks(docId: string) {
    const start = Date.now()
    while (Date.now() - start < PROCESSING_TIMEOUT) {
      const { count } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", docId)

      if ((count ?? 0) > 0) return
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    throw new Error("No se generaron fragmentos del documento.")
  }

  function handleRetry() {
    setProcessingState("idle")
    setProcessingDocId(null)
    setErrorMessage("")
  }

  // ── Pantalla de procesamiento ──────────────────────────────────────────────
  if (processingState === "processing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div className="text-5xl animate-pulse">⚙️</div>
          <h2 className="text-xl font-semibold">Procesando tu documento</h2>
          <p className="text-sm text-muted-foreground">
            Estamos dividiendo el texto en fragmentos y generando embeddings semánticos.
            Esto puede tardar hasta un minuto dependiendo del tamaño.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-xs text-muted-foreground">No cierres esta pestaña</p>
        </div>
      </div>
    )
  }

  // ── Pantalla de error ──────────────────────────────────────────────────────
  if (processingState === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div className="text-5xl">❌</div>
          <h2 className="text-xl font-semibold">No se pudo procesar el documento</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Ir al dashboard
            </Button>
            <Button onClick={handleRetry}>
              Intentar de nuevo
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario normal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1"
        >
          ← Volver
        </button>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Nuevo documento</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">¿Qué querés analizar?</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Elegí el tipo de fuente y después completá los datos
          </p>
        </div>

        {/* Source type selector */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {sources.map((s) => (
            <button
              key={s.type}
              onClick={() => setSelected(s.type)}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-150 ${
                selected === s.type
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-border/80 hover:bg-card/80"
              }`}
            >
              <span className="text-3xl">{s.icon}</span>
              <span className="font-medium text-sm">{s.title}</span>
              <span className="text-xs text-muted-foreground text-center">{s.desc}</span>
            </button>
          ))}
        </div>

        {/* Form — aparece al seleccionar */}
        {selected && (
          <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="Dale un nombre a este documento..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {selected === "pdf" && (
              <div className="space-y-2">
                <Label htmlFor="file">Archivo PDF</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    id="file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="file" className="cursor-pointer">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm font-medium">
                      {file ? file.name : "Hacé clic para seleccionar un PDF"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Máximo 10MB</p>
                  </label>
                </div>
              </div>
            )}

            {selected === "text" && (
              <div className="space-y-2">
                <Label htmlFor="text-content">Contenido</Label>
                <Textarea
                  id="text-content"
                  placeholder="Pegá acá el texto que querés analizar..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{text.length} caracteres</p>
              </div>
            )}

            {selected === "url" && (
              <div className="space-y-2">
                <Label htmlFor="url-input">Dirección web</Label>
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://ejemplo.com/articulo"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  archiChat va a leer el contenido de la página automáticamente
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Guardando..." : "Procesar documento →"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
