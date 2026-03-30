import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSection } from "@/components/LoadingSection";
import { RefreshCw } from "lucide-react";

interface InsightItem {
  emoji: string;
  finding: string;
  impact: string;
  action: string;
}

interface AIInsightsProps {
  insights: InsightItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

function parseInsights(raw: string): InsightItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 3);
  } catch {
    // Try to extract insights from text
  }

  // Fallback: split by newlines and create basic items
  const lines = raw.split("\n").filter((l) => l.trim());
  return lines.slice(0, 3).map((line) => ({
    emoji: "📊",
    finding: line.replace(/^[-•*]\s*/, "").slice(0, 80),
    impact: "",
    action: "",
  }));
}

export function AIInsights({ insights, isLoading, isError, onRetry }: AIInsightsProps) {
  if (isLoading) return <LoadingSection rows={3} />;

  if (isError) {
    return (
      <Card className="shadow-sm border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display font-semibold">AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            AI insights unavailable right now
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">AI Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-2xl leading-none mt-0.5">{item.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.finding}</p>
              {item.impact && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.impact}</p>
              )}
              {item.action && (
                <p className="text-xs text-accent mt-1 font-medium">{item.action}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { parseInsights };
export type { InsightItem };
