import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { walletApi } from "../../../utils/api";

export function usePendingTransactionsCount() {
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
        const res = await walletApi.getTransactions();
        const txs = res?.transactions || [];
        const pending = txs.filter((t: any) => t.status === "pending").length;
        if (!cancelled) setCount(pending);
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    refresh();

    const handler = () => refresh();
    window.addEventListener("focus", handler);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handler);
    };
  }, [userId]);

  return count;
}