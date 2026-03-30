import { AppLayout } from "@/components/AppLayout";
import { FinSageErrorState } from "@/components/FinSageErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  getCalendarData,
  addTransaction,
  type CalendarData,
  type UpcomingPayment,
  type TransactionEvent,
} from "@/lib/api";
import { X, ArrowLeft } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number) {
  return n.toLocaleString("en-IN");
}

function isoToDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function fmtShort(iso: string): string {
  if (!iso) return "";
  return isoToDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtFull(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/** Seeded pseudo-random to give stable heatmap values for days with no data */
function seededRand(d: Date): number {
  const seed = d.getDate() * (d.getMonth() + 1) * 7 + d.getFullYear();
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function heatmapClass(spend: number, seed: number): string {
  const effective = spend > 0 ? spend : seed < 0.4 ? 0 : Math.floor(seed * 6000);
  if (effective === 0) return "heatmap-empty";
  if (effective < 1000) return "heatmap-light";
  if (effective < 3000) return "heatmap-medium";
  if (effective < 5000) return "heatmap-dark";
  return "heatmap-darkest";
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Dot colour lookup ────────────────────────────────────────────────────────
const DOT_CLR: Record<string, string> = {
  red:    "hsl(0,84%,55%)",
  green:  "hsl(142,71%,40%)",
  blue:   "hsl(215,70%,55%)",
  orange: "hsl(30,90%,52%)",
  purple: "hsl(263,70%,58%)",
};

// ─── Upcoming-payment badge ───────────────────────────────────────────────────
function DaysBadge({ days }: { days: number }) {
  if (days > 7)
    return <Badge className="text-xs bg-green-100 text-green-700 border-transparent dark:bg-green-900/30 dark:text-green-400">{days} days</Badge>;
  if (days >= 2)
    return <Badge className="text-xs bg-amber-100 text-amber-700 border-transparent dark:bg-amber-900/30 dark:text-amber-400">{days} days</Badge>;
  if (days === 1)
    return <Badge className="text-xs bg-red-100 text-red-700 border-transparent dark:bg-red-900/30 dark:text-red-400">Tomorrow</Badge>;
  return (
    <Badge className="text-xs bg-red-500 text-white border-transparent animate-pulse">
      Today!
    </Badge>
  );
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1">
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
        <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
      ))}
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {Array.from({ length: 90 }).map((_, i) => (
        <div key={i} className="w-4 h-4 rounded-sm bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

function PaymentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-xl">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────
interface CalendarGridProps {
  year: number;
  month: number; // 0-based
  calData: CalendarData;
  todayDay: number;
  isCurrentMonth: boolean;
  onDayClick: (isoDate: string, events: TransactionEvent[]) => void;
}

function CalendarGrid({ year, month, calData, todayDay, isCurrentMonth, onDayClick }: CalendarGridProps) {
  const firstDay = new Date(year, month, 1).getDay(); // Sunday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Index transaction events by "YYYY-MM-DD"
  const txByDay = useMemo(() => {
    const map: Record<string, TransactionEvent[]> = {};
    calData.transaction_events.forEach(ev => {
      const d = isoToDate(ev.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = ev.date;
        (map[key] ??= []).push(ev);
      }
    });
    return map;
  }, [calData, year, month]);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="grid grid-cols-7 gap-1">
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
        <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
      ))}
      {cells.map((day, idx) => {
        if (!day) return <div key={idx} className="h-20 rounded-lg" />;

        const isoKey = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const isToday = isCurrentMonth && day === todayDay;

        // Collect dots
        const dots: { color: string; label: string }[] = [];

        calData.emi_events.forEach(ev => {
          if (ev.due_day === day) {
            dots.push({ color: DOT_CLR.red, label: `${ev.name} — ₹${inr(ev.amount)} due` });
          }
        });

        calData.income_events.forEach(ev => {
          if (ev.expected_day === day) {
            dots.push({ color: DOT_CLR.green, label: `${ev.name} — ₹${inr(ev.amount)} expected` });
          }
        });

        // Transaction dots only for the current data month
        const txEvts = txByDay[isoKey] ?? [];
        txEvts.forEach(ev => {
          const c = ev.color === "green" ? DOT_CLR.green : ev.color === "orange" ? DOT_CLR.orange : DOT_CLR.blue;
          const sign = ev.type === "credit" ? "+" : "-";
          dots.push({ color: c, label: `${ev.description} — ${sign}₹${inr(ev.amount)}` });
        });

        const visible = dots.slice(0, 3);
        const extra = dots.length - visible.length;

        return (
          <div
            key={idx}
            onClick={() => onDayClick(isoKey, txEvts)}
            className={`cal-day h-20 rounded-lg border text-xs p-1 flex flex-col overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
              isToday ? "cal-today" : "cal-normal-day"
            }`}
          >
            <span
              className={`font-semibold self-end leading-none mb-1 ${
                isToday ? "cal-day-num-today" : "cal-day-num text-foreground"
              }`}
            >
              {day}
            </span>
            <div className="flex flex-wrap gap-0.5 mt-auto">
              {visible.map((dot, di) => (
                <span
                  key={di}
                  title={dot.label}
                  className="w-2 h-2 rounded-full cursor-help flex-shrink-0"
                  style={{ background: dot.color }}
                />
              ))}
              {extra > 0 && (
                <span className="text-[9px] text-muted-foreground leading-tight">+{extra}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function SpendingHeatmap({ calData }: { calData: CalendarData }) {
  const today = new Date();
  const days = useMemo(() => {
    const result: { date: Date; iso: string; spend: number; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const matching = calData.transaction_events.filter(
        ev => ev.date === iso && ev.type === "debit"
      );
      result.push({
        date: d,
        iso,
        spend: matching.reduce((s, e) => s + e.amount, 0),
        count: matching.length,
      });
    }
    return result;
  }, [calData]);

  return (
    <div>
      <div className="flex gap-0.5 flex-wrap">
        {days.map(({ date, iso, spend, count }) => {
          const cls = heatmapClass(spend, seededRand(date));
          const label =
            spend > 0
              ? `${fmtShort(iso)} — ₹${inr(spend)} spent (${count} transaction${count !== 1 ? "s" : ""})`
              : `${fmtShort(iso)} — No spending recorded`;
          return (
            <div
              key={iso}
              title={label}
              className={`heatmap-cell w-4 h-4 rounded-sm cursor-help ${cls}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-muted-foreground">Less</span>
        {["heatmap-empty","heatmap-light","heatmap-medium","heatmap-dark","heatmap-darkest"].map(c => (
          <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-xs text-muted-foreground">More</span>
      </div>
    </div>
  );
}

// ─── Upcoming Payments ────────────────────────────────────────────────────────
function UpcomingPayments({ payments }: { payments: UpcomingPayment[] }) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [paidModal, setPaidModal] = useState<UpcomingPayment | null>(null);
  const [paidDate, setPaidDate] = useState("");
  const [paidNotes, setPaidNotes] = useState("");
  const [paying, setPaying] = useState(false);

  const openPaidModal = (p: UpcomingPayment) => {
    setPaidModal(p);
    setPaidDate(p.due_date);
    setPaidNotes("");
  };

  const handleConfirmPaid = async () => {
    if (!paidModal) return;
    setPaying(true);
    try {
      await addTransaction({
        date: paidDate || paidModal.due_date,
        description: paidModal.name,
        category: "Loan/EMI",
        amount: paidModal.amount,
        type: "debit",
        notes: paidNotes,
      });
      setDismissed(prev => new Set(prev).add(paidModal.name));
      toast({ description: `${paidModal.name} marked as paid ✅` });
      setPaidModal(null);
    } catch {
      toast({ description: "Failed to save payment. Try again.", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const visible = payments.filter(p => !dismissed.has(p.name));

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        🎉 All payments cleared!
      </p>
    );
  }

  const inputCls = "w-full border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <>
      {/* Mark as Paid confirmation modal */}
      {paidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-base">Mark as Paid ✅</h3>
              <button onClick={() => setPaidModal(null)}><X size={18} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-3 rounded-xl border" style={{ background: "rgba(239,68,68,0.06)" }}>
                <p className="text-sm font-semibold">{paidModal.name}</p>
                <p className="text-lg font-bold" style={{ color: "#ef4444" }}>₹{inr(paidModal.amount)}</p>
                <p className="text-xs text-muted-foreground">Category: Loan/EMI (auto-filled)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Date</label>
                <input type="date" className={inputCls} value={paidDate} onChange={e => setPaidDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional)</label>
                <input className={inputCls} placeholder="e.g. Paid via NEFT" value={paidNotes} onChange={e => setPaidNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPaidModal(null)} className="flex-1 border rounded-xl py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={handleConfirmPaid} disabled={paying}
                className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                {paying ? "Saving…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(p => (
          <div
            key={p.name}
            className="flex items-center justify-between gap-3 p-4 border rounded-xl hover:bg-muted/20 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Due {fmtFull(p.due_date)}</p>
              <p className="text-sm font-bold mt-1" style={{ color: "hsl(0,84%,55%)" }}>₹{inr(p.amount)}</p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <DaysBadge days={p.days_remaining} />
              <button
                onClick={() => openPaidModal(p)}
                className="text-xs border rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-400 transition-colors"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Monthly Summary Strip ────────────────────────────────────────────────────
function MonthlySummaryStrip({ calData, isLoading }: { calData: CalendarData | null; isLoading: boolean }) {
  const items = calData ? [
    {
      label: "Total EMIs Due",
      value: `₹${inr(calData.monthly_summary.total_emis)}`,
      color: "hsl(0,84%,55%)",
    },
    {
      label: "Expected Income",
      value: `₹${inr(calData.monthly_summary.expected_income)}`,
      color: "hsl(142,71%,40%)",
    },
    {
      label: "Transactions",
      value: String(calData.monthly_summary.transaction_count),
      color: "hsl(263,70%,55%)",
    },
    {
      label: "Biggest Spending Day",
      value: calData.monthly_summary.biggest_expense_day
        ? fmtShort(calData.monthly_summary.biggest_expense_day)
        : "—",
      color: "hsl(30,90%,52%)",
    },
  ] : [];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm border">
              <CardContent className="p-5">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))
        : items.map(item => (
            <Card key={item.label} className="shadow-sm border">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-xl font-bold font-display" style={{ color: item.color }}>
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))
      }
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const CalendarPage = () => {
  const [calData, setCalData] = useState<CalendarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Clickable day sidebar
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<TransactionEvent[]>([]);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const load = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await getCalendarData(1);
      setCalData(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDayClick = (isoDate: string, events: TransactionEvent[]) => {
    setSelectedDate(isoDate);
    setSelectedEvents(events);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  if (isError) {
    return (
      <AppLayout>
        <FinSageErrorState />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Calendar</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track EMI dates, income credits, and daily spending
          </p>
        </div>

        {/* Monthly summary strip */}
        <MonthlySummaryStrip calData={calData} isLoading={isLoading} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Calendar grid — takes up 2/3 on xl */}
          <div className="xl:col-span-2 space-y-4">
            <Card className="shadow-sm border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-display font-semibold">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </CardTitle>
                  <div className="flex gap-1">
                    <button
                      onClick={prevMonth}
                      className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-sm"
                      aria-label="Previous month"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }}
                      className="h-8 px-3 rounded-lg border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={nextMonth}
                      className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-sm"
                      aria-label="Next month"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { color: DOT_CLR.red,    label: "EMI due" },
                    { color: DOT_CLR.green,  label: "Income" },
                    { color: DOT_CLR.orange, label: "Large expense" },
                    { color: DOT_CLR.blue,   label: "Small expense" },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading || !calData
                  ? <GridSkeleton />
                  : (
                    <CalendarGrid
                      year={viewYear}
                      month={viewMonth}
                      calData={calData}
                      todayDay={today.getDate()}
                      isCurrentMonth={isCurrentMonth}
                      onDayClick={handleDayClick}
                    />
                  )
                }
              </CardContent>
            </Card>

            {/* Spending Heatmap */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-semibold">
                  90-Day Spending Heatmap
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Each square is one day — darker = more spent
                </p>
              </CardHeader>
              <CardContent>
                {isLoading || !calData
                  ? <HeatmapSkeleton />
                  : <SpendingHeatmap calData={calData} />
                }
              </CardContent>
            </Card>
          </div>

          {/* Right panel: day details or upcoming payments */}
          <div className="space-y-4">
            {selectedDate ? (
              <Card className="shadow-sm border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-display font-semibold">
                      {fmtFull(selectedDate)}
                    </CardTitle>
                    <button onClick={() => setSelectedDate(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ArrowLeft size={12} /> Back
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No transactions on this day.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvents.map((ev, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border">
                          <div>
                            <p className="text-sm font-semibold">{ev.description}</p>
                            <p className="text-xs text-muted-foreground">{ev.category}</p>
                          </div>
                          <p className="text-sm font-bold font-mono" style={{ color: ev.type === "credit" ? "#22c55e" : "#ef4444" }}>
                            {ev.type === "credit" ? "+" : "-"}₹{inr(ev.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display font-semibold">
                    Upcoming Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading || !calData
                    ? <PaymentSkeleton />
                    : <UpcomingPayments payments={calData.upcoming_payments} />
                  }
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CalendarPage;
