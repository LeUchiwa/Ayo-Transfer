import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { walletApi } from "../../../utils/api";

const STORAGE_KEY = (userId: string) => `ayo_notif_read_${userId}`;
const UPDATE_EVENT = "ayo:notif-updated";

function getReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const res = await walletApi.getNotifications();
        const notifs = res?.notifications || [];
        const readIds = getReadIds(userId);
        const unread = notifs.filter((n: any) => !readIds.has(n.id)).length;
        if (!cancelled) setCount(unread);
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    refresh();

    const handler = () => refresh();
    window.addEventListener(UPDATE_EVENT, handler);
    window.addEventListener("focus", handler);

    return () => {
      cancelled = true;
      window.removeEventListener(UPDATE_EVENT, handler);
      window.removeEventListener("focus", handler);
    };
  }, [userId]);

  return count;
}

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(UPDATE_EVENT));
}