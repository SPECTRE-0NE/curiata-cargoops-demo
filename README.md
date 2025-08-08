# Curiata CargoOps (Demo)

Vite + React + Tailwind + Recharts single-page app. LocalStorage demo data, role-based routes, CSV export, and simple print-to-PDF download.

## Quick start

```bash
npm i
npm run dev
# open http://localhost:5173
```

**Demo users**

- admin@curiata.dev / admin123
- supervisor@curiata.dev / super123
- viewer@curiata.dev / view123

## Build

```bash
npm run build
npm run preview
```

The SPA is output to `dist/` and is static-host friendly.

## Deploy (pick one)

### Vercel
- `npm i -g vercel`
- `vercel` (link or create project) — when asked for framework, select **Vite**.
- Set project name/slug: `curiata-cargoops-demo`.

### Netlify
- `npm i -g netlify-cli`
- `netlify deploy` (select **dist/** as the build output, command: `vite build`).

### Cloudflare Pages
- Create a project from this folder.
- Build command: `npm run build`
- Output: `dist`

