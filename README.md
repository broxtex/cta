# Catálogo — Tienda de Smith

Catálogo de streetwear. El dueño y el staff gestionan la tienda; los clientes ven prendas y envían pedidos por WhatsApp (sin cuenta).

## Requisitos

- Node.js 22+
- npm

En **local** la base de datos es **PGlite** (embebida, no necesitas Postgres).  
En **producción** se usa **Neon Postgres** (`DATABASE_URL`).

## Cómo correrlo en local

```bash
git clone <tu-repo>
cd catalogo
npm install
npm run dev
```

Abre http://localhost:8080

### Cuenta del dueño (primera vez)

| Campo      | Valor       |
| ---------- | ----------- |
| Usuario    | `smith`     |
| Contraseña | `smith2026` |

En producción cambia la contraseña o define `SMITH_OWNER_PASSWORD` **antes** del primer arranque.

## Desplegar en Vercel + Neon (base de datos)

### 1. Crear la base de datos en Neon

1. Entra en [console.neon.tech](https://console.neon.tech) y crea un proyecto.
2. Copia el **Connection string** (formato `postgresql://...`).  
   Usa el que diga `?sslmode=require`.

### 2. Subir el código a GitHub

1. Crea un repositorio vacío en GitHub.
2. Sube **solo** el contenido de este proyecto (no subas `.env`, `node_modules`, `.grok`, etc.).
3. El `.gitignore` ya excluye lo necesario.

```bash
git init
git add .
git commit -m "Catálogo listo para Vercel + Neon"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 3. Crear el proyecto en Vercel

1. En [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa el repositorio de GitHub.
3. **Framework Preset**: deja que detecte o elige **Other** (Nitro se encarga).
4. **Build Command**: `npm run build` (ya está en package.json).
5. **Output Directory**: déjalo vacío (Nitro + preset `vercel` genera `.vercel/output`).
6. **Install Command**: `npm install` (por defecto).

### 4. Variables de entorno (obligatorias)

En Vercel → Project → **Settings → Environment Variables**, agrega:

| Nombre                 | Valor                                      | Notas |
|------------------------|--------------------------------------------|-------|
| `DATABASE_URL`         | el connection string de Neon               | obligatorio |
| `BETTER_AUTH_SECRET`   | un secreto largo (ej. `openssl rand -base64 32`) | obligatorio |
| `BETTER_AUTH_URL`      | `https://tu-proyecto.vercel.app`           | la URL que te da Vercel (sin / al final) |
| `SMITH_OWNER_PASSWORD` | (opcional) tu contraseña de dueño          | solo se usa la 1ª vez |

Marca las 3 primeras para **Production**, **Preview** y **Development**.

### 5. Desplegar

Pulsa **Deploy**.  
Las migraciones (`migrations/*.sql`) se aplican automáticamente durante `npm run build` cuando existe `DATABASE_URL`.

Si ves **404 NOT_FOUND** después del deploy:

- Revisa que las variables de entorno estén configuradas y vuelve a desplegar.
- En **Deployments** abre el build log y confirma que no hay errores.
- La URL de producción debe ser la raíz (`/`), no una subruta.

### 6. Primer acceso

1. Abre la URL de Vercel.
2. Entra con `smith` / la contraseña que configuraste (o `smith2026`).
3. Edita la tienda (nombre, eslogan, moneda RD$, WhatsApp con código de país).
4. Agrega prendas.

## Scripts útiles

| Comando            | Qué hace                          |
|--------------------|-----------------------------------|
| `npm run dev`      | Desarrollo en :8080               |
| `npm run build`    | Build de producción + migraciones |
| `npm run typecheck`| TypeScript                        |
| `npm run preview`  | Sirve el build localmente         |

## Estructura

```
src/
  components/catalog/   UI del catálogo
  lib/catalog/          pedidos, staff, base de datos
  routes/               / y /login
migrations/             esquema SQL (auth + catálogo + staff)
public/                 favicon y OG
```

## Licencia

Uso privado de Tienda de Smith.
