import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { PiggyBank } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { API_BASE } from "@/config/api";

interface SavingItem {
  id: string;
  title: string;
  institution: string;
  category: string;
  amount: number;
  interestRate?: number;
  maturityDate?: string;
  notes?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Savings Account": "#3b82f6",
  "Fixed Deposit": "#8b5cf6",
  "Recurring Deposit": "#06b6d4",
  "Emergency Fund": "#22c55e",
  "Other": "#94a3b8",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Savings Account": "🏦",
  "Fixed Deposit": "🔒",
  "Recurring Deposit": "🔄",
  "Emergency Fund": "🛡️",
  "Other": "💰",
};

function inr(n: number) { return n.toLocaleString("en-IN"); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Add Savings Modal ────────────────────────────────────────────────────────
function AddSavingsModal({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: (s: SavingItem) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", institution: "", category: "Savings Account",
    amount: "", interestRate: "", maturityDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError("");
    if (!form.title.trim()) { setError("Title is required."); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError("Amount must be greater than 0."); return; }
    setSaving(true);
    try {
      const newItem: SavingItem = {
        id: Date.now().toString(),
        title: form.title,
        institution: form.institution,
        category: form.category,
        amount,
        interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
        maturityDate: form.maturityDate || undefined,
        notes: form.notes || undefined,
      };
      onAdded(newItem);
      toast({ description: "Savings added ✅" });
      setForm({ title: "", institution: "", category: "Savings Account", amount: "", interestRate: "", maturityDate: "", notes: "" });
      onClose();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const inputCls = "w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Add Savings 🏦</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>
        <div className="space-y-4">
          <div><label className={labelCls}>Title *</label>
            <input className={inputCls} placeholder="e.g. HDFC Savings Account" value={form.title} onChange={e => set("title", e.target.value)} /></div>
          <div><label className={labelCls}>Institution</label>
            <input className={inputCls} placeholder="e.g. HDFC Bank" value={form.institution} onChange={e => set("institution", e.target.value)} /></div>
          <div><label className={labelCls}>Category</label>
            <select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Amount (₹) *</label>
              <input type="number" min="0" className={inputCls} placeholder="0" value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
            <div><label className={labelCls}>Interest Rate (% p.a.)</label>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="6.5" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Maturity Date (optional — for FD/RD)</label>
            <input type="date" className={inputCls} value={form.maturityDate} onChange={e => set("maturityDate", e.target.value)} /></div>
          <div><label className={labelCls}>Notes (optional)</label>
            <textarea className={inputCls} rows={2} placeholder="Any notes…" value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border rounded-xl py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0d9488, #0891b2)" }}>
            {saving ? "Saving…" : "Add Savings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Growth data generator ────────────────────────────────────────────────────
function buildGrowthData(savings: SavingItem[]) {
  const total = savings.reduce((s, i) => s + i.amount, 0);
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  return months.map((m, i) => ({
    month: m,
    amount: Math.round(total * (0.65 + (i / months.length) * 0.35)),
  }));
}

// ─── Main Savings Page ────────────────────────────────────────────────────────
export default function SavingsPage() {
  const { toast } = useToast();
  const [savings, setSavings] = useState<SavingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Derive stats
  const totalSavings = useMemo(() => savings.reduce((s, i) => s + i.amount, 0), [savings]);
  const avgRate = useMemo(() => {
    const withRate = savings.filter(s => s.interestRate);
    if (!withRate.length) return 0;
    return withRate.reduce((s, i) => s + (i.interestRate ?? 0), 0) / withRate.length;
  }, [savings]);
  const nextMaturity = useMemo(() => {
    const withDate = savings.filter(s => s.maturityDate).sort((a, b) =>
      (a.maturityDate ?? "").localeCompare(b.maturityDate ?? ""));
    return withDate[0]?.maturityDate ?? null;
  }, [savings]);

  // Donut chart data
  const donutData = useMemo(() => {
    const map: Record<string, number> = {};
    savings.forEach(s => { map[s.category] = (map[s.category] ?? 0) + s.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [savings]);

  const growthData = useMemo(() => buildGrowthData(savings), [savings]);

  // Fetch AI insights
  const fetchInsights = async () => {
    if (!savings.length) return;
    setInsightsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/savings/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savings, user_id: "demo" }),
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(Array.isArray(data.insights) ? data.insights : []);
      }
    } catch { /* silently fail */ }
    finally { setInsightsLoading(false); }
  };

  useEffect(() => { fetchInsights(); }, [savings.length]);

  const handleAdded = (s: SavingItem) => setSavings(prev => [s, ...prev]);

  const statCards = [
    { label: "Total Savings", value: `₹${inr(totalSavings)}`, color: "#22c55e", big: true },
    { label: "This Month Added", value: totalSavings > 0 ? `₹${inr(Math.round(totalSavings * 0.08))}` : "₹0", color: "#3b82f6" },
    { label: "Avg. Interest Rate", value: avgRate > 0 ? `${avgRate.toFixed(1)}%` : "—", color: "#8b5cf6" },
    { label: "Next Maturity", value: nextMaturity ? new Date(nextMaturity).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—", color: "#06b6d4" },
  ];

  return (
    <AppLayout>
      <AddSavingsModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Savings Overview 🏦</h2>
            <p className="text-muted-foreground text-sm mt-1">Your wealth building snapshot</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl px-5 py-2 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #0d9488, #0891b2)" }}
          >
            + Add Savings
          </button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(c => (
            <Card key={c.label} className="shadow-sm border">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className="text-xl font-bold font-display" style={{ color: c.color }}>{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main content: 2-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* LEFT — charts */}
          <div className="xl:col-span-3 space-y-6">

            {/* Donut chart */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-semibold">Savings Composition</CardTitle>
              </CardHeader>
              <CardContent>
                {savings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <PiggyBank className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No savings yet — add your first one!</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                        paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {donutData.map((entry) => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`₹${inr(v)}`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {donutData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLORS[d.name] ?? "#94a3b8", display: "inline-block" }} />
                      {d.name} — ₹{inr(d.value)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Line chart */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-semibold">Savings Growth (12 months)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [`₹${inr(v)}`, "Savings"]} />
                    <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5}
                      dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — savings list + insights */}
          <div className="xl:col-span-2 space-y-6">

            {/* Savings list */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-semibold">Your Savings</CardTitle>
              </CardHeader>
              <CardContent>
                {savings.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-muted-foreground">No savings added yet.<br />Start building your wealth →</p>
                    <button onClick={() => setShowAdd(true)}
                      className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
                      style={{ background: "linear-gradient(135deg, #0d9488, #0891b2)" }}>
                      Add Your First Saving
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savings.map(s => (
                      <div key={s.id} className="p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{CATEGORY_ICONS[s.category] ?? "💰"}</span>
                              <p className="font-semibold text-sm truncate">{s.title}</p>
                            </div>
                            {s.institution && <p className="text-xs text-muted-foreground mt-0.5">{s.institution}</p>}
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: `${CATEGORY_COLORS[s.category]}22`, color: CATEGORY_COLORS[s.category] }}>
                              {s.category}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold font-display" style={{ color: "#22c55e" }}>₹{inr(s.amount)}</p>
                            {s.interestRate && <p className="text-xs text-muted-foreground">{s.interestRate}% p.a.</p>}
                            {s.maturityDate && <p className="text-xs text-muted-foreground">{new Date(s.maturityDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card className="shadow-sm border border-teal-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-semibold">💡 Savings Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {insightsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : insights.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add savings to get AI-powered insights.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.map((tip, i) => (
                      <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                        <span className="text-teal-400 shrink-0 mt-0.5">✦</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!insightsLoading && savings.length > 0 && (
                  <button onClick={fetchInsights} className="mt-3 text-xs text-teal-400 underline">
                    Refresh insights
                  </button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
