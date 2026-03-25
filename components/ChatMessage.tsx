"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Sparkles, 
  User, 
  Copy, 
  Check,
  Search
} from "lucide-react";
import { toast } from "sonner";

export type Source = {
  content: string;
  chunk_index: number;
  similarity: number;
};

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number | null;
  streaming?: boolean;
};

function ConfidenceBadge({ score }: { score: number }) {
  const isHigh = score >= 70;
  const isMid = score >= 40;
  
  const colorClass = isHigh 
    ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" 
    : isMid 
    ? "text-yellow-400 border-yellow-500/20 bg-yellow-500/10" 
    : "text-red-400 border-red-500/20 bg-red-500/10";

  return (
    <motion.span 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-black px-3 py-1 rounded-full border ${colorClass}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHigh ? 'bg-emerald-400' : 'bg-yellow-400'}`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isHigh ? 'bg-emerald-500' : 'bg-yellow-500'}`}></span>
      </span>
      {isHigh ? "Alta confianza" : isMid ? "Confianza media" : "Baja confianza"} · {Math.round(score)}%
    </motion.span>
  );
}

function SourceCards({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
      >
        <div className={`p-1.5 rounded-lg border border-border/40 dark:border-white/5 transition-colors ${open ? "bg-primary text-white" : "bg-foreground/5 dark:bg-white/5"}`}>
          {open ? <ChevronUp className="w-3 h-3" /> : <Search className="w-3 h-3" />}
        </div>
        <span>Ver {sources.length} {sources.length !== 1 ? "fragmentos usados" : "fragmento usado"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3 mt-4"
          >
            {sources.map((s, i) => (
              <div
                key={i}
                className="group relative rounded-[20px] border border-border/40 dark:border-white/5 bg-card/40 dark:bg-white/[0.01] p-4 text-xs transition-all hover:bg-muted/50 dark:hover:bg-white/[0.04] hover:border-border/60 dark:hover:border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary font-mono text-[10px] font-bold uppercase tracking-tighter">
                    <FileText className="w-3 h-3" />
                    <span>Parte #{s.chunk_index} del documento</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary">
                    {Math.round(s.similarity)}% relevancia
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-4 py-1">
                  "{s.content}"
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatMessage({ role, content, sources, confidence, streaming }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-5 ${isUser ? "flex-row-reverse" : "flex-row"} mb-10 group/msg`}
    >
      <Avatar className={`w-10 h-10 shrink-0 border shadow-2xl transition-transform duration-500 group-hover/msg:scale-110 ${isUser ? "border-primary/20" : "border-border/30"}`}>
        <AvatarFallback className={`${isUser ? "bg-gradient-to-br from-primary to-violet-800 text-white" : "bg-card text-primary"} text-[10px] font-black`}>
          {isUser ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-3 max-w-[85%] md:max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`relative px-6 py-5 text-[15px] leading-relaxed transition-all duration-500 shadow-2xl ${
            isUser
              ? "bg-primary text-white rounded-[28px] rounded-tr-none font-medium selection:bg-white/20"
              : "bg-card/60 dark:bg-white/[0.03] backdrop-blur-2xl border border-border/40 dark:border-white/10 rounded-[28px] rounded-tl-none prose dark:prose-invert max-w-none shadow-black/60 selection:bg-primary/30"
          }`}
        >
          {/* Efecto de resplandor para el asistente */}
          {!isUser && (
            <div className="absolute -z-10 inset-0 bg-primary/5 blur-3xl rounded-full opacity-50" />
          )}

          {isUser ? (
            <span>{content}</span>
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-4 last:mb-0 text-foreground font-normal">{children}</p>,
                  code: ({ children }) => (
                    <code className="bg-muted/60 dark:bg-black/40 px-2 py-0.5 rounded-lg border border-border/40 dark:border-white/10 text-primary text-[13px] font-mono">{children}</code>
                  ),
                  strong: ({ children }) => <strong className="text-foreground font-bold">{children}</strong>,
                  table: ({ children }) => (
                    <div className="my-6 overflow-hidden rounded-[20px] border border-border/40 dark:border-white/10 bg-muted/30 dark:bg-black/20 shadow-inner">
                      <table className="w-full text-sm text-left">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="p-4 bg-muted/50 dark:bg-white/5 font-bold text-primary border-b border-border/40 dark:border-white/10">{children}</th>,
                  td: ({ children }) => <td className="p-4 border-t border-border/30 dark:border-white/5 text-foreground/80">{children}</td>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" className="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-4 transition-colors font-bold">{children}</a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>

              {streaming && (
                <div className="flex gap-1.5 mt-4">
                  {[0, 0.1, 0.2].map((delay) => (
                    <motion.div
                      key={delay}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay }}
                      className="w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                    />
                  ))}
                </div>
              )}

              {/* Botón de copiar flotante */}
              {!streaming && (
                <button
                  onClick={handleCopy}
                  className="absolute -right-14 top-0 p-2.5 rounded-xl bg-card/60 dark:bg-white/[0.02] border border-border/40 dark:border-white/5 text-muted-foreground hover:text-primary hover:bg-muted/60 dark:hover:bg-white/5 opacity-0 group-hover/msg:opacity-100 transition-all duration-300"
                  title="Copiar respuesta"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </>
          )}
        </div>

        {/* Metadatos (Confianza y Fuentes) */}
        {!isUser && !streaming && (
          <div className="w-full pl-2 space-y-4 animate-in fade-in slide-in-from-left-2 duration-700">
            {(confidence !== null && confidence !== undefined) && (
              <ConfidenceBadge score={confidence} />
            )}
            {sources && sources.length > 0 && (
              <SourceCards sources={sources} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}