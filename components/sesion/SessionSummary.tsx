"use client";

// Resumen de una sesión finalizada, con los accesos a copiarlo y a chatear
// con la sesión desde el chat normal.

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Copy, MessageSquare, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flashcards } from "./Flashcards";
import type { Tarjeta } from "@/lib/estudio";

interface Props {
  resumen: string;
  documentId: string | null;
  sesionId?: string | null;   // con el id se ofrece el modo estudio
  titulo?: string;
}

export function SessionSummary({ resumen, documentId, sesionId, titulo }: Props) {
  const router = useRouter();
  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
  const [armando, setArmando] = useState(false);

  // Las tarjetas no se guardan: se arman cada vez que se piden
  async function estudiar() {
    setArmando(true);
    try {
      const res = await fetch("/api/sesion-estudio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudieron armar las tarjetas");
      setTarjetas(data.tarjetas);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setArmando(false);
    }
  }

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
        {sesionId && !tarjetas && (
          <Button variant="outline" onClick={estudiar} disabled={armando} className="rounded-2xl gap-2">
            {armando
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Armando tarjetas…</>
              : <><GraduationCap className="w-4 h-4" /> Modo estudio</>}
          </Button>
        )}
      </div>
      {tarjetas && <Flashcards tarjetas={tarjetas} titulo={titulo} />}
    </div>
  );
}
