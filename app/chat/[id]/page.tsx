"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ChatMessage, type Source } from "@/components/ChatMessage";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  Send,
  ArrowLeft,
  Sparkles,
  Plus,
  BookOpen,
  PenLine,
  Globe,
  Circle,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number | null;
  streaming?: boolean;
};

type Document = {
  id: string;
  title: string;
  source_type: string;
};

const typeIcon: Record<string, any> = {
  pdf:  BookOpen,
  text: PenLine,
  url:  Globe,
};

const typeColor: Record<string, string> = {
  pdf: "text-red-400",
  text: "text-blue-400",
  url: "text-emerald-400",
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;
  const supabase = createClient();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadDocuments(); }, []);
  useEffect(() => { setSidebarOpen(window.innerWidth >= 768); }, []);

  useEffect(() => {
    if (isProcessed) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 40;

    const interval = setInterval(async () => {
      attempts++;
      const { count } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId);

      if ((count ?? 0) > 0) {
        setIsProcessed(true);
        clearInterval(interval);
        toast.success("¡Listo! Ya podés hacer preguntas");
      } else if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        toast.error("El documento tardó demasiado. Intentá subirlo de nuevo.");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isProcessed, documentId]);

  useEffect(() => {
    if (!isProcessed || messages.length > 0) return;
    fetch(`/api/suggest?documentId=${documentId}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(d.questions ?? []))
      .catch(() => {});
  }, [isProcessed, documentId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadDocuments() {
    const { data } = await supabase
      .from("documents")
      .select("id, title, source_type")
      .order("created_at", { ascending: false });

    if (data) {
      setDocuments(data);
      setActiveDoc(data.find((d) => d.id === documentId) || null);
    }

    const { count } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);

    setIsProcessed((count ?? 0) > 0);
  }

  const handleSend = useCallback(
    async (e: React.FormEvent | null, overrideQuestion?: string) => {
      if (e) e.preventDefault();
      const question = overrideQuestion ?? input.trim();
      if (!question || loading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: question,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setSuggestions([]);
      setLoading(true);

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            documentId,
            documentTitle: activeDoc?.title,
            isProcessed,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Error al obtener respuesta");
        }

        if (!res.body) throw new Error("Sin respuesta del servidor");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === "chunk") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              } else if (parsed.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, sources: parsed.sources, confidence: parsed.confidence, streaming: false }
                      : m
                  )
                );
              }
            } catch { /* línea malformada */ }
          }
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        toast.error(err instanceof Error ? err.message : "Error al conectar con la IA");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, documentId, activeDoc, isProcessed]
  );

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 140) + "px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(null);
    }
  };

  const DocIcon = activeDoc ? (typeIcon[activeDoc.source_type] ?? BookOpen) : BookOpen;
  const docColor = activeDoc ? (typeColor[activeDoc.source_type] ?? "text-muted-foreground") : "text-muted-foreground";

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar glassmorphism ─────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute md:relative w-full md:w-64 shrink-0 flex flex-col border-r border-border/30 bg-background/95 dark:bg-white/[0.015] backdrop-blur-xl z-30 h-full"
          >
            {/* Header sidebar */}
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  Mis documentos
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-violet-700 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span
              className="font-bold text-sm tracking-tight bg-clip-text text-transparent animate-shimmer"
              style={{
                backgroundImage: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--foreground) / 0.9) 28%, hsl(var(--primary)) 50%, #a78bfa 75%, hsl(var(--foreground) / 0.9) 100%)",
                backgroundSize: "200% auto",
              }}
            >
              archiChat
            </span>
              </div>
            </div>

            {/* Label */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                Fuentes
              </p>
            </div>

            {/* Lista documentos */}
            <ScrollArea className="flex-1 px-2">
              <div className="space-y-0.5 pb-2">
                {documents.map((doc) => {
                  const Icon = typeIcon[doc.source_type] ?? BookOpen;
                  const color = typeColor[doc.source_type] ?? "text-muted-foreground";
                  const isActive = doc.id === documentId;

                  return (
                    <button
                      key={doc.id}
                      onClick={() => router.push(`/chat/${doc.id}`)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-150 flex items-start gap-2.5 group ${
                        isActive
                          ? "bg-teal-500/10 border border-teal-500/20 text-foreground"
                          : "hover:bg-foreground/[0.04] text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? "text-teal-400" : color}`} />
                      <span className="truncate text-xs font-medium leading-snug">{doc.title}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Nuevo documento */}
            <div className="p-3 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] rounded-xl gap-2 justify-start text-xs"
                onClick={() => router.push("/upload")}
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo documento
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Área principal ────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="shrink-0 border-b border-border/30 px-5 py-3 flex items-center gap-3 bg-background/70 dark:bg-background/50 backdrop-blur-xl">
          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-border/50" />

          {activeDoc ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <DocIcon className={`w-4 h-4 shrink-0 ${docColor}`} />
              <h1 className="font-semibold text-sm truncate text-foreground">{activeDoc.title}</h1>
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isProcessed
                    ? "text-teal-400 bg-teal-500/10 border-teal-500/25"
                    : "text-amber-400 bg-amber-500/10 border-amber-500/25"
                }`}
              >
                {isProcessed ? (
                  <span className="flex items-center gap-1">
                    <Circle className="w-1.5 h-1.5 fill-teal-400" />
                    Listo para responder
                  </span>
                ) : "Procesando…"}
              </Badge>
            </div>
          ) : (
            <h1 className="font-semibold text-sm text-muted-foreground">Documento no encontrado</h1>
          )}

          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-6 md:py-8 max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center min-h-[55vh] gap-5 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 dark:bg-teal-500/[0.08] border border-teal-500/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <p className="font-bold text-lg text-foreground tracking-tight">
                    ¿Qué querés saber?
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
                    Hacé una pregunta y la IA va a buscar la respuesta dentro de tu documento.
                  </p>
                </div>

                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                      Sugerencias
                    </p>
                    {suggestions.map((q, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => handleSend(null, q)}
                        className="text-left text-sm px-4 py-3 rounded-2xl border border-border/50 bg-card/40 dark:bg-white/[0.02] hover:bg-teal-500/5 hover:border-teal-500/25 transition-all duration-150 text-foreground/75 hover:text-foreground"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                )}

                {isProcessed && suggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 animate-pulse">
                    Generando sugerencias…
                  </p>
                )}
              </motion.div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    sources={msg.sources}
                    confidence={msg.confidence}
                    streaming={msg.streaming}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 px-3 md:px-6 py-3 md:py-4 border-t border-border/30 bg-background/70 dark:bg-background/50 backdrop-blur-xl">
          <form
            onSubmit={handleSend}
            className="flex gap-3 max-w-3xl mx-auto items-end"
          >
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isProcessed
                    ? "Escribí tu pregunta... (Enter para enviar)"
                    : "El documento se está procesando, podés preguntar algo general..."
                }
                disabled={loading}
                rows={1}
                className="w-full resize-none bg-card/60 dark:bg-white/[0.03] border border-border/50 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/15 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 disabled:opacity-50 min-h-[48px] max-h-[140px]"
                style={{ height: "48px" }}
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="icon"
              className="w-12 h-12 bg-teal-600 hover:bg-teal-500 disabled:bg-muted text-white rounded-2xl shrink-0 shadow-[0_0_20px_rgba(20,184,166,0.25)] hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-all"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-center mt-2 text-[10px] text-muted-foreground/30">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}
