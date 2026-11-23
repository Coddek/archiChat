"use client";

import { useEffect, useState } from "react";

// Ejemplo de una clase cualquiera, para que se entienda sin saber del tema.
const TITLE = "Economía: qué es la inflación";
const LINES = [
  { t: "00:00", text: "Bueno, arrancamos. Hoy vamos a ver qué es la inflación y por qué se mide como se mide." },
  { t: "00:10", text: "La inflación es la suba generalizada y sostenida de los precios. Generalizada: no alcanza con que suba un solo producto." },
  { t: "00:20", text: "Para medirla se usa el índice de precios al consumidor, que sigue lo que cuesta una canasta de bienes y servicios." },
  { t: "00:30", text: "Un error común: que algo suba una sola vez no es inflación. Tiene que ser sostenido en el tiempo." },
];
const CONCEPT = {
  term: "Índice de precios al consumidor",
  text: "Mide cuánto cambia, mes a mes, el precio de la canasta de productos y servicios que consume un hogar típico.",
  at: 2, // aparece con la línea 3
};
const QUESTION = "¿Entonces si sube solo la nafta no es inflación?";
const ANSWER = "Por sí sola, no: tiene que ser una suba generalizada y sostenida. Si la nafta arrastra otros precios, ahí empieza a verse en el índice.";

// Pasos: 0..3 líneas, 4 concepto (ya mostrado con la 3), 5 pregunta, 6 respuesta
const STEP_MS = 1500;

export function LiveDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStep(6); return; }
    const id = setInterval(() => setStep(s => (s >= 6 ? s : s + 1)), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const shown = Math.min(step + 1, LINES.length);
  const seconds = 69 + Math.min(step, 6) * 7;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <figure
      aria-label="Ejemplo de una sesión en vivo: la transcripción de una clase con un concepto explicado al margen y una pregunta"
      className="rounded-xl border bg-card"
    >
      <div className="flex items-center justify-between gap-4 border-b px-5 py-3 text-sm">
        <span className="min-w-0 truncate font-medium">{TITLE}</span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-muted-foreground tabular">
          <span className="h-2 w-2 rounded-full bg-live animate-live" aria-hidden />
          Escuchando {clock}
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_15rem]">
        <ol className="space-y-4 px-5 py-5 min-h-[19rem]">
          {LINES.slice(0, shown).map((l, i) => (
            <li key={l.t} className="animate-line-in grid grid-cols-[3rem_1fr] gap-3">
              <span className="pt-1 text-xs text-muted-foreground tabular">{l.t}</span>
              <p className="prose-read text-[0.98rem] leading-relaxed">
                {l.text}
                {i === shown - 1 && step < 4 && (
                  <span className="ml-0.5 inline-block w-[2px] h-[1em] translate-y-[2px] bg-primary animate-caret" aria-hidden />
                )}
              </p>
            </li>
          ))}
        </ol>

        <aside className="border-t md:border-t-0 md:border-l px-5 py-5 space-y-5 text-sm">
          {step >= CONCEPT.at ? (
            <div className="animate-line-in rounded-md border-l-2 border-chalk-blue bg-chalk-blue/10 py-2 pl-3 pr-2">
              <p className="font-medium text-chalk-blue">{CONCEPT.term}</p>
              <p className="mt-1 text-muted-foreground leading-relaxed">{CONCEPT.text}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Los conceptos que aparecen en la clase se explican acá.</p>
          )}

          {step >= 5 && (
            <div className="animate-line-in space-y-2">
              <p className="rounded-md bg-primary/15 px-3 py-2 text-foreground">{QUESTION}</p>
              {step >= 6 && (
                <p className="animate-line-in prose-read text-[0.95rem] leading-relaxed">{ANSWER}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </figure>
  );
}
