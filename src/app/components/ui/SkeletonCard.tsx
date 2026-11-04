import { motion } from "motion/react";

/**
 * Skeletons de chargement réutilisables — remplace les spinners par
 * des placeholders animés qui imitent la structure du contenu final.
 */

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="h-4 bg-gray-200 rounded animate-pulse"
      style={{ width }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" />
          <SkeletonLine width="90%" />
          <SkeletonLine width="40%" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTransactionList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <SkeletonCard />
        </motion.div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-50">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "60%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}


export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-50">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <div
                    className="h-3 bg-gray-200 rounded animate-pulse"
                    style={{ width: c === cols - 1 ? "40%" : "70%" }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
