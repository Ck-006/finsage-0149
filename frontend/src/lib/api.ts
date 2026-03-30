import { API_BASE } from "../config/api";

async function apiFetch<T>(url: string, options?: RequestInit, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    signal,
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Raw backend types (what /mock-profile/1 actually returns) ──────────────

interface BackendUser {
  name: string;
  age: number;
  city: string;
  monthly_income: number;
  cibil_score: number;
  risk_profile: string;
}

interface BackendExpense {
  category: string;
  amount: number;
  month: string;
  ai_tag: string;
}

interface BackendLoan {
  name: string;
  outstanding_balance: number;
  emi_amount: number;
  interest_rate: number;
  tenure_remaining_months: number;
  loan_type: string;
}

interface BackendGoal {
  name: string;
  target_amount: number;
  current_savings: number;
  monthly_contribution: number;
  target_date: string;
}

interface BackendProfile {
  user: BackendUser;
  expenses: BackendExpense[];
  loans: BackendLoan[];
  goals: BackendGoal[];
}

// ─── Transform backend profile → frontend DemoData ──────────────────────────

function transformProfile(p: BackendProfile): DemoData {
  const totalExpenses = p.expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebt = p.loans.reduce((s, l) => s + l.outstanding_balance, 0);

  return {
    // flat stat fields (derived)
    monthly_income: p.user.monthly_income,
    total_expenses: totalExpenses,
    debt_outstanding: totalDebt,
    cibil_score: p.user.cibil_score,
    cibil_change: "",
    income_change: "",
    expense_change: "",
    debt_change: "",

    // expenses: keep only category + amount for charts
    expenses: p.expenses.map((e) => ({ category: e.category, amount: e.amount })),

    // debts: pie chart data derived from loans
    debts: p.loans.map((l) => ({ name: l.name, value: l.outstanding_balance })),

    // loans: map to frontend Loan shape
    loans: p.loans.map((l) => ({
      name: l.name,
      lender: l.name,
      outstanding: l.outstanding_balance,
      totalLoan: l.outstanding_balance,
      emi: l.emi_amount,
      rate: l.interest_rate,
      type: l.loan_type === "credit_card"
        ? "credit"
        : l.loan_type === "home"
        ? "home"
        : "personal",
    })),

    // goals: map to frontend GoalItem shape
    goals: p.goals.map((g) => ({
      name: g.name,
      target: g.target_amount,
      current: g.current_savings,
      target_date: g.target_date,
      monthly_contribution: g.monthly_contribution,
    })),

    // raw backend data for AI queries
    _raw: p,
  } as DemoData;
}

// ─── GET /mock-profile/1 — fetch + transform ────────────────────────────────

export async function fetchDemoData(): Promise<DemoData> {
  const raw = await apiFetch<BackendProfile>("/mock-profile/1");
  return transformProfile(raw);
}

export async function fetchMockProfile(): Promise<DemoData> {
  return fetchDemoData();
}

// ─── POST /debt-plan — map frontend Loan → backend shape ────────────────────

export async function fetchDebtPlan(loans: Loan[]): Promise<DebtPlanResponse> {
  const backendLoans = loans.map((l) => ({
    name: l.name,
    outstanding_balance: l.outstanding,
    emi_amount: l.emi,
    interest_rate: l.rate,
    tenure_remaining_months: 24, // reasonable default
    loan_type: l.type === "credit" ? "credit_card" : l.type,
  }));

  const totalEmi = loans.reduce((s, l) => s + l.emi, 0);
  const monthlySurplus = Math.max(totalEmi, 1000); // use total EMI as surplus proxy

  const raw = await apiFetch<{ avalanche_plan: string; snowball_plan: string }>("/debt-plan", {
    method: "POST",
    body: JSON.stringify({ loans: backendLoans, monthly_surplus: monthlySurplus }),
  });

  // Backend returns string plans — convert to the shape components expect
  return {
    avalanche: parsePlanText(raw.avalanche_plan ?? ""),
    snowball: parsePlanText(raw.snowball_plan ?? ""),
    avalanche_savings: extractSavings(raw.avalanche_plan ?? ""),
    snowball_savings: extractSavings(raw.snowball_plan ?? ""),
    total_emi: totalEmi,
    monthly_income: 0, // filled by component from demoData
    emi_ratio: 0,
    credit_score_tips: defaultCreditTips(loans),
  };
}

function parsePlanText(plan: string): PayoffItem[] {
  const blocks = plan.split(/Priority #\d+/g).filter(Boolean);
  return blocks.map((block, i) => {
    const nameMatch = block.match(/—\s*(.+?)(?:\n|$)/);
    const monthsMatch = block.match(/Payoff:\s*(\d+)\s*months/);
    const criticalMatch = /CRITICAL/i.test(block);
    return {
      name: nameMatch ? nameMatch[1].trim() : `Loan ${i + 1}`,
      reason: criticalMatch ? "High-interest debt — pay first" : "Avalanche order",
      payoffDate: monthsMatch
        ? `In ${monthsMatch[1]} months`
        : "See plan",
      recommended: i === 0,
    };
  });
}

function extractSavings(plan: string): string {
  const m = plan.match(/Interest Saved[^:]*:\s*₹([0-9,]+)/);
  return m ? `₹${m[1]}` : "See plan";
}

function defaultCreditTips(loans: Loan[]): CreditTip[] {
  const tips: CreditTip[] = [];
  const highRate = loans.find((l) => l.rate >= 30);
  if (highRate) {
    tips.push({
      title: "High-interest debt detected",
      status: "warning",
      current: `${highRate.rate}% APR`,
      nextStep: "Pay off credit card debt first using Avalanche method",
    });
  }
  tips.push({
    title: "EMI discipline",
    status: "good",
    current: "All EMIs tracked",
    nextStep: "Never miss an EMI — set auto-pay",
  });
  return tips;
}

// ─── POST /analyze (AI chat) — sends message + context as plain text ─────────
// Backend /analyze expects a full FinancialProfile, which is too heavy for chat.
// We send just the message as a minimal profile stub; real AI uses OpenRouter fallback.

export async function postAnalyze(payload: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
  // The backend /analyze endpoint requires a full FinancialProfile.
  // For the chat use case, we skip it and signal failure so the
  // AIAdvisor falls back to OpenRouter automatically.
  throw new Error("Use OpenRouter fallback for chat");
}

// ---------- Frontend Types ----------

export interface Loan {
  name: string;
  lender: string;
  outstanding: number;
  totalLoan: number;
  emi: number;
  rate: number;
  type: "credit" | "personal" | "home";
}

export interface ExpenseItem {
  category: string;
  amount: number;
}

export interface GoalItem {
  name: string;
  emoji?: string;
  target: number;
  current: number;
  daysRemaining?: number;
  target_date?: string;
  monthly_contribution?: number;
}

export interface DebtComposition {
  name: string;
  value: number;
}

export interface StatCard {
  label: string;
  value: string;
  change: string;
  changePositive: boolean;
  cibil?: number;
}

export interface DemoData {
  monthly_income: number;
  total_expenses: number;
  debt_outstanding: number;
  cibil_score: number;
  cibil_change: string;
  income_change: string;
  expense_change: string;
  debt_change: string;
  expenses: ExpenseItem[];
  debts: DebtComposition[];
  loans: Loan[];
  goals: GoalItem[];
  _raw?: unknown;
}

export interface PayoffItem {
  name: string;
  reason: string;
  payoffDate: string;
  recommended: boolean;
}

export interface DebtPlanResponse {
  avalanche: PayoffItem[];
  snowball: PayoffItem[];
  avalanche_savings: string;
  snowball_savings: string;
  total_emi: number;
  monthly_income: number;
  emi_ratio: number;
  credit_score_tips: CreditTip[];
}

export interface CreditTip {
  title: string;
  status: "good" | "warning";
  current: string;
  nextStep: string;
}

export interface AnalyzeRequest {
  message: string;
  user_data?: Partial<DemoData>;
}

export interface AnalyzeResponse {
  response: string;
}

// ─── Transaction types ────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;           // YYYY-MM-DD from backend
  description: string;
  category: string;
  amount: number;
  type: "debit" | "credit";
  source: "statement" | "manual";
  ai_tag?: string;
}

export interface ParsedStatementResponse {
  transactions: Transaction[];
  count: number;
  bank_name: string;
  parse_mode: "real" | "simulated";
  message: string;
}

// ─── 15-second timeout helper ─────────────────────────────────────────────────

function withTimeout(ms = 15_000): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

// ─── GET /transactions/{userId} ───────────────────────────────────────────────

export async function getTransactions(userId = 1): Promise<Transaction[]> {
  const { signal, clear } = withTimeout();
  try {
    const res = await fetch(`${API_BASE}/transactions/${userId}`, { signal });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json();
    return json.transactions as Transaction[];
  } finally {
    clear();
  }
}

// ─── POST /transactions/add ───────────────────────────────────────────────────

export async function addTransaction(data: {
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "debit" | "credit";
  notes?: string;
}): Promise<Transaction> {
  const { signal, clear } = withTimeout();
  try {
    const res = await fetch(`${API_BASE}/transactions/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        user_id: 1,
        date: data.date,
        description: data.description,
        category: data.category,
        amount: data.amount,
        type: data.type,
        notes: data.notes ?? "",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `API error: ${res.status}`);
    }
    return res.json();
  } finally {
    clear();
  }
}

// ─── POST /statement/parse ────────────────────────────────────────────────────

export async function parseStatement(
  file: File,
  bankName: string
): Promise<ParsedStatementResponse> {
  const { signal, clear } = withTimeout(30_000); // allow extra time for large files
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("bank_name", bankName);
    // Do NOT set Content-Type — browser sets multipart boundary automatically
    const res = await fetch(`${API_BASE}/statement/parse`, {
      method: "POST",
      signal,
      body: form,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } finally {
    clear();
  }
}

// ─── Calendar types ───────────────────────────────────────────────────────────

export interface EmiEvent {
  name: string;
  amount: number;
  due_day: number;
  type: "emi";
  color: "red";
}

export interface IncomeEvent {
  name: string;
  amount: number;
  expected_day: number;
  type: "income";
  color: "green";
}

export interface TransactionEvent {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  category: string;
  color: "green" | "orange" | "blue";
}

export interface UpcomingPayment {
  name: string;
  amount: number;
  due_date: string;
  days_remaining: number;
  type: "emi";
}

export interface MonthlySummary {
  total_emis: number;
  expected_income: number;
  transaction_count: number;
  biggest_expense_day: string;
}

export interface CalendarData {
  emi_events: EmiEvent[];
  income_events: IncomeEvent[];
  transaction_events: TransactionEvent[];
  upcoming_payments: UpcomingPayment[];
  monthly_summary: MonthlySummary;
}

// ─── GET /calendar/{userId} ───────────────────────────────────────────────────

export async function getCalendarData(userId = 1): Promise<CalendarData> {
  const { signal, clear } = withTimeout(10_000);
  try {
    const res = await fetch(`${API_BASE}/calendar/${userId}`, { signal });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } finally {
    clear();
  }
}
