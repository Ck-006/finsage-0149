import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayoffItem } from "@/lib/api";

interface RepaymentStrategyProps {
  avalanche?: PayoffItem[];
  snowball?: PayoffItem[];
  avalancheSavings?: string;
  snowballSavings?: string;
  isLoading: boolean;
  isError: boolean;
}

const STRATEGY_CONFIG = {
  avalanche: {
    emoji: "🏔️",
    name: "Avalanche",
    tagline: "Pay highest interest first",
    description:
      "Attack the highest-interest debt first regardless of balance. Mathematically optimal — you pay less total interest over the life of your loans.",
    badge: "Recommended ★",
    accentColor: "#7c3aed",
    bg: "rgba(124,58,237,0.06)",
    border: "rgba(124,58,237,0.25)",
    pros: ["Saves the most money in interest", "Shortest mathematical payoff time", "Best for high-rate credit cards"],
    cons: ["Slow visible progress on large loans", "Requires patience"],
  },
  snowball: {
    emoji: "❄️",
    name: "Snowball",
    tagline: "Clear smallest balance first",
    description:
      "Pay off the smallest balance first, regardless of interest rate. Each cleared loan gives a psychological win that keeps you motivated.",
    badge: "Motivational",
    accentColor: "#0891b2",
    bg: "rgba(8,145,178,0.06)",
    border: "rgba(8,145,178,0.25)",
    pros: ["Quick wins keep you motivated", "Reduces number of loans faster", "Great for building momentum"],
    cons: ["May pay more total interest", "Takes longer mathematically"],
  },
};

function StrategyCard({
  type,
  items,
  savings,
  isLoading,
  isSelected,
  onSelect,
}: {
  type: "avalanche" | "snowball";
  items?: PayoffItem[];
  savings?: string;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cfg = STRATEGY_CONFIG[type];

  return (
    <Card
      className="shadow-sm cursor-pointer transition-all duration-300"
      style={{
        border: isSelected ? `2px solid ${cfg.accentColor}` : "1px solid hsl(var(--border))",
        background: isSelected ? cfg.bg : undefined,
        transform: isSelected ? "translateY(-2px)" : undefined,
        boxShadow: isSelected ? `0 8px 24px ${cfg.accentColor}22` : undefined,
      }}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl mb-1">{cfg.emoji}</p>
            <CardTitle className="text-base font-display font-bold">{cfg.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.tagline}</p>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: `${cfg.accentColor}22`, color: cfg.accentColor }}
          >
            {cfg.badge}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ) : (
          <>
            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>

            {/* Payoff order */}
            {items && items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Payoff Order
                </p>
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ background: "hsl(var(--muted))" }}
                    >
                      <span
                        className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                        style={{ background: cfg.accentColor, color: "#fff" }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.payoffDate}</p>
                      </div>
                      {item.recommended && (
                        <span className="text-[10px] font-semibold" style={{ color: cfg.accentColor }}>
                          ★
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Savings */}
            {savings && (
              <div
                className="flex items-center gap-2 p-2.5 rounded-lg"
                style={{ background: `${cfg.accentColor}11`, border: `1px solid ${cfg.accentColor}33` }}
              >
                <span>💰</span>
                <div>
                  <p className="text-[10px] text-muted-foreground">Interest Saved</p>
                  <p className="text-sm font-bold" style={{ color: cfg.accentColor }}>{savings}</p>
                </div>
              </div>
            )}

            {/* Pros / Cons */}
            {isSelected && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="text-[10px] font-semibold text-green-400 mb-1 uppercase">Pros</p>
                  {cfg.pros.map((p) => (
                    <p key={p} className="text-[10px] text-muted-foreground leading-relaxed">✓ {p}</p>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-red-400 mb-1 uppercase">Cons</p>
                  {cfg.cons.map((c) => (
                    <p key={c} className="text-[10px] text-muted-foreground leading-relaxed">✗ {c}</p>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="w-full py-2 rounded-lg text-xs font-bold transition-all duration-200"
              style={{
                background: isSelected ? cfg.accentColor : "transparent",
                color: isSelected ? "#fff" : cfg.accentColor,
                border: `1.5px solid ${cfg.accentColor}`,
              }}
            >
              {isSelected ? "✓ Selected Strategy" : "Choose This Strategy"}
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RepaymentStrategy({
  avalanche, snowball, avalancheSavings, snowballSavings, isLoading, isError,
}: RepaymentStrategyProps) {
  const [selected, setSelected] = useState<"avalanche" | "snowball">("avalanche");

  if (isError) {
    return (
      <Card className="shadow-sm border">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Could not load repayment strategies. Please retry.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-bold text-base text-foreground">Repayment Strategy</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Click a strategy to see full details and pros/cons</p>
      </div>

      {/* Comparison table */}
      {!isLoading && avalancheSavings && snowballSavings && (
        <div className="grid grid-cols-2 gap-3">
          {(["avalanche", "snowball"] as const).map(t => {
            const s = t === "avalanche" ? avalancheSavings : snowballSavings;
            const cfg = STRATEGY_CONFIG[t];
            return (
              <div key={t} className="p-3 rounded-xl border text-center"
                style={{ background: selected === t ? cfg.bg : undefined, borderColor: selected === t ? cfg.accentColor : undefined }}>
                <p className="text-xs text-muted-foreground">{cfg.emoji} {cfg.name}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: cfg.accentColor }}>{s}</p>
                <p className="text-[10px] text-muted-foreground">interest savings</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StrategyCard
          type="avalanche"
          items={avalanche}
          savings={avalancheSavings}
          isLoading={isLoading}
          isSelected={selected === "avalanche"}
          onSelect={() => setSelected("avalanche")}
        />
        <StrategyCard
          type="snowball"
          items={snowball}
          savings={snowballSavings}
          isLoading={isLoading}
          isSelected={selected === "snowball"}
          onSelect={() => setSelected("snowball")}
        />
      </div>
    </div>
  );
}
