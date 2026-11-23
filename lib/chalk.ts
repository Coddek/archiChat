// Tizas de colores: un color apagado para identificar de un vistazo el tipo de
// contenido o el tema. Las clases van completas para que Tailwind las detecte.

export type Chalk = "pink" | "green" | "blue" | "orange" | "violet";

export const CHALK: Record<Chalk, { text: string; tile: string; dot: string; chip: string }> = {
  pink:   { text: "text-chalk-pink",   tile: "bg-chalk-pink/15 text-chalk-pink",     dot: "bg-chalk-pink",   chip: "bg-chalk-pink/10 text-chalk-pink" },
  green:  { text: "text-chalk-green",  tile: "bg-chalk-green/15 text-chalk-green",   dot: "bg-chalk-green",  chip: "bg-chalk-green/10 text-chalk-green" },
  blue:   { text: "text-chalk-blue",   tile: "bg-chalk-blue/15 text-chalk-blue",     dot: "bg-chalk-blue",   chip: "bg-chalk-blue/10 text-chalk-blue" },
  orange: { text: "text-chalk-orange", tile: "bg-chalk-orange/15 text-chalk-orange", dot: "bg-chalk-orange", chip: "bg-chalk-orange/10 text-chalk-orange" },
  violet: { text: "text-chalk-violet", tile: "bg-chalk-violet/15 text-chalk-violet", dot: "bg-chalk-violet", chip: "bg-chalk-violet/10 text-chalk-violet" },
};

// Color fijo por tipo de documento
export const TYPE_CHALK: Record<string, Chalk> = {
  pdf: "pink",
  text: "green",
  url: "blue",
  sesion: "orange",
};

const ORDEN: Chalk[] = ["blue", "green", "pink", "violet", "orange"];

// Color estable para un texto (por ejemplo, el título de una sesión)
export function chalkFor(texto: string): Chalk {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ORDEN[h % ORDEN.length];
}
