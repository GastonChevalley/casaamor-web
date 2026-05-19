# CasaAmor — Sitio público

E-commerce custom para reemplazar Tienda Nube. Construido con Next.js 15 + Tailwind v4 + Mercado Pago Bricks (próxima fase).

## Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Estilos**: Tailwind CSS v4 con paleta CasaAmor (burgundy / gold / cream / rose)
- **Fuentes**: Geist (sans) + Fraunces (serif para headings)
- **Hosting target**: Vercel (free tier) o Cloudflare Pages
- **Backend**: consume datos del Apps Script existente vía `?api=` endpoints (próxima fase)
- **Pagos**: Mercado Pago Bricks (próxima fase)

## Estructura

```
src/
├── app/
│   ├── layout.tsx        Root layout con Header + Footer + WhatsApp button
│   ├── page.tsx          Home (hero + destacados + sobre nosotras)
│   ├── globals.css       Paleta CasaAmor en CSS variables
│   ├── icon.png          Favicon auto (App Router convention)
│   ├── productos/
│   │   ├── page.tsx      Catálogo (placeholder)
│   │   └── [sku]/page.tsx Detalle producto (placeholder)
│   ├── sobre/page.tsx
│   ├── contacto/page.tsx
│   └── envios/page.tsx
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Hero.tsx
│   └── WhatsappButton.tsx
└── lib/
    └── api.ts            Cliente para Apps Script (stubs, próxima fase)
```

## Setup local

```bash
npm install
cp .env.local.example .env.local   # opcional: completar cuando estén las credenciales
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Roadmap

Ver el plan completo en el repo principal (Addendums 36 y 37).

- ✅ Fase 1: Bootstrap + branding + páginas skeleton
- 🔲 Fase 2: Endpoint público en Apps Script + lib/api.ts real
- 🔲 Fase 3: Hero + secciones home con data real
- 🔲 Fase 4: Catálogo + detalle con filtros y búsqueda
- 🔲 Fase 5: Carrito + checkout Mercado Pago Bricks
- 🔲 Fase 6: Tab admin "🎨 Sitio Web" en la PWA existente
- 🔲 Fase 7: SEO, sitemap, OG dinámico
- 🔲 Fase 8: Testing E2E + launch

## Paleta de marca

| Token | Hex | Uso |
|---|---|---|
| burgundy | `#7c2440` | Headings, header |
| burgundy-dark | `#5a1a2e` | Hover fuerte |
| rose | `#b24967` | Acentos, fondo logo |
| gold | `#c89e4b` | Botones primarios, links |
| gold-dark | `#a87d2e` | Hover botones |
| cream | `#f0e6d2` | Fondos suaves |
| cream-light | `#fff8e9` | Fondo página |
| ink | `#1f2937` | Texto cuerpo |
