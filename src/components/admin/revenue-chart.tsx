"use client";

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toFa } from "@/lib/utils";

export type ChartPoint = { label: string; count: number };

export function AppointmentsChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b76e79" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#b76e79" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fontFamily: "inherit" }}
            tickLine={false}
            axisLine={false}
            reversed
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fontFamily: "inherit" }}
            tickLine={false}
            axisLine={false}
            width={32}
            orientation="right"
          />
          <Tooltip
            contentStyle={{
              borderRadius: "1rem",
              border: "1px solid rgba(74,37,69,0.12)",
              fontFamily: "inherit",
              fontSize: 12,
              direction: "rtl",
            }}
            labelFormatter={(l) => `روز ${l}`}
            formatter={(v) => [`${toFa(Number(v ?? 0))} نوبت`, ""]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#b76e79"
            strokeWidth={2.5}
            fill="url(#fillCount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
