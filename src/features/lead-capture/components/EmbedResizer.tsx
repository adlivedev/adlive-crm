"use client";

import { useEffect } from "react";

/**
 * Auto-height del formulario embebido: observa el alto real del documento y
 * se lo pasa a la página padre para que el <iframe> quede exacto (sin scroll).
 */
export function EmbedResizer() {
  useEffect(() => {
    if (window.parent === window) return;
    const send = () => {
      const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
      window.parent.postMessage({ type: "crm-embed-resize", height: String(Math.ceil(height)) }, "*");
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.documentElement);
    window.addEventListener("load", send);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", send);
    };
  }, []);
  return null;
}
