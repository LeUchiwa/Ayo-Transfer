import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Bell, CheckCheck, AlertCircle, ArrowUpRight, ArrowDownLeft,
  Loader2, Inbox, ShieldCheck, ShieldX, Clock,
} from "lucide-react";
import { walletApi } from "../../../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotificationsCount";
import { SkeletonTransactionList } from "../components/ui/SkeletonCard";

type ApiNotification = {
  id: string;
  type: "deposit" | "withdrawal" | "transfer_sent" | "transfer_received" | "kyc";
  status: "pending" | "completed" | "failed" | "approved" | "rejected";
  title: string;
  message: string;
  amount: number | null;
  reference: string | null;
  createdAt: string;
};

const STORAGE_KEY = (userId: string) => `ayo_notif_read_${userId}`;

function getReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string, ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY(userId), JSON.stringify([...ids]));
}

function iconFor(n: ApiNotification) {
  switch (n.type) {
    case "deposit":
      return { Icon: ArrowDownLeft, color: "text-green-600" };
    case "withdrawal":
      return { Icon: ArrowUpRight, color: "text-orange-600" };
    case "transfer_sent":
      return { Icon: ArrowUpRight, color: "text-blue-600" };
    case "transfer_received":
      return { Icon: ArrowDownLeft, color: "text-green-600" };
    case "kyc":
      if (n.status === "approved") return { Icon: ShieldCheck, color: "text-green-600" };
      if (n.status === "rejected") return { Icon: ShieldX, color: "text-red-600" };
      return { Icon: Clock, color: "text-orange-600" };
    default:
      return { Icon: Bell, color: "text-gray-600" };
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "À l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 30) return `Il y a ${d} jours`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function Notifications() {
  const { user } = useAuth();
  const userId = user?.id || "";

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charge les notifications depuis l'API
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await walletApi.getNotifications();
        if (!cancelled) {
          setNotifications(res.notifications || []);
          setReadIds(getReadIds(userId));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Impossible de charger les notifications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAsRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(userId, next);
    notifyNotificationsChanged(); 
  };

  const markAllAsRead = () => {
    const next = new Set(readIds);
    notifications.forEach((n) => next.add(n.id));
    setReadIds(next);
    saveReadIds(userId, next);
    notifyNotificationsChanged();
  };

  const NotificationItem = ({ n }: { n: ApiNotification }) => {
    const { Icon, color } = iconFor(n);
    const isUnread = !readIds.has(n.id);
    return (
      <div
        className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
          isUnread
            ? "bg-orange-50 border-orange-200 hover:bg-orange-100 hover:shadow-md"
            : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
        }`}
        onClick={() => markAsRead(n.id)}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full bg-gray-100 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">{n.title}</h4>
              {isUnread && <Badge className="bg-orange-500 shrink-0">Nouveau</Badge>}
            </div>
            <p className="text-sm text-gray-600 mb-1">{n.message}</p>
            <p className="text-xs text-gray-500">{timeAgo(n.createdAt)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Notifications</h2>
          <p className="text-gray-600 mt-1">Gérez vos notifications et messages</p>
        </div>
        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
          <Bell className="w-3 h-3 mr-1" />
          {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
        </Badge>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
        <CardContent className="pt-6">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="all" className="gap-2">
                <Bell className="w-4 h-4" />
                Notifications
                {unreadCount > 0 && (
                  <Badge className="ml-1 bg-orange-500">{unreadCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Toutes les notifications</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    <CheckCheck className="w-4 h-4 mr-1" />
                    Tout marquer comme lu
                  </Button>
                )}
              </div>

              {loading && <SkeletonTransactionList count={5} />}

              {error && !loading && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              {!loading && !error && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Inbox className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">Aucune notification pour le moment.</p>
                  <p className="text-xs mt-1">Vos dépôts, retraits et transferts apparaîtront ici.</p>
                </div>
              )}

              {!loading && !error && notifications.length > 0 && (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}