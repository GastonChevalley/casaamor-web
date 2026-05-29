"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import {
  getCatalogoCached,
  buscarEnCatalogo,
  type ProductoLite,
} from "@/lib/clientCatalogo";
import { SearchDropdown } from "./SearchDropdown";

const Q_MIN_CHARS = 2;
const SYNC_URL_DEBOUNCE_MS = 100;

/**
 * Buscador del header con preview dropdown estilo Tienda Nube.
 *
 * - Lazy carga del catálogo cliente al primer focus.
 * - Cada keystroke filtra in-memory (instant).
 * - En `/productos`: sincroniza ?q= con la URL via replaceState (sin re-fetch).
 * - Fuera de `/productos`: solo muestra el dropdown.
 * - Submit (Enter sin item seleccionado) → router.push a /productos?q=X.
 * - Click item → router.push a /productos/SKU.
 */
export function HeaderSearch({
  placeholder = "¿Qué estás buscando?",
  className = "",
  inline = false,
  onNavigate,
}: {
  placeholder?: string;
  className?: string;
  /** Si true, el dropdown se renderiza inline (ej dentro de MobileNav overlay). */
  inline?: boolean;
  /** Callback al navegar (ej cerrar overlay del MobileNav). */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const enProductos = pathname === "/productos";

  const qInicial = enProductos ? searchParams?.get("q") || "" : "";
  const [q, setQ] = useState(qInicial);
  const [open, setOpen] = useState(false);
  const [catalogo, setCatalogo] = useState<ProductoLite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const wrapperRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncUrlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar input con cambios externos del ?q= (ej navegación back/forward).
  useEffect(() => {
    if (enProductos) {
      const externo = searchParams?.get("q") || "";
      setQ(externo);
    }
  }, [searchParams, enProductos]);

  // Lazy load del catálogo al primer focus.
  const loadCatalogo = useCallback(async () => {
    if (catalogo) return;
    setLoading(true);
    try {
      const data = await getCatalogoCached();
      setCatalogo(data);
    } finally {
      setLoading(false);
    }
  }, [catalogo]);

  // Click fuera → cerrar dropdown.
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

  // Cleanup de timeouts al desmontar.
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (syncUrlTimeoutRef.current) clearTimeout(syncUrlTimeoutRef.current);
    };
  }, []);

  // Filtrar in-memory.
  const { matches, total } = useMemo(() => {
    if (!catalogo || q.trim().length < Q_MIN_CHARS) {
      return { matches: [] as ProductoLite[], total: 0 };
    }
    return buscarEnCatalogo(catalogo, q, 5);
  }, [catalogo, q]);

  // Sync URL en /productos (debounced).
  useEffect(() => {
    if (!enProductos) return;
    if (typeof window === "undefined") return;
    if (syncUrlTimeoutRef.current) clearTimeout(syncUrlTimeoutRef.current);
    syncUrlTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const term = q.trim();
      if (term) params.set("q", term);
      else params.delete("q");
      const next = params.toString();
      const path = window.location.pathname + (next ? `?${next}` : "");
      window.history.replaceState(null, "", path);
    }, SYNC_URL_DEBOUNCE_MS);
  }, [q, enProductos]);

  // Apertura del dropdown según q (>=2 chars y catálogo cargado o cargando).
  useEffect(() => {
    if (q.trim().length >= Q_MIN_CHARS) setOpen(true);
    else setOpen(false);
    setActiveIdx(-1);
  }, [q]);

  function onFocus() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (!catalogo) loadCatalogo();
    if (q.trim().length >= Q_MIN_CHARS) setOpen(true);
  }

  function onBlur() {
    // Esperar para permitir click en items.
    blurTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  function navegarA(sku: string) {
    setOpen(false);
    router.push(`/productos/${encodeURIComponent(sku)}`);
    if (onNavigate) onNavigate();
  }

  function navegarVerTodos() {
    const term = q.trim();
    setOpen(false);
    router.push(`/productos${term ? `?q=${encodeURIComponent(term)}` : ""}`);
    if (onNavigate) onNavigate();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (activeIdx >= 0 && matches[activeIdx]) {
      navegarA(matches[activeIdx].sku);
      return;
    }
    navegarVerTodos();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((idx) => Math.min((matches.length || 1) - 1, idx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((idx) => Math.max(-1, idx - 1));
    } else if (e.key === "Escape") {
      if (open) {
        setOpen(false);
      } else if (q) {
        setQ("");
      }
    }
  }

  return (
    <form
      ref={wrapperRef}
      onSubmit={onSubmit}
      className={`relative w-full max-w-md ${className}`}
      role="search"
    >
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full pl-4 pr-10 py-2 rounded-full bg-cream-light/15 text-cream-light placeholder:text-cream-light/60 border border-cream-light/30 focus:outline-none focus:border-gold focus:bg-cream-light/25 transition-colors text-sm"
        aria-label="Buscar productos"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="search-dropdown"
        aria-activedescendant={
          activeIdx >= 0 ? `search-opt-${activeIdx}` : undefined
        }
        autoComplete="off"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-cream-light/70 hover:text-gold hover:bg-cream-light/10 transition-colors"
      >
        <Search size={18} />
      </button>

      {open && (
        <div id="search-dropdown">
          <SearchDropdown
            matches={matches}
            total={total}
            q={q}
            loading={loading && !catalogo}
            activeIdx={activeIdx}
            inline={inline}
            onSelect={navegarA}
            onSeeAll={navegarVerTodos}
          />
        </div>
      )}
    </form>
  );
}
