"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ChatMessage, type Source } from "@/components/ChatMessage";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ArrowUp, ArrowLeft, Plus, BookOpen, PenLine, Globe, PanelLeft, Settings, Mic, type LucideIcon } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { cn } from "@/lib/utils";
import { CHALK, TYPE_CHALK } from "@/lib/chalk";
import { mensajesDesdeFilas } from "@/lib/historial";

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

const typeIcon: Record<string, LucideIcon> = {
  pdf:  BookOpen,
  text: PenLine,
  url:  Globe,
  sesion: Mic,
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
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast.success("El documento está listo para preguntar.");
      } else if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        toast.error("El documento tardó demasiado en procesarse. Probá subirlo de nuevo.");
      }
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessed, documentId]);

  // Conversación guardada de este documento. Si la tabla no existe todavía o
  // falla la consulta, el chat arranca vacío como antes.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    let cancelado = false;
    supabase
      .from("mensajes_chat")
      .select("id, role, content, sources, confidence, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) setMessages(mensajesDesdeFilas(data));
        setHistoryLoaded(true);
      });
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function nuevaConversacion() {
    if (!confirm("¿Empezar una conversación nueva? La actual se borra y no se puede recuperar.")) return;
    const { error } = await supabase.from("mensajes_chat").delete().eq("document_id", documentId);
    if (error) { toast.error("No se pudo borrar la conversación."); return; }
    setMessages([]);
  }

  useEffect(() => {
    if (!isProcessed || !historyLoaded || messages.length > 0) return;
    fetch(`/api/suggest?documentId=${documentId}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(d.questions ?? []))
      .catch(() => {});
  }, [isProcessed, historyLoaded, documentId, messages.length]);

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
          throw new Error(data.error || "No se pudo obtener una respuesta. Probá de nuevo.");
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
        toast.error(err instanceof Error ? err.message : "No se pudo conectar con el modelo. Probá de nuevo.");
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
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground";

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Fuentes */}
      {sidebarOpen && (
        <aside className="absolute z-30 flex h-full w-full shrink-0 flex-col border-r bg-background md:relative md:w-64">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Documentos
            </Link>
            <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar fuentes" className={cn(iconBtn, "md:hidden")}>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>

          <p className="px-4 pb-2 pt-5 text-sm font-medium text-muted-foreground">Fuentes</p>
          <nav className="flex-1 overflow-y-auto px-2 pb-2">
            {documents.map((doc) => {
              const Icon = typeIcon[doc.source_type] ?? BookOpen;
              const isActive = doc.id === documentId;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => router.push(`/chat/${doc.id}`)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
                    isActive && "bg-secondary text-foreground",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", CHALK[TYPE_CHALK[doc.source_type] ?? "green"].text)} />
                  <span className="truncate leading-snug">{doc.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => router.push("/upload")}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Subir documento
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Ocultar fuentes" : "Mostrar fuentes"}
            className={iconBtn}
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          {activeDoc ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <DocIcon className={cn("h-4 w-4 shrink-0", CHALK[TYPE_CHALK[activeDoc.source_type] ?? "green"].text)} />
              <h1 className="truncate text-sm font-medium">{activeDoc.title}</h1>
              {!isProcessed && (
                <span className="shrink-0 text-sm text-muted-foreground">Procesando</span>
              )}
            </div>
          ) : (
            <h1 className="flex-1 text-sm text-muted-foreground">No se encontró el documento</h1>
          )}

          <div className="ml-auto flex items-center gap-1">
            {messages.length > 0 && !loading && (
              <button
                type="button"
                onClick={nuevaConversacion}
                className="mr-1 hidden h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                Nueva conversación
              </button>
            )}
            <button type="button" onClick={() => setShowSettings(true)} aria-label="Configuración" className={iconBtn}>
              <Settings className="h-4 w-4" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-5 py-8 md:py-10">
            {messages.length === 0 ? (
              <div className="pt-[12vh]">
                <h2 className="text-2xl font-semibold tracking-tight">¿Qué querés saber?</h2>
                <p className="mt-2 max-w-md text-muted-foreground">
                  La respuesta sale de {activeDoc?.source_type === "sesion" ? "lo que se dijo en la sesión" : "este documento"},
                  con los fragmentos que la respaldan.
                </p>

                {suggestions.length > 0 && (
                  <ul className="mt-8 divide-y border-y">
                    {suggestions.map((q, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => handleSend(null, q)}
                          className="w-full px-1 py-3 text-left hover:text-primary"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {isProcessed && suggestions.length === 0 && (
                  <p className="mt-8 text-sm text-muted-foreground">Preparando preguntas sugeridas…</p>
                )}
              </div>
            ) : (
              <div className="space-y-10">
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

        <div className="shrink-0 border-t px-4 py-3">
          <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">Tu pregunta</label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isProcessed ? "Escribí tu pregunta" : "El documento se está procesando; podés preguntar algo general"}
              disabled={loading}
              rows={1}
              className="max-h-[140px] min-h-[46px] flex-1 resize-none rounded-lg border bg-card px-4 py-3 text-[0.95rem] outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
              style={{ height: "46px" }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar pregunta"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
            Enter envía. Shift + Enter agrega una línea.
          </p>
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
