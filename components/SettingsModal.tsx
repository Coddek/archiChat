"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  Sparkles,
  CheckCircle2,
  Zap,
  Brain,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isOnboarding?: boolean;
  onKeySaved?: () => void;
}

// Instrucciones paso a paso para cada servicio
const GROQ_STEPS = [
  "Abrí la Groq Console con el botón de abajo",
  "Creá una cuenta gratuita (email o Google)",
  'Hacé click en "+ Create API Key"',
  'Dale un nombre (ej: "archiChat") y confirmá',
  "Copiá la clave que aparece — empieza con gsk_",
  "Pegala en el campo acá abajo",
];

const GEMINI_STEPS = [
  "Abrí Google AI Studio con el botón de abajo",
  "Iniciá sesión con tu cuenta de Google",
  'Hacé click en "Create API key"',
  'Elegí "Create API key in new project"',
  "Copiá la clave — empieza con AIza",
  "Pegala en el campo acá abajo",
];

// ── Componente: lista de pasos ──────────────────────────────────────────────
function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-foreground/80 leading-snug">{step}</span>
        </li>
      ))}
    </ol>
  );
}

// ── Componente: input de clave con show/hide ────────────────────────────────
function KeyInput({
  value,
  onChange,
  placeholder,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`w-full bg-background/60 dark:bg-white/[0.03] border rounded-xl px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all font-mono ${
          error
            ? "border-red-500/50 focus:border-red-500/70 focus:ring-2 focus:ring-red-500/10"
            : "border-border/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
        }`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Componente: sección de key con instrucciones colapsables (modo settings) ─
function KeySection({
  title,
  icon: Icon,
  iconColor,
  steps,
  linkUrl,
  linkLabel,
  value,
  onChange,
  placeholder,
  saved,
  error,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  steps: string[];
  linkUrl: string;
  linkLabel: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  saved: boolean;
  error?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 dark:bg-white/[0.01] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {saved && !value && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3 h-3" />
              Guardada
            </span>
          )}
        </div>
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
        >
          {linkLabel}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="px-4 pb-3">
        <KeyInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          error={error}
        />
        {error && (
          <p className="text-xs text-red-500 mt-1.5">Este campo es requerido</p>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03] transition-all border-t border-border/30"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "Ocultar instrucciones" : "¿Cómo la obtengo? (paso a paso)"}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 bg-muted/20">
              <StepList steps={steps} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Modal principal ─────────────────────────────────────────────────────────
export function SettingsModal({
  open,
  onClose,
  isOnboarding = false,
  onKeySaved,
}: SettingsModalProps) {
  // wizard step: 0=welcome, 1=groq, 2=gemini  (solo en onboarding)
  const [step, setStep]           = useState(0);
  const [groqKey, setGroqKey]     = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [saving, setSaving]       = useState(false);
  const [savedGroq, setSavedGroq]     = useState(false);
  const [savedGemini, setSavedGemini] = useState(false);
  const [errors, setErrors]       = useState({ groq: false, gemini: false });

  useEffect(() => {
    if (!open) { setStep(0); setErrors({ groq: false, gemini: false }); return; }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSavedGroq(!!d.hasGroqKey);
        setSavedGemini(!!d.hasGeminiKey);
      })
      .catch(() => {});
  }, [open]);

  // ── Wizard: avanzar de paso ──────────────────────────────────────────────
  function handleNextStep() {
    if (step === 1) {
      if (!groqKey.trim()) {
        setErrors((e) => ({ ...e, groq: true }));
        return;
      }
      if (groqKey.length < 20) {
        toast.error("La clave de Groq parece incorrecta");
        return;
      }
      setErrors((e) => ({ ...e, groq: false }));
      setStep(2);
    }
  }

  // ── Guardar (modo settings o último paso del wizard) ─────────────────────
  async function handleSave() {
    const newErrors = { groq: false, gemini: false };

    if (isOnboarding) {
      // En onboarding: ambas requeridas si no estaban guardadas
      if (!groqKey.trim() && !savedGroq)    newErrors.groq   = true;
      if (!geminiKey.trim() && !savedGemini) newErrors.gemini = true;
    } else {
      // En settings: validar solo lo que el usuario intenta ingresar
      if (groqKey && groqKey.length < 20)   { toast.error("La clave de Groq parece incorrecta");   return; }
      if (geminiKey && geminiKey.length < 20){ toast.error("La clave de Gemini parece incorrecta"); return; }
      // Si ambos vacíos y ya hay keys → cerrar sin cambios
      if (!groqKey && !geminiKey) { onClose(); return; }
    }

    if (newErrors.groq || newErrors.gemini) {
      setErrors(newErrors);
      if (newErrors.gemini) toast.error("Ingresá la clave de Gemini para continuar");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groqKey:   groqKey   || undefined,
          geminiKey: geminiKey || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("¡Claves guardadas!");
      setGroqKey("");
      setGeminiKey("");
      setErrors({ groq: false, gemini: false });
      onKeySaved?.();
      onClose();
    } catch {
      toast.error("Error al guardar. Revisá las claves e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const canClose = !isOnboarding || (savedGroq && savedGemini);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={canClose ? onClose : undefined}
            className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ${!canClose ? "cursor-not-allowed" : ""}`}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-md bg-background border border-border/50 dark:border-white/10 rounded-[28px] shadow-2xl overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ────────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-700 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                    {isOnboarding ? (
                      <Sparkles className="w-4 h-4 text-white" />
                    ) : (
                      <Key className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-foreground tracking-tight">
                      {isOnboarding ? "Primeros pasos" : "Configuración"}
                    </h2>
                    {isOnboarding && step > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Paso {step} de 2
                      </p>
                    )}
                  </div>
                </div>
                {canClose && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* ── Contenido ─────────────────────────────────────────────── */}
              <div className="px-6 pb-6">
                <AnimatePresence mode="wait">

                  {/* STEP 0: Bienvenida (solo onboarding) */}
                  {isOnboarding && step === 0 && (
                    <motion.div
                      key="welcome"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Para que archiChat funcione necesitás conectar 2 servicios de IA.
                        Los dos son <strong className="text-foreground">gratuitos</strong> y
                        te guiamos paso a paso para obtener las claves.
                      </p>

                      <div className="space-y-3">
                        <div className="flex items-start gap-4 rounded-2xl bg-orange-500/5 border border-orange-500/15 p-4">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Groq</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              El modelo de IA que lee tus documentos y genera las respuestas del chat. Ultra rápido.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                            <Brain className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Google Gemini</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              Procesa el contenido de tus documentos para que la IA pueda buscar en ellos.
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground/60 text-center">
                        Solo te lleva unos minutos. Seguí los pasos y listo.
                      </p>

                      <Button
                        onClick={() => setStep(1)}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-11 gap-2"
                      >
                        Empezar configuración
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}

                  {/* STEP 1: Clave de Groq (onboarding) */}
                  {isOnboarding && step === 1 && (
                    <motion.div
                      key="groq"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-orange-500/5 border border-orange-500/15">
                        <Zap className="w-4 h-4 text-orange-400 shrink-0" />
                        <p className="text-sm font-semibold text-foreground">Clave de Groq</p>
                      </div>

                      <StepList steps={GROQ_STEPS} />

                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-orange-500/25 bg-orange-500/5 text-sm font-bold text-orange-500 hover:bg-orange-500/10 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir Groq Console
                      </a>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Pegá tu clave acá
                        </label>
                        <KeyInput
                          value={groqKey}
                          onChange={(v) => { setGroqKey(v); setErrors((e) => ({ ...e, groq: false })); }}
                          placeholder="gsk_..."
                          error={errors.groq}
                        />
                        {errors.groq && (
                          <p className="text-xs text-red-500">Ingresá la clave de Groq para continuar</p>
                        )}
                      </div>

                      <Button
                        onClick={handleNextStep}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-11 gap-2"
                      >
                        Siguiente — Gemini
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}

                  {/* STEP 2: Clave de Gemini (onboarding) */}
                  {isOnboarding && step === 2 && (
                    <motion.div
                      key="gemini"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/15">
                        <Brain className="w-4 h-4 text-blue-400 shrink-0" />
                        <p className="text-sm font-semibold text-foreground">Clave de Google Gemini</p>
                      </div>

                      <StepList steps={GEMINI_STEPS} />

                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-blue-500/25 bg-blue-500/5 text-sm font-bold text-blue-500 hover:bg-blue-500/10 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir Google AI Studio
                      </a>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Pegá tu clave acá
                        </label>
                        <KeyInput
                          value={geminiKey}
                          onChange={(v) => { setGeminiKey(v); setErrors((e) => ({ ...e, gemini: false })); }}
                          placeholder="AIza..."
                          error={errors.gemini}
                        />
                        {errors.gemini && (
                          <p className="text-xs text-red-500">Ingresá la clave de Gemini para continuar</p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setStep(1)}
                          className="px-4 h-11 rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                        >
                          ← Atrás
                        </button>
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-11"
                        >
                          {saving ? "Guardando..." : "Guardar y empezar ✓"}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* MODO SETTINGS (no onboarding) */}
                  {!isOnboarding && (
                    <motion.div
                      key="settings"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {(savedGroq && savedGemini) && (
                        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 px-4 py-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Claves configuradas. Ingresá nuevos valores para actualizarlas.
                          </p>
                        </div>
                      )}

                      <KeySection
                        title="Clave de Groq"
                        icon={Zap}
                        iconColor="text-orange-400"
                        steps={GROQ_STEPS}
                        linkUrl="https://console.groq.com/keys"
                        linkLabel="Obtener gratis"
                        value={groqKey}
                        onChange={setGroqKey}
                        placeholder={savedGroq ? "•••••• (ya guardada — ingresá una nueva para cambiar)" : "gsk_..."}
                        saved={savedGroq}
                        error={errors.groq}
                      />

                      <KeySection
                        title="Clave de Google Gemini"
                        icon={Brain}
                        iconColor="text-blue-400"
                        steps={GEMINI_STEPS}
                        linkUrl="https://aistudio.google.com/apikey"
                        linkLabel="Obtener gratis"
                        value={geminiKey}
                        onChange={setGeminiKey}
                        placeholder={savedGemini ? "•••••• (ya guardada — ingresá una nueva para cambiar)" : "AIza..."}
                        saved={savedGemini}
                        error={errors.gemini}
                      />

                      <div className="flex items-center gap-3 pt-1">
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-11"
                        >
                          {saving ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={onClose}
                          className="rounded-2xl h-11 px-5 text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </Button>
                      </div>

                      <p className="text-center text-[10px] text-muted-foreground/40">
                        Tus claves se guardan de forma segura y solo son accesibles por vos.
                      </p>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
