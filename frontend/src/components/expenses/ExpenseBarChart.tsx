import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { LoadingSection } from "@/components/LoadingSection";
import type { EnrichedExpense } from "./ExpenseTable";

const STATUS_COLORS: Record<string, string> = {
  Normal: "hsl(142, 71%, 45%)",
  Warning: "hsl(38, 92%, 50%)",
  Critical: "hsl(0, 84%, 60%)",
};

// Uses CSS custom properties defined in index.css — auto-flip with .dark class
const GRID_COLOR = "var(--chart-grid)";
const TICK_COLOR = "var(--chart-tick)";

const formatRupee = (v: number) => `₹${(v / 1000).toFixed(1)}k`;

interface ExpenseBarChartProps {
  expenses: EnrichedExpense[];
  isLoading: boolean;
}

export function ExpenseBarChart({ expenses, isLoading }: ExpenseBarChartProps) {
  if (isLoading) return <LoadingSection rows={5} />;

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">Expense Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenses} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: TICK_COLOR }} />
              <YAxis tickFormatter={formatRupee} tick={{ fontSize: 11, fill: TICK_COLOR }} />
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Amount"]}
                contentStyle={{ borderRadius: "8px", border: `1px solid ${GRID_COLOR}`, fontSize: 13 }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {expenses.map((entry, index) => (
                  <Cell key={index} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
