"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Band {
  band: string;
  label: string;
  count: number;
  qty: number;
  colour: string;
}

interface Props {
  data: Band[];
}

export function InventoryHealthChart({ data }: Props) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-300 text-sm">
        No inventory data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) =>
            name === "count" ? [`${value ?? 0} lines`, "Lines"] : [`${value ?? 0} units`, "Qty"]
          }
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} name="count">
          {data.map((d) => (
            <Cell key={d.band} fill={d.colour} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
