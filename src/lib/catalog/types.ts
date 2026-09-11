export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  sizes: string;
  description: string;
  discount: number;
  featured: boolean;
  soldOut: boolean;
  images: string[];
  createdAt: number;
};

export type StoreSettings = {
  brand: string;
  tagline: string;
  currency: string;
  whatsapp: string;
};

export type CatalogPayload = {
  settings: StoreSettings;
  products: Product[];
};

export type CartLine = {
  id: string;
  size: string;
  qty: number;
};

export type ProductInput = {
  id?: string;
  name: string;
  category: string;
  price: number;
  sizes: string;
  description: string;
  discount: number;
  featured: boolean;
  soldOut: boolean;
  images: string[];
};
