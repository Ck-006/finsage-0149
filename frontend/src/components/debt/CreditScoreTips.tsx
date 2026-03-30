import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { LoadingSection } from "@/components/LoadingSection";
import type { CreditTip } from "@/lib/api";
import { API_BASE } from "@/config/api";
import { useEffect, useState } from "react";

interface CreditScoreTipsProps {
  tips?: CreditTip[];
  isLoading: boolean;
  isError: boolean;
}

// Default tips when backend AI is unavailable
const DEFAULT_TIPS: CreditTip[] = [
  { title: "Pay EMIs on time", status: "good", current: "Critical factor", nextStep: "Enable auto-pay for all loans" },
  { title: "Keep credit utilisation low", status: "warning", current: "Aim for <30%", nextStep: "Pay off credit card balances monthly" },
  { title: "Avoid multiple loan applications", status: "warning", current: "Each hard inquiry hurts score", nextStep: "Wait 6 months between credit applications" },
  { title: "Maintain old credit accounts", status: "good", current: "Credit age matters", nextStep: "Don't close old credit card accounts" },
  { title: "Diversify credit types", status: "good", current: "Mix of secured + unsecured", nextStep: "Having both home loan and credit card helps" },
];

export function CreditScoreTips({ tips: propTips, isLoading, isError }: CreditScoreTipsProps) {
  const [aiTips, setAiTips] = useState<CreditTip[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Try to fetch AI-generated tips from backend if no prop tips
  useEffect(() => {
    if (propTips && propTips.length > 0) return; // use prop tips if provided
    setAiLoading(true);
    fetch(`${API_BASE}/api/debt/credit-tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "demo", credit_score_estimate: 750 }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tips && Array.isArray(data.tips) && data.tips.length > 0) {
          setAiTips(data.tips);
        }
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [propTips]);

  if (isLoading || aiLoading) return <LoadingSection rows={3} />;

  const displayTips = propTips && propTips.length > 0
    ? propTips
    : aiTips.length > 0
    ? aiTips
    : DEFAULT_TIPS;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Credit Score Tips {aiTips.length > 0 && <span className="text-violet-400 normal-case">· AI-powered</span>}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayTips.map((tip) => (
          <Card key={tip.title} className="shadow-sm border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                {tip.status === "good" ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                )}
                <p className="text-sm font-semibold text-foreground">{tip.title}</p>
              </div>
              <p className="text-xs text-muted-foreground ml-7">{tip.current}</p>
              <p className="text-xs text-accent font-medium ml-7">{tip.nextStep}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
