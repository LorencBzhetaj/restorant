"use client";

import { useEffect } from "react";

/**
 * When the reservation widget is embedded in an iframe, this posts the document
 * height to the parent window so the host page (e.g. WordPress) can size the
 * iframe to fit — no scrollbars. Harmless when not embedded.
 */
export function EmbedResizer() {
  useEffect(() => {
    if (window.parent === window) return; // not embedded
    // Target the embedding page's own origin (from the referrer) rather than "*".
    let parentOrigin = "*";
    try {
      if (document.referrer) parentOrigin = new URL(document.referrer).origin;
    } catch {
      parentOrigin = "*";
    }
    const post = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "gjecaj:resize", height }, parentOrigin);
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    const t = setInterval(post, 1000); // catch late layout shifts
    window.addEventListener("load", post);
    return () => {
      ro.disconnect();
      clearInterval(t);
      window.removeEventListener("load", post);
    };
  }, []);
  return null;
}
