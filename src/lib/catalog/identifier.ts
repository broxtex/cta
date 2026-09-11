/** Synthetic domain so a plain username is a valid Better Auth email. */
export const STORE_EMAIL_DOMAIN = "tienda.local";

export function identifierToEmail(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) throw new Error("Escribe un usuario o correo.");
  if (s.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
      throw new Error("El correo no se ve válido.");
    }
    return s;
  }
  const slug = s.replace(/[^a-z0-9._-]+/g, "").slice(0, 40);
  if (slug.length < 2) throw new Error("El usuario debe tener al menos 2 caracteres.");
  return `${slug}@${STORE_EMAIL_DOMAIN}`;
}

export function displayIdentifier(email: string): string {
  const suffix = `@${STORE_EMAIL_DOMAIN}`;
  if (email.toLowerCase().endsWith(suffix)) return email.slice(0, -suffix.length);
  return email;
}
