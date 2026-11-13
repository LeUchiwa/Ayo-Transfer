import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const PERIODS = [
  { label: "7 j", days: 7 },
  { label: "30 j", days: 30 },
  { label: "90 j", days: 90 },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n + 1);
  return d;
}

function formatDay(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function ActivityChart({ transactions }: { transactions: any[] }) {
  const [periodDays, setPeriodDays] = useState(7);

  const data = useMemo(() => {
    const start = daysAgo(periodDays);
    const buckets = new Map<string, { entrees: number; sorties: number }>();

    for (let i = 0; i < periodDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.set(formatDay(d), { entrees: 0, sorties: 0 });
    }

    for (const t of transactions || []) {
      if (t.status !== "completed") continue;
      const d = new Date(t.createdAt);
      if (d < start) continue;
      const b = buckets.get(formatDay(d));
      if (!b) continue;
      if (t.type === "deposit" || t.type === "transfer_received") {
        b.entrees += t.amount;
      } else if (t.type === "withdrawal" || t.type === "transfer_sent") {
        b.sorties += t.amount;
      }
    }

    return Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }));
  }, [transactions, periodDays]);

  const empty = data.every((d) => d.entrees === 0 && d.sorties === 0);

  return (
    <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg">Activité</CardTitle>
            <CardDescription>Volume d'opérations sur la période</CardDescription>
          </div>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p.days}
                variant={periodDays === p.days ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Aucune opération sur cette période
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()} FCFA`} />
              <Legend />
              <Line type="monotone" dataKey="entrees" name="Entrées" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="sorties" name="Sorties" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

const PIE_COLORS: Record<string, string> = {
  deposit: "#10b981",
  withdrawal: "#3b82f6",
  transfer_sent: "#ef4444",
  transfer_received: "#14b8a6",
};

const PIE_LABELS: Record<string, string> = {
  deposit: "Dépôts",
  withdrawal: "Retraits",
  transfer_sent: "Transferts envoyés",
  transfer_received: "Transferts reçus",
};

export function BreakdownChart({ transactions }: { transactions: any[] }) {
  const data = useMemo(() => {
    const totals: Record<string, number> = {
      deposit: 0, withdrawal: 0, transfer_sent: 0, transfer_received: 0,
    };
    for (const t of transactions || []) {
      if (t.status !== "completed") continue;
      if (totals[t.type] !== undefined) totals[t.type] += t.amount;
    }
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([type, value]) => ({
        name: PIE_LABELS[type] || type,
        value,
        color: PIE_COLORS[type] || "#94a3b8",
      }));
  }, [transactions]);

  return (
    <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Répartition</CardTitle>
        <CardDescription>Distribution par type d'opération</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Aucune opération complétée
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()} FCFA`} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
