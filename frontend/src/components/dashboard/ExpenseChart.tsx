import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LoadingSection, ErrorSection } from "@/components/LoadingSection";
import type { ExpenseItem } from "@/lib/api";

const formatRupee = (v: number) => `₹${(v / 1000).toFixed(1)}k`;

// CSS custom properties set in index.css — flip automatically with .dark
const GRID_COLOR  = "var(--chart-grid)";
const TICK_COLOR  = "var(--chart-tick)";
const BAR_COLOR   = "var(--chart-bar)";

interface ExpenseChartProps {
  data?: ExpenseItem[];
  isLoading: boolean;
  isError: boolean;
}

export function ExpenseChart({ data, isLoading, isError }: ExpenseChartProps) {
  if (isLoading) return <LoadingSection rows={5} />;
  if (isError || !data) return <ErrorSection />;

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">Expense Breakdown — Last Month</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: TICK_COLOR }} />
              <YAxis tickFormatter={formatRupee} tick={{ fontSize: 11, fill: TICK_COLOR }} />
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Amount"]}
                contentStyle={{ borderRadius: "8px", border: `1px solid ${GRID_COLOR}`, fontSize: 13 }}
              />
              <Bar dataKey="amount" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
