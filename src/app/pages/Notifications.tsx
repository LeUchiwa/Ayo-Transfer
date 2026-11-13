import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Bell, CheckCheck, AlertCircle, ArrowUpRight, ArrowDownLeft,
  Inbox, ShieldCheck, ShieldX, Clock, RefreshCw, Send, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { walletApi } from "../../../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotificationsCount";
import { useOneSignal } from "../hooks/useOneSignal";
import { BellOff } from "lucide-react";
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
const POLL_INTERVAL_MS = 30_000; // 30 secondes

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
      return { Icon: Bell, color: "text-gray-600 dark:text-gray-400" };
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || "";

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { ready: pushReady, permission: pushPermission, requestPermission } = useOneSignal();

  // ═══ C — Chargement initial + polling 30s ═══
  const loadNotifications = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    setError(null);
    try {
      const res = await walletApi.getNotifications();
      const list = res.notifications || [];

      // Détecte les nouvelles notifs (pour toast)
      if (silent && notifications.length > 0) {
        const oldIds = new Set(notifications.map((n) => n.id));
        const newOnes = list.filter((n: ApiNotification) => !oldIds.has(n.id));
        if (newOnes.length > 0) {
          toast.info(
            `${newOnes.length} nouvelle${newOnes.length > 1 ? "s" : ""} notification${newOnes.length > 1 ? "s" : ""}`,
            { description: newOnes[0].title }
          );
          notifyNotificationsChanged();
        }
      }

      setNotifications(list);
      setReadIds(getReadIds(userId));
      setLastUpdated(new Date());
    } catch (e: any) {
      if (!silent) setError(e?.message || "Impossible de charger les notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, notifications]);

  // Chargement initial
  useEffect(() => {
    if (!userId) return;
    loadNotifications(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Polling 30s — pausé quand l'onglet est caché
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      // Ne poll pas si l'onglet n'est pas actif
      if (document.visibilityState === "visible") {
        loadNotifications(true);
      }
    }, POLL_INTERVAL_MS);

    // Recharge immédiatement quand on revient sur l'onglet
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && lastUpdated) {
        const age = Date.now() - lastUpdated.getTime();
        if (age > 60_000) loadNotifications(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId, loadNotifications, lastUpdated]);

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
    toast.success("Toutes les notifications sont lues");
  };

  const NotificationItem = ({ n }: { n: ApiNotification }) => {
    const { Icon, color } = iconFor(n);
    const isUnread = !readIds.has(n.id);
    return (
      <div
        className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
          isUnread
            ? "bg-orange-50 border-orange-200 hover:bg-orange-100 hover:shadow-md"
            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-gray-300 hover:shadow-md"
        }`}
        onClick={() => markAsRead(n.id)}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full bg-gray-100 dark:bg-slate-800 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{n.title}</h4>
              {isUnread && <Badge className="bg-orange-500 shrink-0">Nouveau</Badge>}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{n.message}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(n.createdAt)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérez vos notifications et messages</p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Mis à jour {timeAgo(lastUpdated.toISOString())}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pushReady && !pushPermission && (
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                const ok = await requestPermission();
                if (ok) toast.success("Notifications push activées !");
                else toast.error("Permission refusée");
              }}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Bell className="w-4 h-4" />
              Activer les notifications
            </Button>
          )}
          {pushReady && pushPermission && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <Bell className="w-3 h-3 mr-1" />
              Push activées
            </Badge>
          )}
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            <Bell className="w-3 h-3 mr-1" />
            {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNotifications(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border-orange-100">
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
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Toutes les notifications</h3>
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadNotifications(false)}
                    className="ml-auto"
                  >
                    Réessayer
                  </Button>
                </div>
              )}

              {/* ═══ D — État vide soigné ═══ */}
              {!loading && !error && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mb-4">
                    <Inbox className="w-10 h-10 text-orange-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Aucune notification
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                    Vos dépôts, retraits, transferts et vérifications d'identité apparaîtront ici.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate("/transfer")}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Faire un transfert
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/wallet")}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Déposer
                    </Button>
                  </div>
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