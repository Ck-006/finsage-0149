import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { LoadingSection, ErrorSection } from "@/components/LoadingSection";
import type { DebtComposition } from "@/lib/api";

// Accessible in both modes — purple family looks good on dark backgrounds
const COLORS = [
  "hsl(222, 47%, 50%)",
  "hsl(263, 70%, 60%)",
  "hsl(215, 16%, 55%)",
  "hsl(214, 32%, 70%)",
];

const GRID_COLOR = "var(--chart-grid)";

interface DebtChartProps {
  data?: DebtComposition[];
  isLoading: boolean;
  isError: boolean;
}

export function DebtChart({ data, isLoading, isError }: DebtChartProps) {
  if (isLoading) return <LoadingSection rows={5} />;
  if (isError || !data) return <ErrorSection />;

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">Debt Composition</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Outstanding"]}
                contentStyle={{ borderRadius: "8px", border: `1px solid ${GRID_COLOR}`, fontSize: 13 }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-muted-foreground ml-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
