"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, PenLine, Globe, Plus, Search, Trash2, Mic, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/AppHeader";
import { SettingsModal } from "@/components/SettingsModal";
import { CHALK, TYPE_CHALK } from "@/lib/chalk";
import { cn } from "@/lib/utils";

type Document = {
  id: string;
  title: string;
  source_type: "pdf" | "text" | "url" | "sesion";
  created_at: string;
};

const typeConfig: Record<string, { icon: LucideIcon; label: string }> = {
  pdf:    { icon: BookOpen, label: "PDF" },
  text:   { icon: PenLine,  label: "Texto" },
  url:    { icon: Globe,    label: "Página web" },
  sesion: { icon: Mic,      label: "Sesión en vivo" },
};

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });

export default function DashboardPage() {
  const router  = useRouter();
  const supabase = createClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showSettings,  setShowSettings]  = useState(false);
  const [isOnboarding,  setIsOnboarding]  = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  // Solo abre el onboarding si no hay keys del usuario NI del servidor
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.hasKeys && !d.hasServerKeys) {
          setIsOnboarding(true);
          setShowSettings(true);
        }
      })
      .catch(() => {});
  }, []);

  async function loadData() {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, source_type, created_at")
      .order("created_at", { ascending: false });

    if (error) toast.error("No se pudieron cargar los documentos. Recargá la página.");
    else setDocuments(data || []);
    setLoading(false);
  }

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${title}"? No se puede deshacer.`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error("No se pudo eliminar el documento.");
    else {
      toast.success("Documento eliminado");
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
  }

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <AppHeader onSettings={() => { setIsOnboarding(false); setShowSettings(true); }} />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Documentos</h1>
            <p className="mt-2 text-muted-foreground">
              Lo que subas, o una sesión que termines, queda acá para preguntarle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar"
                aria-label="Buscar documentos"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 w-full pl-9 sm:w-64"
              />
            </div>
            <button
              type="button"
              onClick={() => router.push("/upload")}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Subir documento
            </button>
          </div>
        </div>

        <div className="mt-10">
          {loading ? (
            <ul className="divide-y border-y" aria-busy>
              {[...Array(4)].map((_, i) => (
                <li key={i} className="flex h-16 items-center gap-4 px-2">
                  <div className="h-4 w-4 rounded bg-secondary" />
                  <div className="h-4 w-1/3 rounded bg-secondary" />
                </li>
              ))}
            </ul>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-16 text-center">
              <h2 className="text-lg font-medium">Todavía no hay documentos</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                Subí un PDF, pegá un texto o un link, o empezá una sesión en vivo.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/upload")}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Subir documento
                </button>
                <Link href="/sesiones" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary">
                  Empezar una sesión
                </Link>
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <p className="border-y py-10 text-center text-muted-foreground">
              Ningún documento coincide con «{search}».
            </p>
          ) : (
            <ul className="divide-y border-y">
              {filteredDocs.map(doc => {
                const cfg  = typeConfig[doc.source_type] ?? typeConfig.text;
                const Icon = cfg.icon;
                return (
                  <li key={doc.id}>
                    <Link
                      href={`/chat/${doc.id}`}
                      className="group grid grid-cols-[2.25rem_1fr_auto] items-center gap-4 px-2 py-3 hover:bg-secondary/60 sm:grid-cols-[2.25rem_1fr_9rem_7rem_2.25rem]"
                    >
                      <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center rounded-md", CHALK[TYPE_CHALK[doc.source_type] ?? "green"].tile)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate font-medium">{doc.title}</span>
                      <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", CHALK[TYPE_CHALK[doc.source_type] ?? "green"].dot)} />
                        {cfg.label}
                      </span>
                      <span className="text-sm text-muted-foreground tabular">
                        {dateFmt.format(new Date(doc.created_at))}
                      </span>
                      <button
                        type="button"
                        onClick={e => handleDelete(e, doc.id, doc.title)}
                        aria-label={`Eliminar ${doc.title}`}
                        className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isOnboarding={isOnboarding}
        onKeySaved={() => setIsOnboarding(false)}
      />
    </div>
  );
}
