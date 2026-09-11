import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { CatalogPayload, Product, StoreSettings } from "./types";
import { requireStaff, ensureSmithOwner } from "./staff";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: string | number;
  sizes: string;
  description: string;
  discount: string | number;
  featured: boolean | string | number;
  sold_out: boolean | string | number;
  images: unknown;
  created_at: string | Date;
};

function asBool(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

function asImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category || "",
    price: Number(row.price) || 0,
    sizes: row.sizes || "",
    description: row.description || "",
    discount: Number(row.discount) || 0,
    featured: asBool(row.featured),
    soldOut: asBool(row.sold_out),
    images: asImages(row.images),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

async function loadSeed(): Promise<{
  brand: string;
  tagline: string;
  currency: string;
  whatsapp: string;
  products: Product[];
}> {
  return (await import("./seed-data.json")).default as {
    brand: string;
    tagline: string;
    currency: string;
    whatsapp: string;
    products: Product[];
  };
}

async function ensureSeeded() {
  const sql = await getSql();
  await ensureSmithOwner();
  const countRows = await sql<{ n: number }>`select count(*)::int as n from products`;
  const n = Number(countRows[0]?.n ?? 0);
  if (n > 0) return;
  const seed = await loadSeed();

  const settingsRows = await sql<{ n: number }>`select count(*)::int as n from store_settings`;
  if (Number(settingsRows[0]?.n ?? 0) === 0) {
    await sql.query(
      `insert into store_settings (id, brand, tagline, currency, whatsapp)
       values ('default', $1, $2, $3, $4)`,
      [seed.brand, seed.tagline, seed.currency, seed.whatsapp],
    );
  }

  for (let i = 0; i < seed.products.length; i += 20) {
    const chunk = seed.products.slice(i, i + 20);
    const placeholders = chunk
      .map((_, j) => {
        const o = j * 11;
        return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10}::jsonb, to_timestamp($${o + 11} / 1000.0))`;
      })
      .join(",");
    const params: unknown[] = [];
    for (const p of chunk) {
      params.push(
        p.id,
        p.name,
        p.category,
        p.price,
        p.sizes,
        p.description,
        p.discount,
        p.featured,
        p.soldOut,
        JSON.stringify(p.images),
        typeof p.createdAt === "number" ? p.createdAt : Date.now(),
      );
    }
    await sql.query(
      `insert into products
        (id, name, category, price, sizes, description, discount, featured, sold_out, images, created_at)
       values ${placeholders}
       on conflict (id) do nothing`,
      params,
    );
  }
}

const productInput = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40),
  price: z.number().min(0).max(10_000_000),
  sizes: z.string().max(80),
  description: z.string().max(220),
  discount: z.number().min(0).max(90),
  featured: z.boolean(),
  soldOut: z.boolean(),
  images: z.array(z.string()).max(8),
});

export const getCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogPayload> => {
    await ensureSeeded();
    const sql = await getSql();
    const settingsRows = await sql<{
      brand: string;
      tagline: string;
      currency: string;
      whatsapp: string;
    }>`select brand, tagline, currency, whatsapp from store_settings where id = 'default'`;
    const productRows = await sql<ProductRow>`
      select id, name, category, price, sizes, description, discount, featured, sold_out, images, created_at
      from products
      order by created_at desc
    `;
    const seed = await loadSeed();
    const settings: StoreSettings = settingsRows[0] ?? {
      brand: seed.brand,
      tagline: seed.tagline,
      currency: seed.currency,
      whatsapp: seed.whatsapp,
    };
    return {
      settings,
      products: productRows.map(mapProduct),
    };
  },
);

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => productInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const id =
      data.id && data.id.trim()
        ? data.id.trim()
        : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const existing = await sql<{ id: string }>`select id from products where id = ${id}`;
    if (existing.length) {
      await sql.query(
        `update products set
          name = $2, category = $3, price = $4, sizes = $5, description = $6,
          discount = $7, featured = $8, sold_out = $9, images = $10::jsonb, updated_at = now()
         where id = $1`,
        [
          id,
          data.name,
          data.category,
          data.price,
          data.sizes,
          data.description,
          data.discount,
          data.featured,
          data.soldOut,
          JSON.stringify(data.images),
        ],
      );
    } else {
      await sql.query(
        `insert into products
          (id, name, category, price, sizes, description, discount, featured, sold_out, images, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [
          id,
          data.name,
          data.category,
          data.price,
          data.sizes,
          data.description,
          data.discount,
          data.featured,
          data.soldOut,
          JSON.stringify(data.images),
          context.userId,
        ],
      );
    }
    return { id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql.query(`delete from products where id = $1`, [data.id]);
    return { ok: true as const };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        brand: z.string().trim().min(1).max(40),
        tagline: z.string().trim().max(80),
        currency: z.string().trim().min(1).max(8),
        whatsapp: z.string().trim().max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql.query(
      `insert into store_settings (id, brand, tagline, currency, whatsapp, updated_at)
       values ('default', $1, $2, $3, $4, now())
       on conflict (id) do update set
         brand = excluded.brand,
         tagline = excluded.tagline,
         currency = excluded.currency,
         whatsapp = excluded.whatsapp,
         updated_at = now()`,
      [data.brand, data.tagline, data.currency, data.whatsapp],
    );
    return { ok: true as const };
  });

const bulkItem = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).optional(),
  images: z.array(z.string()).min(1).max(4),
});

export const bulkAddProducts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ items: z.array(bulkItem).min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const ids: string[] = [];
    for (const item of data.items) {
      const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await sql.query(
        `insert into products
          (id, name, category, price, sizes, description, discount, featured, sold_out, images, created_by)
         values ($1,$2,$3,0,'','',0,false,false,$4::jsonb,$5)`,
        [id, item.name, item.category || "", JSON.stringify(item.images), context.userId],
      );
      ids.push(id);
    }
    return { ids };
  });

export const suggestFromPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ image: z.string().min(20).max(2_000_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "La sugerencia con IA no está disponible ahora." };
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 220,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: data.image } },
              {
                type: "text",
                text: 'Analiza esta foto de una prenda o accesorio para un catálogo de ropa streetwear. Responde SOLO JSON válido, sin markdown, con exactamente estas claves: {"nombre":"...","categoria":"...","descripcion":"..."}. "nombre": corto, máximo 8 palabras. "categoria": una de Blusas, Camisas, Pantalones, Vestidos, Faldas, Chaquetas, Zapatos, Accesorios, Deportiva, Gorras, Tenis, Bermudas, Crocs, Suéteres, Correas, Polos, Conjuntos, u otra breve. "descripcion": máximo 15 palabras sobre color y tela.',
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false as const, error: "No se pudo analizar la foto. Escríbela a mano." };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (body.choices?.[0]?.message?.content || "")
      .replace(/```json|```/g, "")
      .trim();
    try {
      const parsed = JSON.parse(text) as {
        nombre?: string;
        categoria?: string;
        descripcion?: string;
      };
      return {
        ok: true as const,
        nombre: String(parsed.nombre || "").slice(0, 80),
        categoria: String(parsed.categoria || "").slice(0, 40),
        descripcion: String(parsed.descripcion || "").slice(0, 220),
      };
    } catch {
      return { ok: false as const, error: "No se pudo leer la sugerencia. Escríbela a mano." };
    }
  });
