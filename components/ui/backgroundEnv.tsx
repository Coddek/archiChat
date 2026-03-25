"use client";

export const BackgroundEnv = () => {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-background">

      {/* Dot pattern — más visible en light, más sutil en dark */}
      <div
        className="absolute inset-0 opacity-[0.25] dark:opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--primary) / 0.4) 0.5px, transparent 0.5px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Orbe 1 — violet top-left
          Light: más opaco para que se vea sobre el lavanda
          Dark: intenso */}
      <div className="orb-1 absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px]"
        style={{ background: "hsl(var(--primary) / 0.15)" }}
      />

      {/* Orbe 2 — indigo bottom-right */}
      <div className="orb-2 absolute bottom-[-5%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[140px] bg-violet-500/[0.09] dark:bg-indigo-600/[0.16]" />

      {/* Orbe 3 — azul suave — solo visible en dark */}
      <div className="orb-3 absolute top-[25%] right-[5%] w-[350px] h-[350px] rounded-full blur-[110px] bg-transparent dark:bg-blue-700/[0.09]" />

      {/* Orbe extra light — pink/rose suave solo en light, da calidez */}
      <div className="orb-1 absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full blur-[130px] bg-violet-300/[0.12] dark:bg-transparent" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_20%,hsl(var(--background))_80%)]" />
    </div>
  );
};
