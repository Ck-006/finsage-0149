import { Card, CardContent } from "@/components/ui/card";

interface SavingsRateProps {
  monthlyIncome: number;
  totalExpenses: number;
}

export function SavingsRate({ monthlyIncome, totalExpenses }: SavingsRateProps) {
  const savingsRate = ((monthlyIncome - totalExpenses) / monthlyIncome) * 100;
  const rounded = savingsRate.toFixed(1);

  let colorClass = "text-destructive";
  if (savingsRate >= 20) colorClass = "text-green-600 dark:text-green-400";
  else if (savingsRate >= 10) colorClass = "text-warning";

  return (
    <Card className="shadow-sm border">
      <CardContent className="p-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          You saved <span className={`font-bold text-lg ${colorClass}`}>{rounded}%</span> of your income this month
        </p>
        <p className="text-xs text-muted-foreground">
          ₹{(monthlyIncome - totalExpenses).toLocaleString("en-IN")} saved of ₹{monthlyIncome.toLocaleString("en-IN")}
        </p>
      </CardContent>
    </Card>
  );
}
