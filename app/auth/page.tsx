"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  FileText,
  Search,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Meteors } from "@/components/ui/meteors";

const features = [
  {
    icon: <FileText className="w-4 h-4" />,
    title: "PDF, texto y URLs",
    desc: "Subí cualquier fuente y la IA la indexa al instante",
  },
  {
    icon: <Search className="w-4 h-4" />,
    title: "Respuestas con fuentes",
    desc: "Cada respuesta cita el fragmento exacto del documento",
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: "Llama 3.3 + Gemini",
    desc: "Modelos de IA de última generación para respuestas precisas",
  },
];

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
    if (error) toast.error(error.message);
    else { router.push("/dashboard"); router.refresh(); }
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) toast.error(error.message);
    else { toast.success("Cuenta creada."); router.push("/dashboard"); router.refresh(); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden p-6 selection:bg-primary/30">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Orbes de fondo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="orb-1 absolute top-[-20%] left-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] rounded-full bg-primary/[0.08] dark:bg-primary/[0.13] blur-[100px] md:blur-[140px]" />
        <div className="orb-2 absolute bottom-[-20%] right-[-10%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] rounded-full bg-violet-500/[0.06] dark:bg-indigo-600/[0.11] blur-[100px] md:blur-[140px]" />
      </div>

      {/* Meteoros — lluvia diagonal sutil sobre el fondo */}
      <Meteors number={16} />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-14 items-center">

        {/* Panel izquierdo */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className="hidden lg:flex flex-col gap-10"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-violet-700 flex items-center justify-center shadow-[0_0_28px_rgba(124,58,237,0.4)]">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span
              className="font-black text-xl tracking-tighter bg-clip-text text-transparent animate-shimmer"
              style={{
                backgroundImage: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--foreground) / 0.9) 28%, hsl(var(--primary)) 50%, #a78bfa 75%, hsl(var(--foreground) / 0.9) 100%)",
                backgroundSize: "200% auto",
              }}
            >
              archiChat
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-[3.2rem] font-black leading-[1.05] tracking-tighter text-foreground">
              Preguntale a<br />
              tus{" "}
              <span className="text-primary">
                documentos.
              </span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              Subí un PDF, una URL o texto plano — chateá con él como si fuera un experto en el tema.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-foreground/[0.02] border border-border/40 hover:border-primary/25 transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  {f.icon}
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{f.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Panel derecho — Card con grid pattern */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="w-full"
        >
          {/* Logo mobile */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-700 flex items-center justify-center shadow-[0_0_24px_rgba(124,58,237,0.4)] mb-3">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1
              className="text-2xl font-black tracking-tighter bg-clip-text text-transparent animate-shimmer"
              style={{
                backgroundImage: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--foreground) / 0.9) 28%, hsl(var(--primary)) 50%, #a78bfa 75%, hsl(var(--foreground) / 0.9) 100%)",
                backgroundSize: "200% auto",
              }}
            >
              archiChat
            </h1>
          </div>

          {/* Glow estático multicapa detrás de la card */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-[44px] opacity-50 dark:opacity-70 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(124,58,237,0.18) 0%, transparent 65%), radial-gradient(ellipse at 75% 70%, rgba(99,102,241,0.14) 0%, transparent 60%)" }} />

            {/* Card principal */}
            <div className="relative rounded-[32px] overflow-hidden border border-border/40 dark:border-white/[0.07]">

              {/* Grid pattern como fondo de la card */}
              <div className="absolute inset-0 [background-image:linear-gradient(hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:28px_28px]" />

              {/* Gradiente radial encima del grid — oscurece los bordes, aclara el centro */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(124,58,237,0.08)_0%,transparent_60%)]" />

              {/* Superficie glassmorphism */}
              <div className="relative backdrop-blur-2xl bg-background/70 dark:bg-white/[0.025] p-8 md:p-11">

                {/* Título */}
                <div className="mb-7">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={isRegister ? "r" : "l"}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-2xl font-black text-foreground tracking-tight"
                    >
                      {isRegister ? "Crear cuenta" : "Bienvenido"}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="text-muted-foreground text-sm mt-1.5">
                    {isRegister
                      ? "Empezá a chatear con tus archivos"
                      : "Accedé a tus documentos"}
                  </p>
                </div>

                {/* Formulario */}
                <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                      <Input
                        type="email"
                        placeholder="vos@ejemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-background/50 dark:bg-black/30 border-border/50 h-11 pl-10 rounded-xl focus:ring-primary/20 focus:border-primary/40 transition-all text-foreground placeholder:text-muted-foreground/40 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={isRegister ? 6 : undefined}
                        className="bg-background/50 dark:bg-black/30 border-border/50 h-11 pl-10 rounded-xl focus:ring-primary/20 focus:border-primary/40 transition-all text-foreground text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <ShimmerButton type="submit" disabled={loading}>
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                          </motion.span>
                        ) : (
                          <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                            {isRegister ? "Crear cuenta" : "Ingresar"}
                            <ArrowRight className="w-4 h-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </ShimmerButton>
                  </div>
                </form>

                <div className="mt-7 pt-5 border-t border-border/30 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isRegister ? "¿Ya tenés cuenta?" : "¿Primera vez?"}{" "}
                    <button
                      type="button"
                      onClick={() => setIsRegister(!isRegister)}
                      className="text-primary hover:text-primary/80 transition-colors font-bold"
                    >
                      {isRegister ? "Iniciá sesión" : "Registrate gratis"}
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center mt-5 text-[10px] text-muted-foreground/30 font-bold uppercase tracking-[0.3em]">
            archiChat · 2026
          </p>
        </motion.div>
      </div>
    </div>
  );
}
