"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Barra de búsqueda del header. Al submit (Enter o click en lupa),
 * navega a `/productos?q=<texto>` que el catálogo lee como filtro inicial.
 */
export function HeaderSearch({
  placeholder = "¿Qué estás buscando?",
  className = "",
}: {
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      router.push(`/productos?q=${encodeURIComponent(term)}`);
    } else {
      router.push("/productos");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`relative flex-1 max-w-md ${className}`}
      role="search"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-4 pr-10 py-2 rounded-full bg-cream-light/15 text-cream-light placeholder:text-cream-light/60 border border-cream-light/30 focus:outline-none focus:border-gold focus:bg-cream-light/25 transition-colors text-sm"
        aria-label="Buscar productos"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-cream-light/70 hover:text-gold hover:bg-cream-light/10 transition-colors"
      >
        <Search size={18} />
      </button>
    </form>
  );
}
