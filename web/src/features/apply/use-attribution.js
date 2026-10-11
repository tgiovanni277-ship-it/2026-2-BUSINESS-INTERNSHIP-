"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Captura utm_* y fbclid de la URL del anuncio de Meta
export function useAttribution() {
  const params = useSearchParams();
  const [data, setData] = useState({ utm: {}, fbclid: undefined });

  useEffect(() => {
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem("attribution") || "{}"); } catch {}

    const utm = { ...(saved.utm ?? {}) };
    for (const [k, v] of params.entries()) if (k.startsWith("utm_")) utm[k] = v.slice(0, 200);
    const fbclid = params.get("fbclid") ?? saved.fbclid;
    const next = { utm, fbclid };

    try { sessionStorage.setItem("attribution", JSON.stringify(next)); } catch {}
    // La atribución de la URL debe estar disponible en el primer envío del formulario.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(next);
  }, [params]);

  return data;
}
