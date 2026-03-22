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

const sources: { type: SourceType; icon: string; title: string; desc: string }[] = [
  { type: "pdf", icon: "📄", title: "PDF", desc: "Subí un archivo PDF" },
  { type: "text", icon: "📝", title: "Texto", desc: "Pegá texto directamente" },
  { type: "url", icon: "🔗", title: "URL", desc: "Ingresá un enlace web" },
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("No estás autenticado"); setLoading(false); return; }

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

    // Preparamos el FormData para enviar al pipeline
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

    // Mandamos el documento a procesar — esto genera los chunks y embeddings
    // No esperamos a que termine para redirigir al chat
    // El usuario puede ir chateando mientras se procesa
    toast.info("Procesando documento...");

    fetch("/api/process", { method: "POST", body: formData })
      .then((res) => res.json())
      .then((result) => {
        if (result.error) {
          toast.error("Error al procesar: " + result.error);
        } else {
          toast.success(`Listo — ${result.chunksProcessed} fragmentos indexados`);
        }
      })
      .catch(() => toast.error("Error al procesar el documento"));

    router.push(`/chat/${data.id}`);
  }

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
              {loading ? "Guardando..." : "Continuar al chat →"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
