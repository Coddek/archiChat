// hooks/useDocumentPiP.ts
// Ventana flotante "siempre encima" con Document Picture-in-Picture (Chrome/Edge 116+).
// La página renderiza su contenido ahí con un portal de React, así comparten el estado.

"use client";

import { useCallback, useEffect, useState } from "react";

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

function getApi(): DocumentPictureInPicture | undefined {
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
}

// La ventana nueva arranca vacía: se le copian los estilos (Tailwind, variables
// del tema) y las clases de <html>/<body> (modo oscuro, fuentes)
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.document.createElement("style");
      style.textContent = Array.from(sheet.cssRules).map(r => r.cssText).join("\n");
      target.document.head.appendChild(style);
    } catch {
      // Hojas de otro dominio: no se pueden leer, se enlazan
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.documentElement.className = document.documentElement.className;
  target.document.documentElement.style.cssText = document.documentElement.style.cssText;
  target.document.body.className = document.body.className;
}

export function useDocumentPiP() {
  const [supported, setSupported] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  useEffect(() => { setSupported(!!getApi()); }, []);

  // Si cambia el tema (claro/oscuro) en la página, se refleja en la ventana
  useEffect(() => {
    if (!pipWindow) return;
    const observer = new MutationObserver(() => {
      pipWindow.document.documentElement.className = document.documentElement.className;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [pipWindow]);

  // Tiene que llamarse desde un click (el navegador lo exige)
  const open = useCallback(async (width = 380, height = 580) => {
    const api = getApi();
    if (!api) return null;
    if (api.window) return api.window;
    const win = await api.requestWindow({ width, height });
    copyStyles(win);
    win.document.title = "archiChat en vivo";
    win.addEventListener("pagehide", () => setPipWindow(null), { once: true });
    setPipWindow(win);
    return win;
  }, []);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  return { supported, pipWindow, open, close };
}
