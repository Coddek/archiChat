"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cuenta creada correctamente.");
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-card border-r border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">A</span>
          </div>
          <span className="font-bold text-lg">archiChat</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold leading-tight">
              Chateá con tus<br />documentos
            </h1>
            <p className="text-muted-foreground text-lg">
              Subí PDFs, pegá texto o ingresá una URL.<br />
              La IA encuentra lo que necesitás.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: "📄", title: "PDFs, texto y URLs", desc: "Cualquier tipo de documento" },
              { icon: "🔍", title: "Búsqueda semántica", desc: "Encontrá info aunque no uses las mismas palabras" },
              { icon: "💬", title: "Chat natural", desc: "Preguntá como si hablaras con alguien" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          Proyecto final — Curso de IA para Desarrolladores
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">A</span>
            </div>
            <span className="font-bold text-lg">archiChat</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              {isRegister ? "Crear cuenta" : "Bienvenido"}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {isRegister ? "Completá tus datos para empezar" : "Ingresá para continuar"}
            </p>
          </div>

          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder={isRegister ? "Mínimo 6 caracteres" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegister ? 6 : undefined}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? isRegister ? "Creando cuenta..." : "Ingresando..."
                : isRegister ? "Crear cuenta" : "Ingresar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
            >
              {isRegister ? "Ingresá" : "Registrate"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
