"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Solo ingreso: el registro está cerrado (la app se muestra, no se abre al público).
export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "El email o la contraseña no coinciden."
        : error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col px-5 sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">archiChat</Link>
      </header>

      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Por ahora archiChat es de uso personal y no tiene registro abierto.{" "}
            <Link href="/" className="text-foreground underline underline-offset-4">Ver qué hace</Link>.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Ingresando" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
