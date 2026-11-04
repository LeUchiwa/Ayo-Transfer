import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Loader2, Plus as PlusIcon, Pencil, Trash2, X } from "lucide-react";
import { newsApi, type NewsArticle, type NewsInput } from "../../../utils/api";

export function AdminNewsTab() {
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsInput>({
    title: "", description: "", source: "", category: "finance", region: "cameroun", tag: "", content: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await newsApi.list();
      setItems(res.news || []);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: "", description: "", source: "", category: "finance", region: "cameroun", tag: "", content: "" });
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (n: NewsArticle) => {
    setForm({
      title: n.title, description: n.description, source: n.source,
      category: n.category, region: n.region,
      tag: n.tag || "", content: n.content || "",
    });
    setEditingId(n.id); setShowForm(true);
  };

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      if (editingId) await newsApi.update(editingId, form);
      else await newsApi.create(form);
      await load(); resetForm();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette actualité ?")) return;
    try { await newsApi.remove(id); await load(); }
    catch (e: any) { setError(e?.message || "Erreur lors de la suppression"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Actualités</h3>
        <Button onClick={() => showForm ? resetForm() : setShowForm(true)} className="gap-2">
          {showForm ? <><X className="w-4 h-4" />Annuler</> : <><PlusIcon className="w-4 h-4" />Nouvelle actualité</>}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <input className="w-full rounded border p-2" placeholder="Titre *" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="w-full rounded border p-2 min-h-20" placeholder="Description *" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="rounded border p-2" placeholder="Source * (ex : Investir au Cameroun)" value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })} />
              <input className="rounded border p-2" placeholder="Tag (ex : Économie)" value={form.tag || ""}
                onChange={(e) => setForm({ ...form, tag: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="rounded border p-2" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as any })}>
                <option value="finance">Finance</option>
                <option value="general">Général</option>
              </select>
              <select className="rounded border p-2" value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value as any })}>
                <option value="cameroun">Cameroun</option>
                <option value="monde">Monde</option>
              </select>
            </div>
            <textarea className="w-full rounded border p-2 min-h-24" placeholder="Contenu long (optionnel)"
              value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <Button onClick={submit} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Mettre à jour" : "Publier")}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && <div className="text-center py-6 text-gray-500">Chargement…</div>}

      {!loading && items.length === 0 && !showForm && (
        <Card><CardContent className="py-10 text-center text-gray-500">
          Aucune actualité publiée. Cliquez sur « Nouvelle actualité » pour commencer.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id}><CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{n.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                {n.source} · {n.category} · {n.region} · {new Date(n.publishedAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => startEdit(n)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(n.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
