import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingSection, ErrorSection } from "@/components/LoadingSection";
import type { GoalItem } from "@/lib/api";

interface GoalsProgressProps {
  data?: GoalItem[];
  isLoading: boolean;
  isError: boolean;
}

export function GoalsProgress({ data, isLoading, isError }: GoalsProgressProps) {
  if (isLoading) return <LoadingSection rows={4} />;
  if (isError || !data) return <ErrorSection />;

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">Goals Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.map((goal) => {
          const pct = Math.round((goal.current / goal.target) * 100);
          return (
            <div key={goal.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-foreground">{goal.name}</span>
                <span className="text-xs text-muted-foreground">{goal.daysRemaining} days left</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={pct} className="h-2 flex-1" />
                <span className="text-xs font-semibold text-foreground w-10 text-right">{pct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ₹{goal.current.toLocaleString("en-IN")} of ₹{goal.target.toLocaleString("en-IN")}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
