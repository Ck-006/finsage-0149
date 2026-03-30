import { IndianRupee, TrendingDown, CreditCard, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DemoData } from "@/lib/api";

function getCibilColor(score: number) {
  if (score < 650) return "text-danger";
  if (score < 750) return "text-warning";
  return "text-success";
}

interface StatCardsProps {
  data?: DemoData;
  isLoading: boolean;
}

export function StatCards({ data, isLoading }: StatCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="shadow-sm border">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: "Monthly Income",
      value: `₹${data.monthly_income.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      change: data.income_change,
      changePositive: true,
    },
    {
      label: "Total Expenses",
      value: `₹${data.total_expenses.toLocaleString("en-IN")}`,
      icon: TrendingDown,
      change: data.expense_change,
      changePositive: true,
    },
    {
      label: "Debt Outstanding",
      value: `₹${data.debt_outstanding.toLocaleString("en-IN")}`,
      icon: CreditCard,
      change: data.debt_change,
      changePositive: false,
    },
    {
      label: "CIBIL Score",
      value: String(data.cibil_score),
      icon: Shield,
      change: data.cibil_change,
      changePositive: true,
      cibil: data.cibil_score,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="card-hover shadow-sm border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
              <stat.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className={`text-2xl font-display font-bold tabular-nums transition-all duration-300 ${stat.cibil ? getCibilColor(stat.cibil) : "text-foreground"}`}>
              {stat.value}
            </p>
            <p className={`text-xs mt-1.5 ${stat.changePositive ? "text-success" : "text-muted-foreground"}`}>
              {stat.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
