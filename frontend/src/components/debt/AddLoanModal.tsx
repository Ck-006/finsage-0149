import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface AddLoanModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: (loan: LoanFormData) => void;
}

export interface LoanFormData {
  id: string;
  title: string;
  lender: string;
  loanType: string;
  principalAmount: number;
  remainingBalance: number;
  interestRate: number;
  emiAmount: number;
  emiDate: number;
  startDate: string;
  endDate: string;
  notes: string;
}

const LOAN_TYPES = [
  "Personal Loan", "Home Loan", "Car Loan",
  "Credit Card", "Education Loan", "Other",
];

export function AddLoanModal({ open, onClose, onAdded }: AddLoanModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "", lender: "", loanType: "Personal Loan",
    principalAmount: "", remainingBalance: "", interestRate: "",
    emiAmount: "", emiDate: "5", startDate: "", endDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError("");
    if (!form.title.trim()) { setError("Loan title is required."); return; }
    if (!form.principalAmount || parseFloat(form.principalAmount) <= 0) {
      setError("Principal amount must be greater than 0."); return;
    }
    setSaving(true);
    try {
      const loan: LoanFormData = {
        id: Date.now().toString(),
        title: form.title,
        lender: form.lender,
        loanType: form.loanType,
        principalAmount: parseFloat(form.principalAmount),
        remainingBalance: parseFloat(form.remainingBalance) || parseFloat(form.principalAmount),
        interestRate: parseFloat(form.interestRate) || 0,
        emiAmount: parseFloat(form.emiAmount) || 0,
        emiDate: parseInt(form.emiDate) || 5,
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes,
      };
      onAdded(loan);
      toast({ description: `Loan "${loan.title}" added ✅` });
      setForm({
        title: "", lender: "", loanType: "Personal Loan",
        principalAmount: "", remainingBalance: "", interestRate: "",
        emiAmount: "", emiDate: "5", startDate: "", endDate: "", notes: "",
      });
      onClose();
    } catch {
      setError("Could not save loan. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputCls = "w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" style={{ maxHeight: "92vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Add Loan 💳</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Loan Title *</label>
              <input className={inputCls} placeholder="e.g. HDFC Personal Loan" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Lender Name</label>
              <input className={inputCls} placeholder="e.g. HDFC Bank" value={form.lender} onChange={e => set("lender", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Loan Type</label>
              <select className={inputCls} value={form.loanType} onChange={e => set("loanType", e.target.value)}>
                {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Principal Amount (₹) *</label>
              <input type="number" min="0" className={inputCls} placeholder="5,00,000" value={form.principalAmount} onChange={e => set("principalAmount", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Outstanding Balance (₹)</label>
              <input type="number" min="0" className={inputCls} placeholder="3,50,000" value={form.remainingBalance} onChange={e => set("remainingBalance", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Interest Rate (% p.a.)</label>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="12.5" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>EMI Amount (₹)</label>
              <input type="number" min="0" className={inputCls} placeholder="8,500" value={form.emiAmount} onChange={e => set("emiAmount", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>EMI Day (1–31)</label>
              <input type="number" min="1" max="31" className={inputCls} placeholder="5" value={form.emiDate} onChange={e => set("emiDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Loan Start Date</label>
              <input type="date" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Loan End Date</label>
            <input type="date" className={inputCls} value={form.endDate} onChange={e => set("endDate", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea className={inputCls} rows={2} placeholder="Any additional notes…" value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border rounded-xl py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}>
            {saving ? "Saving…" : "Save Loan"}
          </button>
        </div>
      </div>
    </div>
  );
}
