import { useMemo, useState } from "react";
import { Search, Star, User, X, Plus } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { Beneficiary } from "../hooks/useBeneficiaries";

interface Props {
  beneficiaries: Beneficiary[];
  loading?: boolean;
  onSelect: (b: Beneficiary) => void;
  onDelete?: (id: string) => void;
  onAddNew?: () => void;
  disabled?: boolean;
}

export function BeneficiarySelector({
  beneficiaries, loading, onSelect, onDelete, onAddNew, disabled,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // sans filtre : les 5 derniers utilisés en premier, puis les autres
      return [...beneficiaries]
        .sort((a, b) => {
          const aT = new Date(a.lastUsedAt || a.createdAt).getTime();
          const bT = new Date(b.lastUsedAt || b.createdAt).getTime();
          return bT - aT;
        })
        .slice(0, 8);
    }
    return beneficiaries.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q)
    );
  }, [beneficiaries, query]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un bénéficiaire…"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        {onAddNew && (
          <Button type="button" variant="outline" size="sm" onClick={onAddNew} disabled={disabled}>
            <Plus className="w-4 h-4 mr-1" /> Nouveau
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {query ? "Aucun bénéficiaire trouvé." : "Aucun bénéficiaire encore. Ajoutez-en un ci-dessus."}
        </p>
      ) : (
        <ul className="border rounded-md divide-y max-h-72 overflow-auto">
          {filtered.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50">
              <button
                type="button"
                className="flex items-center gap-2 flex-1 text-left min-w-0"
                onClick={() => onSelect(b)}
                disabled={disabled}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.email}</p>
                </div>
                {b.lastUsedAt && (
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 ml-2" />
                )}
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(b.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Supprimer"
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}