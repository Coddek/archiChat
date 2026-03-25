"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  PenLine,
  Globe,
  Plus,
  Search,
  Clock,
  Trash2,
  LogOut,
  Sparkles,
  FolderOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MagicCard } from "@/components/ui/magic-card";
import { SettingsModal } from "@/components/SettingsModal";

type Document = {
  id: string;
  title: string;
  source_type: "pdf" | "text" | "url";
  created_at: string;
};

const typeConfig: Record<string, { icon: LucideIcon; label: string; color: string; bg: string }> = {
  pdf:  { icon: BookOpen, label: "PDF",      color: "text-red-400",     bg: "bg-red-500/10"     },
  text: { icon: PenLine,  label: "Texto",    color: "text-blue-400",    bg: "bg-blue-500/10"    },
  url:  { icon: Globe,    label: "Sitio Web",color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

export default function DashboardPage() {
  const router  = useRouter();
  const supabase = createClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [search,    setSearch]    = useState("");
  const [showSettings,  setShowSettings]  = useState(false);
  const [isOnboarding,  setIsOnboarding]  = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  // Verificar si el usuario tiene API keys configuradas
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.hasKeys) {
          setIsOnboarding(true);
          setShowSettings(true);
        }
      })
      .catch(() => {});
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
      toast.success("Documento eliminado");
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-transparent text-foreground selection:bg-primary/30">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-700 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.3)] group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <span
              className="font-bold text-lg tracking-tighter bg-clip-text text-transparent animate-shimmer"
              style={{
                backgroundImage: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--foreground) / 0.9) 28%, hsl(var(--primary)) 50%, #a78bfa 75%, hsl(var(--foreground) / 0.9) 100%)",
                backgroundSize: "200% auto",
              }}
            >
              archiChat
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground hidden md:block italic">{userEmail}</span>
            <ThemeToggle />
            <button
              onClick={() => { setIsOnboarding(false); setShowSettings(true); }}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
              title="Configuración"
            >
              <Settings className="w-4 h-4" />
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout}
              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl gap-2 transition-all">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* Hero & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-8 mb-8 md:mb-14">
          <div className="space-y-3">
            <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold">
              Mis archivos
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none text-foreground">
              Mis <span className="text-primary">documentos</span>
            </h1>
            <p className="text-muted-foreground max-w-sm text-base leading-relaxed">
              Todo lo que subás, la IA lo va a poder usar para responderte.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Buscar documentos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-11 bg-background/60 border-border/50 w-full md:w-[280px] h-11 rounded-2xl focus:ring-primary/20 focus:border-primary/30 placeholder:text-muted-foreground/50 transition-all"
              />
            </div>
            <Button onClick={() => router.push("/upload")}
              className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-[0_0_25px_rgba(124,58,237,0.2)] gap-2 transition-all active:scale-95">
              <Plus className="w-4 h-4" />
              Subir
            </Button>
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[200px] rounded-[24px] bg-muted/30 animate-pulse border border-border/30" />
              ))}
            </div>

          ) : filteredDocs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-28 text-center bg-muted/20 rounded-[40px] border border-dashed border-border/40"
            >
              <div className="w-20 h-20 rounded-[24px] bg-primary/5 border border-primary/10 flex items-center justify-center mb-6">
                <FolderOpen className="w-10 h-10 text-primary/40" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Sin documentos aún</h2>
              <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
                Subí un PDF, pegá un texto o ingresá un link — la IA lo va a leer y podrás hacerle preguntas.
              </p>
              <Button onClick={() => router.push("/upload")}
                className="mt-8 bg-muted/50 hover:bg-muted text-foreground border border-border/40 rounded-2xl px-8 h-11">
                Subir primer documento
              </Button>
            </motion.div>

          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">

              {filteredDocs.map((doc, i) => {
                const cfg  = typeConfig[doc.source_type];
                const Icon = cfg.icon;

                return (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -6, scale: 1.015 }}
                    onClick={() => router.push(`/chat/${doc.id}`)}
                    className="cursor-pointer"
                  >
                    <MagicCard gradientColor="rgba(124,58,237,0.13)" gradientSize={260} className="rounded-[24px]">
                      <Card className="group relative bg-card dark:bg-white/[0.02] backdrop-blur-md border-border/40 dark:border-white/5 rounded-[24px] overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-[0_0_40px_-10px_rgba(124,58,237,0.25)] shadow-sm ring-0 py-0 gap-0">

                        {/* Glow interior violet al hacer hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0" />

                        <CardHeader className="px-5 pt-5 pb-0 relative z-10">
                          <div className="flex items-start justify-between">
                            <div className={`p-3 rounded-2xl ${cfg.bg} border border-border/20 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                              <Icon className={`w-5 h-5 ${cfg.color}`} />
                            </div>
                            <button
                              onClick={e => handleDelete(e, doc.id, doc.title)}
                              className="p-2 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </CardHeader>

                        <CardContent className="px-5 pt-4 pb-5 relative z-10">
                          <h3 className="font-bold text-base text-foreground leading-snug mb-5 group-hover:text-primary transition-colors duration-300 line-clamp-2 tracking-tight">
                            {doc.title}
                          </h3>
                          <div className="flex items-center justify-between pt-4 border-t border-border/30">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Date(doc.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold border-border/40 bg-muted/50 text-muted-foreground px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              {cfg.label}
                            </Badge>
                          </div>
                        </CardContent>

                      </Card>
                    </MagicCard>
                  </motion.div>
                );
              })}

              {/* Card — nuevo documento */}
              <motion.div
                whileHover={{ scale: 0.98 }}
                onClick={() => router.push("/upload")}
                className="group border-2 border-dashed border-border/40 rounded-[24px] p-6 cursor-pointer flex flex-col items-center justify-center gap-5 min-h-[200px] hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-full bg-background border border-border/40 dark:border-white/5 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/20 group-hover:scale-110 transition-all duration-500">
                  <Plus className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="block font-bold text-muted-foreground group-hover:text-foreground transition-colors tracking-tight">
                    Nuevo documento
                  </span>
                  <span className="text-xs text-muted-foreground/50 mt-1 block">PDF · texto · URL</span>
                </div>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isOnboarding={isOnboarding}
        onKeySaved={() => setIsOnboarding(false)}
      />
    </div>
  );
}
