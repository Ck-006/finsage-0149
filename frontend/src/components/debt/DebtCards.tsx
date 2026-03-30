import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loan } from "@/lib/api";

const typeStyles = {
  credit: "border-l-4 border-l-danger",
  personal: "border-l-4 border-l-warning",
  home: "border-l-4 border-l-success",
};

const typeLabels = {
  credit: "Credit Card",
  personal: "Personal / Auto Loan",
  home: "Home Loan",
};

interface DebtCardsProps {
  loans?: Loan[];
  isLoading: boolean;
}

export function DebtCards({ loans, isLoading }: DebtCardsProps) {
  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Debts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm border">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!loans) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Debts</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loans.map((d) => {
          const paidPct = Math.round(((d.totalLoan - d.outstanding) / d.totalLoan) * 100);
          return (
            <Card key={d.name} className={`shadow-sm border ${typeStyles[d.type]}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.lender} · {typeLabels[d.type]}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{d.rate}% p.a.</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Outstanding</p>
                    <p className="font-display font-bold text-foreground">₹{d.outstanding.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">EMI</p>
                    <p className="font-display font-bold text-foreground">₹{d.emi.toLocaleString("en-IN")}/mo</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{paidPct}% paid off</span>
                    <span>₹{d.totalLoan.toLocaleString("en-IN")} total</span>
                  </div>
                  <Progress value={paidPct} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
