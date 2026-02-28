"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  locationCode: string;
  totalValue: number;
}

interface Props {
  data: DataPoint[];
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}k`;
  return `€${value.toFixed(0)}`;
}

export function InventoryValueChart({ data }: Props) {
  const hasData = data.some((d) => d.totalValue > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-300 text-sm">
        Run a cost snapshot to see inventory value by location
      </div>
    );
  }

  const top10 = data.slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={top10}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatCurrency}
        />
        <YAxis
          type="category"
          dataKey="locationCode"
          tick={{ fontSize: 10, fill: "#64748b", fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Inventory Value"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
          }}
        />
        <Bar dataKey="totalValue" fill="#3b82f6" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
