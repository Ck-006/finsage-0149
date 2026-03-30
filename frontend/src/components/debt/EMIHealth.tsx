import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { LoadingSection, ErrorSection } from "@/components/LoadingSection";

function getColor(r: number) {
  if (r < 30) return "hsl(142,71%,45%)";
  if (r <= 50) return "hsl(38,92%,50%)";
  return "hsl(0,84%,60%)";
}

function getLabel(r: number) {
  if (r < 30) return "Healthy";
  if (r <= 50) return "Moderate";
  return "High Risk";
}

interface EMIHealthProps {
  totalEmi?: number;
  monthlyIncome?: number;
  emiRatio?: number;
  isLoading: boolean;
  isError: boolean;
}

export function EMIHealth({ totalEmi, monthlyIncome, emiRatio, isLoading, isError }: EMIHealthProps) {
  if (isLoading) return <LoadingSection rows={4} />;
  if (isError || emiRatio == null || !totalEmi || !monthlyIncome) return <ErrorSection />;

  const ratio = emiRatio;
  const color = getColor(ratio);
  const gaugeData = [
    { name: "used", value: ratio },
    { name: "remaining", value: 100 - ratio },
  ];

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-display font-semibold">EMI Health</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="60%"
                startAngle={200}
                endAngle={-20}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="hsl(214,32%,91%)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center -mt-8">
          <p className="text-3xl font-display font-bold" style={{ color }}>{ratio.toFixed(1)}%</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">{getLabel(ratio)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            ₹{totalEmi.toLocaleString("en-IN")} EMI / ₹{monthlyIncome.toLocaleString("en-IN")} income
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
