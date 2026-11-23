import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileText, Mic, type LucideIcon } from "lucide-react";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { CHALK, type Chalk } from "@/lib/chalk";
import { cn } from "@/lib/utils";

const GITHUB = "https://github.com/Coddek/archiChat";
const PORTFOLIO = "https://portfolio-coddeks-projects.vercel.app/";

const MODES: { title: string; intro: string; items: string[]; icon: LucideIcon; chalk: Chalk }[] = [
  {
    icon: FileText,
    chalk: "pink",
    title: "Con tus documentos",
    intro: "Subís un PDF, un texto o una página web y le preguntás lo que quieras.",
    items: [
      "Cada respuesta muestra los fragmentos de donde salió y qué tan respaldada está.",
      "Entiende preguntas de seguimiento sin repetir el contexto.",
      "Si la respuesta no está en el documento, busca en la web.",
    ],
  },
  {
    icon: Mic,
    chalk: "orange",
    title: "Con lo que estás escuchando",
    intro: "Le das play a una clase, un video o una reunión de Zoom o Meet.",
    items: [
      "Transcribe cada diez segundos, con el minuto de cada frase.",
      "Explica los conceptos clave a medida que aparecen.",
      "Una ventana flotante queda encima del video para preguntar sin salir.",
      "Al terminar arma un resumen y tarjetas de repaso para Anki.",
    ],
  },
];

const DECISIONS = [
  {
    title: "Sin depender de un solo proveedor",
    text: "Cada llamada a un modelo tiene un respaldo en otro proveedor, y los modelos se definen en un único archivo. Si uno deja de estar disponible, la app sigue respondiendo.",
  },
  {
    title: "Transcripción estable en segundo plano",
    text: "Los navegadores frenan los temporizadores de las pestañas ocultas. La captura corre en un Web Worker, así la sesión sigue aunque el video esté en primer plano.",
  },
  {
    title: "Filtro de errores de transcripción",
    text: "Los modelos de voz pueden inventar frases cuando hay silencio. Esos casos se detectan y descartan, con tests, y un medidor de volumen evita enviar tramos sin habla.",
  },
  {
    title: "Datos aislados por usuario",
    text: "Todas las tablas tienen Row Level Security en Postgres: cada cuenta accede solo a sus documentos y sesiones, garantizado por la base de datos.",
  },
];

const DECISION_CHALK: Chalk[] = ["blue", "green", "pink", "violet"];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-semibold tracking-tight">archiChat</span>
        <nav className="flex items-center gap-5 text-sm">
          <a href={GITHUB} className="text-muted-foreground hover:text-foreground">Código</a>
          <Link href="/auth" className="text-muted-foreground hover:text-foreground">Ingresar</Link>
        </nav>
      </header>

      <section className="grid items-start gap-12 pb-24 pt-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:pt-16">
        <div>
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Escucha la clase con vos y te la explica mientras pasa.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
            archiChat transcribe clases y reuniones en vivo, explica los conceptos que van apareciendo
            y después te deja chatear con todo lo que escuchaste. También con tus PDFs y apuntes,
            citando de dónde sale cada respuesta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={GITHUB}
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver el código en GitHub
            </a>
            <a
              href="#como-esta-hecho"
              className="inline-flex h-11 items-center rounded-md border px-5 text-sm font-medium hover:bg-secondary"
            >
              Cómo está hecho
            </a>
          </div>
        </div>

        <LiveDemo />
      </section>

      <section className="border-t py-20" aria-labelledby="modos">
        <h2 id="modos" className="text-2xl font-semibold tracking-tight">Dos formas de usarlo</h2>
        <div className="mt-10 grid gap-12 md:grid-cols-2">
          {MODES.map(m => (
            <div key={m.title}>
              <span aria-hidden className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-md", CHALK[m.chalk].tile)}>
                <m.icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-medium">{m.title}</h3>
              <p className="mt-2 text-muted-foreground">{m.intro}</p>
              <ul className="mt-5 space-y-3">
                {m.items.map(it => (
                  <li key={it} className="flex gap-3 leading-relaxed">
                    <span className={cn("mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full", CHALK[m.chalk].dot)} aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="como-esta-hecho" className="border-t py-20" aria-labelledby="hecho">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div>
            <h2 id="hecho" className="text-2xl font-semibold tracking-tight">Cómo está hecho</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Next.js y TypeScript en el frontend y el backend, Postgres con pgvector para la
              búsqueda semántica, y modelos de lenguaje y de voz con respaldo entre proveedores.
              Cubierto por 92 tests automatizados.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {DECISIONS.map((d, i) => (
              <div key={d.title} className="border-t-2 pt-4" style={{ borderTopColor: `hsl(var(--chalk-${DECISION_CHALK[i]}))` }}>
                <dt className="font-medium">{d.title}</dt>
                <dd className="mt-2 prose-read text-[0.98rem] leading-relaxed text-muted-foreground">{d.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Hecho por{" "}
          <a href={PORTFOLIO} className="text-foreground underline-offset-4 hover:underline">Agustín Novarese</a>.
        </p>
        <a href={GITHUB} className="hover:text-foreground">github.com/Coddek/archiChat</a>
      </footer>
    </div>
  );
}
