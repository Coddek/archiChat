"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Document = {
  id: string;
  title: string;
  source_type: "pdf" | "text" | "url";
  created_at: string;
};

const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
  pdf: { icon: "📄", label: "PDF", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  text: { icon: "📝", label: "Texto", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  url: { icon: "🔗", label: "URL", color: "text-green-400 bg-green-500/10 border-green-500/20" },
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setUserEmail(user.email);

    const { data, error } = await supabase
      .from("documents")
      .select("id, title, source_type, created_at")
      .order("created_at", { ascending: false });

    if (error) toast.error("Error al cargar documentos");
    else setDocuments(data || []);
    setLoading(false);
  }

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${title}"?`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error("Error al eliminar");
    else {
      toast.success("Eliminado");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">A</span>
          </div>
          <span className="font-semibold">archiChat</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>Salir</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero section */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mis documentos</h1>
            <p className="text-muted-foreground mt-1">
              {loading ? "" : documents.length === 0
                ? "Todavía no subiste ningún documento"
                : `${documents.length} documento${documents.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button onClick={() => router.push("/upload")} size="lg">
            + Nuevo
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center text-4xl">
              📚
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Empezá subiendo un documento</h2>
              <p className="text-muted-foreground mt-2 max-w-sm">
                Subí un PDF, pegá texto o ingresá una URL para empezar a chatear con tu contenido.
              </p>
            </div>
            <Button onClick={() => router.push("/upload")} size="lg">
              Subir primer documento
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const config = typeConfig[doc.source_type];
              return (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/chat/${doc.id}`)}
                  className="group relative bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-black/20 transition-all duration-200"
                >
                  {/* Type icon */}
                  <div className="text-3xl mb-4">{config.icon}</div>

                  {/* Title */}
                  <h3 className="font-semibold text-base leading-snug line-clamp-2 mb-3">
                    {doc.title}
                  </h3>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs ${config.color}`}>
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, doc.id, doc.title)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {/* Add new card */}
            <div
              onClick={() => router.push("/upload")}
              className="bg-card/50 border border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:bg-card transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[160px]"
            >
              <span className="text-3xl text-muted-foreground">+</span>
              <span className="text-sm text-muted-foreground">Nuevo documento</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
