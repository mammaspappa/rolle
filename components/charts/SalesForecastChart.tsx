"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface DataPoint {
  week: string;
  actual: number;
  forecast: number;
}

interface Props {
  data: DataPoint[];
}

export function SalesForecastChart({ data }: Props) {
  const hasData = data.some((d) => d.actual > 0 || d.forecast > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-300 text-sm">
        Import sales data to see the trend
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    weekLabel: format(new Date(d.week), "MMM d"),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <XAxis
          dataKey="weekLabel"
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
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => (value === "actual" ? "Actual Sales" : "Forecasted")}
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
