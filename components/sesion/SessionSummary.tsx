"use client";

// Resumen de una sesión finalizada, con los accesos a copiarlo y a chatear
// con la sesión desde el chat normal.

import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Copy, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  resumen: string;
  documentId: string | null;
}

export function SessionSummary({ resumen, documentId }: Props) {
  const router = useRouter();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumen);
      toast.success("Resumen copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:tracking-tight prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
        <ReactMarkdown>{resumen}</ReactMarkdown>
      </div>
      <div className="flex flex-wrap gap-2">
        {documentId && (
          <Button onClick={() => router.push(`/chat/${documentId}`)} className="rounded-2xl gap-2">
            <MessageSquare className="w-4 h-4" /> Chatear con esta sesión
          </Button>
        )}
        <Button variant="outline" onClick={copiar} className="rounded-2xl gap-2">
          <Copy className="w-4 h-4" /> Copiar resumen
        </Button>
      </div>
    </div>
  );
}
