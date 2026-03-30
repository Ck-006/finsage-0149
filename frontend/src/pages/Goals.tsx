import { useState, useEffect, useMemo, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, CalendarIcon, Sparkles, RotateCcw } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useGoalsProfile, useGoalsAnalysis } from "@/hooks/use-goals-data";
import { useToast } from "@/hooks/use-toast";
import { FinSageErrorState } from "@/components/FinSageErrorState";
import type { GoalItem } from "@/lib/api";

type GoalStatus = "ON TRACK" | "MARGINAL" | "AT RISK";
type RiskPref = "Conservative" | "Moderate" | "Aggressive";

interface EnrichedGoal {
  id: number;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  monthlyContribution: number;
  deadline: Date;
  daysRemaining: number;
  monthsRemaining: number;
  monthlyNeeded: number;
  progressPct: number;
  status: GoalStatus;
  aiSuggestion: string;
}

const statusConfig: Record<GoalStatus, { dot: string; badgeClass: string }> = {
  "ON TRACK": { dot: "🟢", badgeClass: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" },
  MARGINAL: { dot: "🟡", badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800" },
  "AT RISK": { dot: "🔴", badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" },
};

const fmt = (n: number) => n.toLocaleString("en-IN");

const GOAL_EMOJIS = ["🏦", "✈️", "💰", "🎓", "🏠", "🚗", "💍", "📱"];

function computeStatus(monthlyContribution: number, monthlyNeeded: number): GoalStatus {
  if (monthlyContribution >= monthlyNeeded) return "ON TRACK";
  const deficit = (monthlyNeeded - monthlyContribution) / monthlyNeeded;
  if (deficit <= 0.15) return "MARGINAL";
  return "AT RISK";
}

function enrichGoals(
  goals: GoalItem[],
  suggestions: Record<string, string>,
  defaultSuggestion: string
): EnrichedGoal[] {
  const now = new Date();
  return goals.map((g, i) => {
    const deadline = g.target_date ? new Date(g.target_date) : new Date(now.getTime() + (g.daysRemaining ?? 90) * 86400000);
    const daysRemaining = Math.max(0, differenceInDays(deadline, now));
    const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
    const remaining = g.target - g.current;
    const monthlyNeeded = Math.round(remaining / monthsRemaining);
    const monthlyContribution = g.monthly_contribution ?? 0;
    const progressPct = Math.round((g.current / g.target) * 100);
    const status = computeStatus(monthlyContribution, monthlyNeeded);
    const aiSuggestion = suggestions[g.name] ?? defaultSuggestion;

    return {
      id: i + 1,
      name: g.name,
      emoji: g.emoji ?? GOAL_EMOJIS[i % GOAL_EMOJIS.length],
      target: g.target,
      saved: g.current,
      monthlyContribution,
      deadline,
      daysRemaining,
      monthsRemaining,
      monthlyNeeded,
      progressPct,
      status,
      aiSuggestion,
    };
  });
}

function parseAnalysis(raw: string): { suggestions: Record<string, string>; criticalInsight: string } {
  try {
    const parsed = JSON.parse(raw);
    const map: Record<string, string> = {};
    if (Array.isArray(parsed.suggestions)) {
      parsed.suggestions.forEach((s: { goalName: string; suggestion: string }) => {
        map[s.goalName] = s.suggestion;
      });
    }
    return { suggestions: map, criticalInsight: parsed.criticalInsight ?? "" };
  } catch {
    return { suggestions: {}, criticalInsight: raw.slice(0, 200) };
  }
}


export default function Goals() {
  const { data: profile, isLoading, isError } = useGoalsProfile();
  const { data: analysisRaw, isLoading: analysisLoading, isError: analysisError, refetch: refetchAnalysis } = useGoalsAnalysis(profile);
  const { toast } = useToast();

  const [localGoals, setLocalGoals] = useState<GoalItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [riskPref, setRiskPref] = useState<RiskPref>("Moderate");
  const [targetDate, setTargetDate] = useState<Date>();
  const [animated, setAnimated] = useState(false);

  // Form refs
  const nameRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<HTMLInputElement>(null);
  const contribRef = useRef<HTMLInputElement>(null);

  // Sync API data to local state
  useEffect(() => {
    if (profile?.goals) setLocalGoals(profile.goals);
  }, [profile]);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const { suggestions, criticalInsight } = useMemo(() => {
    if (!analysisRaw?.response) return { suggestions: {}, criticalInsight: "" };
    return parseAnalysis(analysisRaw.response);
  }, [analysisRaw]);

  const defaultSuggestion = analysisLoading
    ? ""
    : analysisError
    ? ""
    : "FinSage is analyzing your contribution pattern...";

  const goals = useMemo(() => enrichGoals(localGoals, suggestions, defaultSuggestion), [localGoals, suggestions, defaultSuggestion]);

  const now = new Date();
  const onTrack = goals.filter((g) => g.status === "ON TRACK").length;
  const atRisk = goals.filter((g) => g.status === "AT RISK").length;
  const totalNeeded = goals.reduce((s, g) => s + (g.target - g.saved), 0);

  // Timeline
  const allDates = goals.map((g) => g.deadline.getTime());
  const timelineStart = new Date(Math.min(now.getTime(), ...allDates) - 7 * 86400000);
  const timelineEnd = new Date(Math.max(...allDates) + 30 * 86400000);
  const totalDays = Math.max(1, differenceInDays(timelineEnd, timelineStart));
  const todayOffset = (differenceInDays(now, timelineStart) / totalDays) * 100;

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    const d = new Date(timelineStart);
    while (d <= timelineEnd) {
      labels.push(format(d, "MMM"));
      d.setMonth(d.getMonth() + 1);
    }
    return labels.slice(0, 12);
  }, [timelineStart, timelineEnd]);

  const handleSaveGoal = () => {
    const name = nameRef.current?.value || "New Goal";
    const target = Number(targetRef.current?.value) || 50000;
    const current = Number(savedRef.current?.value) || 0;
    const contribution = Number(contribRef.current?.value) || 0;

    const newGoal: GoalItem = {
      name,
      target,
      current,
      monthly_contribution: contribution,
      target_date: targetDate ? format(targetDate, "yyyy-MM-dd") : format(new Date(Date.now() + 180 * 86400000), "yyyy-MM-dd"),
    };

    setLocalGoals((prev) => [...prev, newGoal]);
    setModalOpen(false);
    setTargetDate(undefined);
    toast({ title: "Goal added! Start contributing to make it happen 💪" });
  };

  const handleApplySuggestion = () => {
    toast({ title: "Got it! FinSage will remind you next month 🎯" });
  };

  const handleShowAlternatives = async () => {
    await refetchAnalysis();
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <FinSageErrorState />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">🎯 Your Financial Goals</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your progress. Stay on course.</p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Add New Goal
          </Button>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Goals", value: goals.length },
            { label: "On Track", value: onTrack, badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
            { label: "At Risk", value: atRisk, badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
            { label: "Amount Needed", value: `₹${fmt(totalNeeded)}` },
          ].map((s) => (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                {s.badge ? (
                  <span className={cn("text-lg font-bold px-2 py-0.5 rounded-full text-sm", s.badge)}>{s.value}</span>
                ) : (
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Goal Cards */}
        <div className="space-y-4">
          {goals.map((goal) => {
            const sc = statusConfig[goal.status];
            const isContribSufficient = goal.monthlyContribution >= goal.monthlyNeeded;

            return (
              <Card key={goal.id} className="shadow-sm animate-fade-in">
                <CardContent className="p-5 space-y-4">
                  {/* Title & Status */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">
                      {goal.emoji} {goal.name}
                    </h3>
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", sc.badgeClass)}>
                      {sc.dot} {goal.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 transition-all duration-1000 ease-out"
                        style={{ width: animated ? `${goal.progressPct}%` : "0%" }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>₹{fmt(goal.saved)} saved of ₹{fmt(goal.target)}</span>
                      <span className="font-semibold text-foreground">{goal.progressPct}% complete</span>
                    </div>
                  </div>

                  {/* Info Pills */}
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full font-medium",
                        goal.daysRemaining > 60
                          ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : goal.daysRemaining > 30
                          ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      )}
                    >
                      📅 {goal.daysRemaining} days remaining
                    </span>
                    <span
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full font-medium",
                        isContribSufficient ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      )}
                    >
                      {isContribSufficient
                        ? "✅ Contribution sufficient"
                        : `💰 Need ₹${fmt(goal.monthlyNeeded)} more/month`}
                    </span>
                  </div>

                  {/* AI Suggestion */}
                  <div className="bg-accent/10 rounded-lg px-4 py-2.5">
                    <p className="text-xs text-foreground">
                      {analysisLoading ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                          <span className="font-medium">FinSage is thinking...</span>
                        </span>
                      ) : !analysisError && goal.aiSuggestion ? (
                        <>
                          <Sparkles className="inline h-3.5 w-3.5 mr-1 text-accent" />
                          <span className="font-medium">AI Suggestion:</span> {goal.aiSuggestion}
                        </>
                      ) : null}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Timeline View */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display font-semibold">Goal Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="relative h-24 mt-4">
              <div className="absolute top-8 left-0 right-0 h-1 bg-secondary rounded-full" />

              {/* Today marker */}
              <div
                className="absolute top-2 flex flex-col items-center"
                style={{ left: `${Math.min(Math.max(todayOffset, 2), 98)}%`, transform: "translateX(-50%)" }}
              >
                <span className="text-[10px] font-semibold text-accent">Today ({format(now, "d MMM")})</span>
                <div className="w-0.5 h-10 bg-accent" />
              </div>

              {/* Goal dots */}
              {goals.map((goal) => {
                const offset = (differenceInDays(goal.deadline, timelineStart) / totalDays) * 100;
                const dotColor =
                  goal.status === "ON TRACK"
                    ? "bg-green-500"
                    : goal.status === "MARGINAL"
                    ? "bg-yellow-500"
                    : "bg-red-500";
                return (
                  <div
                    key={goal.id}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${Math.min(Math.max(offset, 2), 98)}%`, top: "1.5rem", transform: "translateX(-50%)" }}
                  >
                    <div className={cn("w-3.5 h-3.5 rounded-full border-2 border-card", dotColor)} />
                    <span className="text-[10px] mt-1 text-muted-foreground whitespace-nowrap font-medium">
                      {goal.emoji} {goal.name}
                    </span>
                  </div>
                );
              })}

              {/* Month labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                {monthLabels.map((m, i) => (
                  <span key={`${m}-${i}`} className="text-[10px] text-muted-foreground">{m}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Insight Card */}
        <Card className="shadow-sm border-accent/30 border">
          <CardContent className="p-5">
            {analysisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground leading-relaxed">
                  🧠 <span className="font-semibold">FinSage Insight:</span>{" "}
                  {criticalInsight || "Analyzing your goals to find the best strategy..."}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={handleApplySuggestion}>
                    Apply This Suggestion ✅
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={handleShowAlternatives}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Show Alternatives
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Goal Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Goal</DialogTitle>
              <DialogDescription>Set a new financial target and track your progress.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Goal Name</Label>
                <Input ref={nameRef} placeholder="e.g. 🎓 Education Fund" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Target Amount (₹)</Label>
                  <Input ref={targetRef} type="number" placeholder="1,00,000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Current Savings (₹)</Label>
                  <Input ref={savedRef} type="number" placeholder="10,000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Contribution (₹)</Label>
                <Input ref={contribRef} type="number" placeholder="5,000" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !targetDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {targetDate ? format(targetDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={targetDate}
                      onSelect={setTargetDate}
                      disabled={(d) => d < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Risk Preference</Label>
                <div className="flex gap-2">
                  {(["Conservative", "Moderate", "Aggressive"] as RiskPref[]).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      size="sm"
                      variant={riskPref === r ? "default" : "outline"}
                      className={cn("flex-1 text-xs", riskPref === r && "bg-accent text-accent-foreground hover:bg-accent/90")}
                      onClick={() => setRiskPref(r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSaveGoal}>
                Save Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
