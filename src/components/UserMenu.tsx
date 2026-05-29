"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { User, Check } from "lucide-react";

type EstadoSuscripcion = "idle" | "loading" | "success" | "ya_suscripto" | "error";

/**
 * Icono de Usuario en el header. Por ahora (sin checkout MP) abre un
 * dropdown con:
 *   - "Cuenta — Próximamente" (placeholder visual).
 *   - Form de suscripción al newsletter.
 *
 * Cuando llegue la Fase 5 (checkout MP), se reemplaza por login real.
 * Mientras tanto, se recolecta una lista warm de emails interesados.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<EstadoSuscripcion>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click fuera → cerrar.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Esc → cerrar.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado === "loading") return;
    const value = email.trim();
    if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setEstado("error");
      setErrorMsg("Email inválido");
      return;
    }
    setEstado("loading");
    setErrorMsg("");
    try {
      const r = await fetch("/api/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, origen: "header_dropdown" }),
      });
      const data = await r.json().catch(() => ({ error: "bad_response" }));
      if (!r.ok || data.error) {
        setEstado("error");
        setErrorMsg(
          data.error === "email_invalido"
            ? "Email inválido"
            : "No pudimos guardar tu email. Probá de nuevo.",
        );
        return;
      }
      setEstado(data.status === "ya_suscripto" ? "ya_suscripto" : "success");
    } catch {
      setEstado("error");
      setErrorMsg("Error de red. Probá de nuevo.");
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        aria-expanded={open}
        className="p-2 -mr-1 rounded text-cream-light hover:bg-burgundy-dark transition-colors"
      >
        <User size={22} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Cuenta y novedades"
          className="absolute right-0 top-full mt-2 w-72 bg-cream-light rounded-xl shadow-xl ring-1 ring-burgundy/10 overflow-hidden z-30 text-ink"
        >
          {/* Placeholder "Cuenta" */}
          <div className="px-4 py-3 border-b border-burgundy/10 flex items-center gap-2 text-sm text-ink/40">
            <User size={16} />
            <span>Cuenta — Próximamente</span>
          </div>

          {/* Form suscripción */}
          <div className="p-4">
            {estado === "success" || estado === "ya_suscripto" ? (
              <div className="text-sm text-burgundy flex items-start gap-2 py-2">
                <Check size={18} className="shrink-0 mt-0.5 text-green-700" />
                <div>
                  <p className="font-semibold">
                    {estado === "success" ? "¡Listo!" : "Ya estabas suscripto"}
                  </p>
                  <p className="text-ink/70 text-xs mt-1">
                    Te avisamos cuando puedas comprar online y de las próximas ofertas.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-2">
                <p className="text-xs font-semibold text-burgundy uppercase tracking-wider">
                  💌 Recibí novedades
                </p>
                <p className="text-xs text-ink/60 leading-snug">
                  Pronto vas a poder comprar online con tu cuenta. Dejanos tu mail y te avisamos.
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (estado === "error") {
                        setEstado("idle");
                        setErrorMsg("");
                      }
                    }}
                    placeholder="tu@email.com"
                    required
                    disabled={estado === "loading"}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-burgundy/20 bg-white text-ink placeholder:text-ink/40 focus:outline-none focus:border-burgundy/50"
                    aria-label="Tu email"
                  />
                  <button
                    type="submit"
                    disabled={estado === "loading"}
                    className="px-3 py-2 text-sm font-semibold bg-burgundy text-cream-light rounded-lg hover:bg-burgundy-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {estado === "loading" ? "..." : "OK"}
                  </button>
                </div>
                {estado === "error" && (
                  <p className="text-xs text-red-600">{errorMsg}</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
