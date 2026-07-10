"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-burgundy/20 bg-cream-light px-3 py-2 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent";

/**
 * Formulario del Botón de Arrepentimiento (Res. 424/2020). NO pide registro/login
 * (la ley lo prohíbe). Al enviar, el backend genera un código de trámite y lo
 * muestra en el acto + lo manda por email (cumple el requisito de las 24 hs).
 */
export function ArrepentimientoClient({ whatsapp }: { whatsapp?: string }) {
  const [form, setForm] = useState({ nombre: "", email: "", dni: "", orden: "", motivo: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const wa = String(whatsapp || "").replace(/[^0-9]/g, "");

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) return setError("Ingresá tu nombre.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError("Ingresá un email válido.");
    if (!form.orden.trim()) return setError("Ingresá el número de pedido.");
    setEnviando(true);
    try {
      const r = await fetch("/api/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json().catch(() => ({}));
      setEnviando(false);
      if (!r.ok || !data.ok || !data.codigo) {
        setError(
          "No pudimos registrar tu solicitud en este momento. Reintentá en un ratito" +
            (wa ? " o escribinos por WhatsApp." : "."),
        );
        return;
      }
      setCodigo(String(data.codigo));
    } catch {
      setEnviando(false);
      setError("Error de conexión. Reintentá.");
    }
  }

  if (codigo) {
    return (
      <div className="rounded-xl border border-emerald-600/30 bg-emerald-50/60 p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-700 mb-3" size={40} />
        <h2 className="font-heading text-2xl text-burgundy mb-2">Solicitud registrada</h2>
        <p className="text-ink/80 mb-4">Guardá este código de trámite:</p>
        <p className="font-heading text-2xl sm:text-3xl text-burgundy tracking-wide bg-cream-light rounded-lg py-3 px-4 inline-block mb-4">
          {codigo}
        </p>
        <p className="text-ink/80 text-sm leading-relaxed">
          Te lo enviamos también por email. Nos vamos a comunicar con vos dentro de las{" "}
          <strong>próximas 24 horas</strong> para coordinar la devolución del producto (el envío de
          vuelta corre por nuestra cuenta) y la devolución del <strong>100% de tu dinero</strong>.
        </p>
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent("Hola, hice una solicitud de arrepentimiento. Código: " + codigo)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-cream-light font-semibold py-2.5 px-5 rounded-lg transition-colors"
          >
            Coordinar por WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-burgundy/10 bg-cream/30 p-5 sm:p-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60 mb-1 block">
            Nombre y apellido <span className="text-red-700">*</span>
          </span>
          <input type="text" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputClass} required />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60 mb-1 block">
            Email <span className="text-red-700">*</span>
          </span>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} required />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60 mb-1 block">DNI</span>
          <input type="text" inputMode="numeric" value={form.dni} onChange={(e) => set("dni", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60 mb-1 block">
            Número de pedido <span className="text-red-700">*</span>
          </span>
          <input
            type="text"
            value={form.orden}
            onChange={(e) => set("orden", e.target.value)}
            className={inputClass}
            placeholder="Está en el email de tu compra"
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink/60 mb-1 block">Motivo (opcional)</span>
        <textarea value={form.motivo} onChange={(e) => set("motivo", e.target.value)} className={`${inputClass} h-24`} placeholder="No es obligatorio dar un motivo." />
      </label>

      {error && (
        <div className="text-sm text-burgundy bg-rose/10 border border-rose/30 rounded p-3">{error}</div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex items-center justify-center gap-2 w-full bg-burgundy hover:bg-burgundy-dark text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-60"
      >
        {enviando ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Enviando…
          </>
        ) : (
          "Solicitar arrepentimiento"
        )}
      </button>
      <p className="text-xs text-ink/50 text-center">
        No necesitás registrarte. Te damos un código en el acto y te contactamos dentro de las 24 hs.
      </p>
    </form>
  );
}
