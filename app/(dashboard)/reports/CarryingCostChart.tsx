"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface DataPoint {
  date: string;
  totalCost: number;
}

interface Props {
  data: DataPoint[];
}

function fmtCurrency(value: number) {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(0)}`;
}

export function CarryingCostChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(new Date(d.date), "MMM d"),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={fmtCurrency}
        />
        <Tooltip
          formatter={(value: number | undefined) => [fmtCurrency(value ?? 0), "Daily Carrying Cost"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
          }}
        />
        <Area
          type="monotone"
          dataKey="totalCost"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#costGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
