import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { EnrichedExpense } from "./ExpenseTable";

const RECOMMENDED_LIMITS: Record<string, number> = {
  Normal: 20,
  Warning: 20,
  Critical: 20,
};

interface SmartAlertsProps {
  expenses: EnrichedExpense[];
}

export function SmartAlerts({ expenses }: SmartAlertsProps) {
  const alerts = expenses.filter((e) => e.status === "Warning" || e.status === "Critical");

  if (alerts.length === 0) {
    return (
      <Card className="shadow-sm border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display font-semibold">Smart Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">All spending categories are within limits. 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">Smart Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((a) => {
          const isCritical = a.status === "Critical";
          return (
            <div
              key={a.category}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                isCritical
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-warning/30 bg-warning/5"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 shrink-0 mt-0.5 ${
                  isCritical ? "text-destructive" : "text-warning"
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {a.category} is at {a.pct.toFixed(1)}% of your income
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recommended limit is {RECOMMENDED_LIMITS[a.status]}%
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
