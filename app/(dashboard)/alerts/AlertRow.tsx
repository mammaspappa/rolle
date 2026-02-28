"use client";

import { useTransition } from "react";
import { resolveAlert } from "@/server/actions/alerts";
import { CheckCircle } from "lucide-react";

interface Props {
  alert: {
    id: string;
    type: string;
    severity: string;
    message: string;
    createdAt: string;
    location: { name: string; code: string } | null;
    productVariant: { sku: string; productName: string } | null;
  };
  styles: { badge: string; row: string };
  typeLabel: string;
}

export function AlertRow({ alert, styles, typeLabel }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    startTransition(() => resolveAlert(alert.id));
  }

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 px-4 py-3 ${styles.row} ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded border ${styles.badge}`}>
          {typeLabel}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800">{alert.message}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            {alert.location && <span>📍 {alert.location.name}</span>}
            {alert.productVariant && (
              <span>📦 {alert.productVariant.productName} · {alert.productVariant.sku}</span>
            )}
            <span>
              {new Date(alert.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        <button
          onClick={handleResolve}
          disabled={isPending}
          className="shrink-0 p-1.5 rounded text-slate-300 hover:text-green-500 hover:bg-green-50 transition-colors"
          title="Resolve alert"
        >
          <CheckCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
