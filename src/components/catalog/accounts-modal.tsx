import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  createStaffAccount,
  deleteStaffAccount,
  listAccounts,
  type StaffAccount,
  type StaffRole,
} from "@/lib/catalog/staff";

export function AccountsModal({
  open,
  onClose,
  myId,
  myRole,
}: {
  open: boolean;
  onClose: () => void;
  myId: string | null;
  myRole: StaffRole | null;
}) {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = myRole === "owner";

  async function refresh() {
    setLoading(true);
    try {
      setAccounts(await listAccounts());
    } catch {
      toast("No se pudieron cargar las cuentas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setError("");
      setName("");
      setIdentifier("");
      setPassword("");
      void refresh();
    }
  }, [open]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!isOwner) {
      setError("Solo el dueño puede crear cuentas.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await createStaffAccount({
        data: { name: name.trim(), identifier: identifier.trim(), password },
      });
      toast("Cuenta creada");
      setName("");
      setIdentifier("");
      setPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(account: StaffAccount) {
    if (!window.confirm(`¿Borrar la cuenta de “${account.name}”? Ya no podrá entrar.`)) return;
    try {
      await deleteStaffAccount({ data: { userId: account.id } });
      toast("Cuenta borrada");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo borrar");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cuentas del equipo">
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Crea usuarios con contraseña para que otras personas ayuden con el catálogo. Smith es el
        único dueño. Los clientes no necesitan cuenta.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Cargando cuentas…</p>
      ) : (
        <ul className="mb-5 flex flex-col gap-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {a.name}
                  {a.id === myId ? (
                    <span className="ml-1.5 text-xs font-medium text-muted"> (tú)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {a.identifier}
                  {a.role === "owner" ? " · dueño" : " · equipo"}
                </p>
              </div>
              {isOwner && a.role !== "owner" && a.id !== myId ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-error underline-offset-2 hover:underline"
                  onClick={() => void onDelete(a)}
                >
                  Borrar
                </button>
              ) : null}
            </li>
          ))}
          {accounts.length === 0 ? (
            <li className="text-sm text-muted">Todavía no hay cuentas guardadas.</li>
          ) : null}
        </ul>
      )}

      {isOwner ? (
        <form onSubmit={onCreate} className="space-y-3 border-t border-border pt-4">
          <p className="font-display text-base font-semibold text-ink">Nueva cuenta</p>
          <div>
            <Label htmlFor="acc-name">Nombre</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              placeholder="María"
            />
          </div>
          <div>
            <Label htmlFor="acc-user">Usuario o correo</Label>
            <Input
              id="acc-user"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="off"
              placeholder="maria o maria@correo.com"
            />
          </div>
          <div>
            <Label htmlFor="acc-pass">Contraseña</Label>
            <Input
              id="acc-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creando…" : "Crear cuenta"}
          </Button>
        </form>
      ) : (
        <p className="border-t border-border pt-4 text-sm text-muted">
          Solo el dueño puede crear o borrar cuentas.
        </p>
      )}
    </Modal>
  );
}
