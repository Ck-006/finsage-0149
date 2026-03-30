import { AppLayout } from "@/components/AppLayout";
import { FinSageErrorState } from "@/components/FinSageErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  getTransactions, addTransaction, parseStatement,
  type Transaction, type ParsedStatementResponse,
} from "@/lib/api";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Lock } from "lucide-react";

// ─── Type & Category system ───────────────────────────────────────────────────
type TxnType = "expense" | "income" | "savings" | "investment";

const TYPE_CATEGORIES: Record<TxnType, string[]> = {
  expense: [
    "Food & Dining", "Transport", "Shopping", "Entertainment",
    "Utilities", "Rent/Housing", "Healthcare", "Education",
    "Personal Care", "Subscriptions", "Other Expense",
  ],
  income: [
    "Salary", "Freelancing", "Business Income", "Rental Income",
    "Interest/Dividends", "Bonus", "Gift Received", "Refund", "Other Income",
  ],
  savings: [
    "Savings Account 1", "Savings Account 2", "Fixed Deposit",
    "Recurring Deposit", "Emergency Fund", "Other Savings",
  ],
  investment: [],
};

const TYPE_CONFIG = {
  expense:    { label: "Expense",    emoji: "🔴", color: "#ef4444", border: "#ef4444", apiType: "debit"  as const },
  income:     { label: "Income",     emoji: "🟢", color: "#22c55e", border: "#22c55e", apiType: "credit" as const },
  savings:    { label: "Savings",    emoji: "🔵", color: "#3b82f6", border: "#3b82f6", apiType: "credit" as const },
  investment: { label: "Investment", emoji: "🔒", color: "#6b7280", border: "#374151", apiType: "debit"  as const },
};

const CATEGORY_EMOJIS: Record<string, string> = {
  "Food & Dining": "🍕", "Transport": "🚗", "Shopping": "🛒", "Entertainment": "🎬",
  "Utilities": "💡", "Rent/Housing": "🏠", "Healthcare": "💊", "Education": "📚",
  "Personal Care": "✂️", "Subscriptions": "📺", "Other Expense": "📦",
  "Salary": "💰", "Freelancing": "💻", "Business Income": "🏢", "Rental Income": "🏘️",
  "Interest/Dividends": "📈", "Bonus": "🎁", "Gift Received": "🎀", "Refund": "↩️", "Other Income": "💵",
  "Savings Account 1": "🏦", "Savings Account 2": "🏧", "Fixed Deposit": "🔒",
  "Recurring Deposit": "🔄", "Emergency Fund": "🛡️", "Other Savings": "💾",
};

function inr(n: number) { return n.toLocaleString("en-IN"); }
function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Custom Category Dropdown ─────────────────────────────────────────────────
function CategoryDropdown({ categories, value, onChange }: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      const idx = categories.indexOf(value);
      if (idx < categories.length - 1) onChange(categories[idx + 1]);
    }
    if (e.key === "ArrowUp") {
      const idx = categories.indexOf(value);
      if (idx > 0) onChange(categories[idx - 1]);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }} onKeyDown={handleKey}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-background text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span>{CATEGORY_EMOJIS[value] ?? "📦"} {value || "Select category"}</span>
        <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>▼</span>
      </button>

      {open && (
        <div
          className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-y-auto"
          style={{ top: "calc(100% + 4px)", maxHeight: 200 }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { onChange(cat); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
              style={{
                background: cat === value ? "rgba(139,92,246,0.2)" : undefined,
                color: cat === value ? "#c4b5fd" : "#e2e8f0",
              }}
            >
              <span>{CATEGORY_EMOJIS[cat] ?? "📦"}</span>
              <span>{cat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function TableSkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i} style={{ height: "60px" }}>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /><Skeleton className="h-1 w-full mt-2" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────
function SummaryStrip({ transactions, isLoading }: { transactions: Transaction[]; isLoading: boolean }) {
  const totalIncome  = useMemo(() => transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0), [transactions]);
  const netFlow = totalIncome - totalExpense;

  const cards = [
    { label: "Total Income",   value: `+₹${inr(totalIncome)}`,  color: "#22c55e" },
    { label: "Total Expenses", value: `-₹${inr(totalExpense)}`, color: "#ef4444" },
    { label: "Net Flow",       value: `${netFlow >= 0 ? "+" : ""}₹${inr(Math.abs(netFlow))}`, color: netFlow >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Transactions",   value: String(transactions.length), color: "hsl(263,70%,55%)" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="shadow-sm border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{c.label}</p>
            {isLoading ? <Skeleton className="h-7 w-24" />
              : <p className="text-xl font-bold font-display" style={{ color: c.color }}>{c.value}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────
function AddTransactionModal({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: (txn: Transaction) => void;
}) {
  const { toast } = useToast();
  const [txnType, setTxnType] = useState<TxnType>("expense");
  const [form, setForm] = useState({
    date: todayISO(), description: "", category: TYPE_CATEGORIES.expense[0],
    amount: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showInvestTooltip, setShowInvestTooltip] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // When type changes, reset category to first of new type
  const handleTypeChange = (t: TxnType) => {
    if (t === "investment") return; // locked
    setTxnType(t);
    setForm(f => ({ ...f, category: TYPE_CATEGORIES[t][0] ?? "" }));
  };

  const handleSave = async () => {
    setError("");
    if (!form.description.trim()) { setError("Description is required."); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError("Amount must be greater than 0."); return; }
    setSaving(true);
    try {
      const apiType = TYPE_CONFIG[txnType].apiType;
      const txn = await addTransaction({ ...form, amount, type: apiType });
      onAdded(txn);
      toast({ description: "Transaction added ✅" });
      setForm({ date: todayISO(), description: "", category: TYPE_CATEGORIES.expense[0], amount: "", notes: "" });
      setTxnType("expense");
      onClose();
    } catch {
      setError("Could not save transaction. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const cfg = TYPE_CONFIG[txnType];
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";
  const inputBase = "w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Add Transaction</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>

        {/* Type selector */}
        <div className="mb-4">
          <label className={labelCls}>Transaction Type</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["expense", "income", "savings", "investment"] as TxnType[]).map((t) => {
              const tc = TYPE_CONFIG[t];
              const isLocked = t === "investment";
              return (
                <div key={t} style={{ position: "relative", flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => isLocked ? setShowInvestTooltip(v => !v) : handleTypeChange(t)}
                    style={{
                      width: "100%",
                      padding: "8px 4px",
                      borderRadius: 10,
                      border: `1.5px solid ${txnType === t && !isLocked ? tc.color : "transparent"}`,
                      background: txnType === t && !isLocked ? `${tc.color}22` : "hsl(var(--muted))",
                      color: isLocked ? "#4b5563" : (txnType === t ? tc.color : "hsl(var(--muted-foreground))"),
                      cursor: isLocked ? "not-allowed" : "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{tc.emoji}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {tc.label}
                      {isLocked && <Lock size={10} />}
                    </span>
                  </button>
                  {isLocked && showInvestTooltip && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
                      transform: "translateX(-50%)", background: "#1e293b",
                      border: "1px solid #334155", borderRadius: 8, padding: "8px 10px",
                      width: 180, fontSize: 11, color: "#94a3b8", zIndex: 100, textAlign: "center",
                    }}>
                      Investment tracking coming soon 🚀<br />
                      <span style={{ color: "#6b7280", fontSize: 10 }}>We're building something powerful.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputBase} value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <input className={inputBase} placeholder="e.g. Zomato order" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* Dynamic Category Dropdown */}
          <div>
            <label className={labelCls}>Category</label>
            <CategoryDropdown
              categories={TYPE_CATEGORIES[txnType]}
              value={form.category}
              onChange={(v) => set("category", v)}
            />
          </div>

          {/* Amount with colored accent */}
          <div>
            <label className={labelCls}>Amount *</label>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <span style={{
                display: "flex", alignItems: "center",
                padding: "0 12px",
                background: `${cfg.color}22`,
                border: `1.5px solid ${cfg.color}55`,
                borderRight: "none",
                borderRadius: "8px 0 0 8px",
                color: cfg.color,
                fontWeight: 700, fontSize: 14,
              }}>₹</span>
              <input
                type="number" min="0" step="0.01"
                className="flex-1 border rounded-r-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ borderLeft: "none", borderColor: `${cfg.color}55` }}
                placeholder="0.00"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes (optional)</label>
            <input className={inputBase} placeholder="Any extra details…" value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg py-2 text-sm font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }}
          >
            {saving ? "Saving…" : "Save Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Statement Modal (unchanged) ───────────────────────────────────────
interface UploadModalProps { open: boolean; onClose: () => void; onImported: (txns: Transaction[]) => void; }

function UploadStatementModal({ open, onClose, onImported }: UploadModalProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [bankName, setBankName] = useState("My Bank");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedStatementResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");

  const reset = () => { setStep(1); setFile(null); setParsed(null); setSelected(new Set()); setParseError(""); setImportProgress(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleProcess = async () => {
    if (!file) return;
    setParseError(""); setParsing(true);
    try {
      const result = await parseStatement(file, bankName);
      setParsed(result); setSelected(new Set(result.transactions.map(t => t.id))); setStep(2);
    } catch { setParseError("Could not parse statement. Try CSV format."); }
    finally { setParsing(false); }
  };

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleImport = async () => {
    if (!parsed) return;
    const toImport = parsed.transactions.filter(t => selected.has(t.id));
    setImporting(true);
    const done: Transaction[] = [];
    for (let i = 0; i < toImport.length; i++) {
      setImportProgress(`Importing ${i + 1}/${toImport.length}…`);
      try {
        const created = await addTransaction({ date: toImport[i].date, description: toImport[i].description, category: toImport[i].category, amount: toImport[i].amount, type: toImport[i].type });
        done.push(created);
      } catch { /* skip */ }
    }
    setImporting(false); onImported(done);
    toast({ description: `${done.length} transaction${done.length !== 1 ? "s" : ""} imported ✅` });
    handleClose();
  };

  if (!open) return null;
  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">{step === 1 ? "📂 Upload Bank Statement" : "✅ Review & Import"}</h3>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>
        {step === 1 && (
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Bank Name</label>
              <input className={inputCls} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" /></div>
            <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-accent transition-colors" onClick={() => fileRef.current?.click()}>
              <div className="text-3xl mb-2">📄</div>
              <p className="text-sm font-medium">{file ? file.name : "Click to select CSV or PDF"}</p>
              <p className="text-xs text-muted-foreground mt-1">CSV recommended · PDF shows demo data</p>
              <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {parseError && <p className="text-xs text-destructive">{parseError}</p>}
            <button onClick={handleProcess} disabled={!file || parsing} className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}>
              {parsing ? "Processing…" : "Process Statement →"}
            </button>
          </div>
        )}
        {step === 2 && parsed && (
          <div className="space-y-4">
            {parsed.parse_mode === "simulated" && (
              <div className="text-xs rounded-lg px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-400">
                ⚠️ PDF parsing is simulated — showing sample transactions
              </div>
            )}
            <p className="text-xs text-muted-foreground">{parsed.count} transactions found from {parsed.bank_name}.</p>
            <div className="flex gap-2 text-xs">
              <button className="text-accent underline" onClick={() => setSelected(new Set(parsed.transactions.map(t => t.id)))}>Select all</button>
              <span className="text-muted-foreground">·</span>
              <button className="text-muted-foreground underline" onClick={() => setSelected(new Set())}>Deselect all</button>
            </div>
            <div className="overflow-auto max-h-72 rounded-xl border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead><TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead>Type</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {parsed.transactions.map(t => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => toggleSelect(t.id)}>
                      <TableCell><input type="checkbox" readOnly checked={selected.has(t.id)} className="cursor-pointer" /></TableCell>
                      <TableCell className="text-xs">{fmtDate(t.date)}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{t.description}</TableCell>
                      <TableCell className="text-right text-xs font-mono">₹{inr(t.amount)}</TableCell>
                      <TableCell><Badge variant={t.type === "credit" ? "secondary" : "outline"} className="text-xs">{t.type}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {importProgress && <p className="text-xs text-muted-foreground text-center">{importProgress}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border rounded-lg py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">← Back</button>
              <button onClick={handleImport} disabled={selected.size === 0 || importing}
                className="flex-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}>
                {importing ? importProgress : `Import ${selected.size} Selected →`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Percentage bar ───────────────────────────────────────────────────────────
function PercentBar({ amount, total, color }: { amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (amount / total) * 100) : 0;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ width: "100%", background: "hsl(var(--muted))", borderRadius: 9999, height: 3 }}>
        <div style={{ height: 3, borderRadius: 9999, width: `${pct}%`, background: color, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Main Transactions Page ───────────────────────────────────────────────────
const Expenses = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true); setIsError(false);
    try { setTransactions(await getTransactions(1)); }
    catch { setIsError(true); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdded = useCallback((txn: Transaction) => setTransactions(prev => [txn, ...prev]), []);
  const handleImported = useCallback((txns: Transaction[]) => setTransactions(prev => [...txns, ...prev]), []);

  // Totals by type for percentage bars
  const totalDebits = useMemo(() => transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalCredits = useMemo(() => transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0), [transactions]);

  if (isError) return <AppLayout><FinSageErrorState /></AppLayout>;

  return (
    <AppLayout>
      <AddTransactionModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      <UploadStatementModal open={showUpload} onClose={() => setShowUpload(false)} onImported={handleImported} />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Transactions</h2>
            <p className="text-muted-foreground text-sm mt-1">All your income, expenses, and savings in one place</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowUpload(true)} className="border rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              📂 Upload Statement
            </button>
            <button onClick={() => setShowAdd(true)} className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity"
              style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}>
              + Add Transaction
            </button>
          </div>
        </div>

        <SummaryStrip transactions={transactions} isLoading={isLoading} />

        {/* Transactions table */}
        <Card className="shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display font-semibold">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableSkeletonRows count={3} />
                  : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        No transactions yet. Add one or upload a statement.
                      </TableCell>
                    </TableRow>
                  ) : transactions.map(t => {
                    const isCredit = t.type === "credit";
                    const barColor = isCredit ? "#22c55e" : "#ef4444";
                    const barTotal = isCredit ? totalCredits : totalDebits;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                        <TableCell className="font-medium text-sm">
                          <div>{t.description}</div>
                          <PercentBar amount={t.amount} total={barTotal} color={barColor} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {CATEGORY_EMOJIS[t.category] ?? "📦"} {t.category}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm"
                          style={{ color: isCredit ? "#22c55e" : "#ef4444" }}>
                          {isCredit ? "+" : "-"}₹{inr(t.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isCredit ? "secondary" : "outline"}
                            className={isCredit
                              ? "bg-green-100 text-green-700 border-transparent text-xs dark:bg-green-900/30 dark:text-green-400"
                              : "border-orange-300 text-orange-700 text-xs"}>
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs text-muted-foreground">{t.source}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Expenses;
