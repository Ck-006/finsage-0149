import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RotateCcw, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: string;
  riskLevel?: "Low" | "Medium" | "High";
  confidence?: number;
  impactAmount?: number;
  impactMonths?: number;
  onShowAlternatives?: () => void;
}

const riskColors: Record<string, string> = {
  Low: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  Medium: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  High: "bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))] border-[hsl(var(--danger))]/30",
};

export function RecommendationModal({
  open,
  onOpenChange,
  suggestion,
  riskLevel = "Low",
  confidence = 82,
  impactAmount = 4500,
  impactMonths = 3,
  onShowAlternatives,
}: RecommendationModalProps) {
  const handleApply = () => {
    onOpenChange(false);
    toast({
      title: "Great choice! 🎯",
      description: "FinSage will remind you to track this next month.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        {/* Gradient header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-white/90" />
              <DialogTitle className="text-white font-display text-lg tracking-tight">
                FinSage Recommends
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-4 space-y-5">
          <p className="text-sm leading-relaxed text-foreground">{suggestion}</p>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <MetricPill label="Risk Level">
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold ${riskColors[riskLevel]}`}
              >
                {riskLevel}
              </Badge>
            </MetricPill>
            <MetricPill label="Confidence">
              <span className="text-sm font-bold font-display text-foreground">{confidence}%</span>
            </MetricPill>
            <MetricPill label="Est. Impact">
              <span className="text-sm font-bold font-display text-foreground">
                ₹{impactAmount.toLocaleString("en-IN")}
                <span className="text-[11px] font-normal text-muted-foreground">
                  {" "}/ {impactMonths}mo
                </span>
              </span>
            </MetricPill>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={handleApply}
              className="w-full text-white font-semibold"
              style={{ background: "linear-gradient(135deg, hsl(142,71%,40%), hsl(152,70%,38%))" }}
            >
              ✅ Apply this plan
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onShowAlternatives?.();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Show me alternatives
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto flex items-center gap-1 pt-1"
            >
              <X className="h-3 w-3" />
              Skip for now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 text-center space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      {children}
    </div>
  );
}
