"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/AppHeader";
import { cn } from "@/lib/utils";
import { BookOpen, PenLine, Globe, Loader2, UploadCloud, type LucideIcon } from "lucide-react";

type SourceType = "pdf" | "text" | "url";
type ProcessingState = "idle" | "processing" | "error";

const PROCESSING_TIMEOUT = 3 * 60 * 1000;

const sources: { type: SourceType; icon: LucideIcon; title: string; desc: string }[] = [
  { type: "pdf",  icon: BookOpen, title: "PDF",        desc: "Hasta 10 MB" },
  { type: "text", icon: PenLine,  title: "Texto",      desc: "Pegás el contenido" },
  { type: "url",  icon: Globe,    title: "Página web", desc: "Un link público" },
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
    if (!title.trim()) { toast.error("Poné un título para el documento."); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Tu sesión venció. Volvé a ingresar."); setLoading(false); return; }

    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: user.id, title: title.trim(), source_type: selected })
      .select()
      .single();

    if (error) { toast.error("No se pudo guardar el documento."); setLoading(false); return; }

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
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo procesar el documento.");
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

  const field = "space-y-2";

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        {processingState === "processing" && (
          <div className="py-20 text-center" role="status">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <h1 className="mt-6 text-xl font-semibold">Leyendo el documento</h1>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Se divide en fragmentos y se indexa para poder buscar en él. Puede tardar unos segundos.
            </p>
          </div>
        )}

        {processingState === "error" && (
          <div className="py-20 text-center" role="alert">
            <h1 className="text-xl font-semibold">No se pudo cargar el documento</h1>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setProcessingState("idle")}
              className="mt-6 inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary"
            >
              Volver a intentar
            </button>
          </div>
        )}

        {processingState === "idle" && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Subir documento</h1>
            <p className="mt-2 text-muted-foreground">Elegí de dónde sale el contenido.</p>

            <div role="radiogroup" aria-label="Tipo de documento" className="mt-8 grid grid-cols-3 gap-2">
              {sources.map((s) => {
                const Icon = s.icon;
                const isSelected = selected === s.type;
                return (
                  <button
                    key={s.type}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(s.type)}
                    className={cn(
                      "flex flex-col items-start gap-3 rounded-lg border p-4 text-left hover:bg-secondary/60",
                      isSelected && "border-primary bg-secondary/60",
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-medium">{s.title}</span>
                      <span className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <form onSubmit={handleSubmit} className="mt-8 space-y-6 border-t pt-8">
                <div className={field}>
                  <Label htmlFor="doc-title">Título</Label>
                  <Input
                    id="doc-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Por ejemplo: Apunte de Clasificación y KNN"
                    className="h-11"
                  />
                </div>

                {selected === "pdf" && (
                  <div className={field}>
                    <Label htmlFor="pdf-input">Archivo</Label>
                    <label
                      htmlFor="pdf-input"
                      className="flex cursor-pointer items-center gap-4 rounded-lg border border-dashed px-5 py-6 hover:bg-secondary/60"
                    >
                      <UploadCloud className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {file ? file.name : "Elegir un PDF"}
                        </span>
                        <span className="block text-sm text-muted-foreground">Máximo 10 MB</span>
                      </span>
                    </label>
                    <input
                      type="file"
                      id="pdf-input"
                      className="sr-only"
                      accept=".pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                )}

                {selected === "text" && (
                  <div className={field}>
                    <Label htmlFor="doc-text">Texto</Label>
                    <Textarea
                      id="doc-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Pegá el texto acá"
                      className="min-h-[200px] resize-y font-read text-[0.98rem] leading-relaxed"
                    />
                  </div>
                )}

                {selected === "url" && (
                  <div className={field}>
                    <Label htmlFor="doc-url">Link</Label>
                    <Input
                      id="doc-url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://"
                      className="h-11"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Guardando" : "Cargar documento"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
