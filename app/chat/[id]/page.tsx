"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ChatMessage } from "@/components/ChatMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Document = {
  id: string;
  title: string;
  source_type: string;
};

const badgeColors: Record<string, string> = {
  pdf: "bg-red-500/20 text-red-400 border-red-500/30",
  text: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  url: "bg-green-500/20 text-green-400 border-green-500/30",
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  // Polling: si el documento no está procesado, verificamos cada 3 segundos
  // hasta que los chunks estén listos
  useEffect(() => {
    if (isProcessed) return;

    const interval = setInterval(async () => {
      const { count } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId);

      if ((count ?? 0) > 0) {
        setIsProcessed(true);
        clearInterval(interval);
        toast.success("Documento listo — RAG activo");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isProcessed, documentId]);

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
      const current = data.find((d) => d.id === documentId);
      setActiveDoc(current || null);
    }

    // Verificamos si el documento ya tiene chunks procesados
    // Si tiene al menos 1 chunk, el RAG está disponible
    const { count } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId);

    setIsProcessed((count ?? 0) > 0);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          documentId,
          documentTitle: activeDoc?.title,
          isProcessed,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al obtener respuesta");

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch {
      toast.error("Error al conectar con la IA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Dashboard
          </button>
          <h2 className="font-semibold mt-2">Mis documentos</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => router.push(`/chat/${doc.id}`)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  doc.id === documentId
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="font-medium truncate">{doc.title}</div>
                <Badge
                  variant="outline"
                  className={`mt-1 text-xs ${badgeColors[doc.source_type]}`}
                >
                  {doc.source_type.toUpperCase()}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => router.push("/upload")}
          >
            + Nuevo documento
          </Button>
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-border px-6 py-4 flex items-center gap-3">
          {activeDoc ? (
            <>
              <h1 className="font-semibold text-lg truncate">{activeDoc.title}</h1>
              <Badge
                variant="outline"
                className={badgeColors[activeDoc.source_type]}
              >
                {activeDoc.source_type.toUpperCase()}
              </Badge>
              <Badge variant="outline" className={isProcessed
                ? "text-green-400 bg-green-500/10 border-green-500/20"
                : "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
              }>
                {isProcessed ? "RAG activo" : "Procesando..."}
              </Badge>
            </>
          ) : (
            <h1 className="font-semibold text-lg text-muted-foreground">Documento no encontrado</h1>
          )}
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-20">
              <p className="text-2xl">📄</p>
              <p className="font-medium">¿Qué querés saber sobre este documento?</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Hacé una pregunta y la IA va a buscar la respuesta en el contenido del documento.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                />
              ))}
              {loading && (
                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs">AI</AvatarFallback>
                  </Avatar>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                    Pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Input */}
        <div className="px-6 py-4">
          <form onSubmit={handleSend} className="flex gap-3 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hacé una pregunta sobre el documento..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              Enviar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
