import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSection } from "@/components/LoadingSection";
import type { ExpenseItem } from "@/lib/api";

export type ExpenseStatus = "Normal" | "Warning" | "Critical";

export interface EnrichedExpense {
  category: string;
  amount: number;
  pct: number;
  status: ExpenseStatus;
}

export function enrichExpenses(expenses: ExpenseItem[], monthlyIncome: number): EnrichedExpense[] {
  return expenses.map((e) => {
    const pct = (e.amount / monthlyIncome) * 100;
    let status: ExpenseStatus = "Normal";
    if (pct > 30) status = "Critical";
    else if (pct >= 20) status = "Warning";
    return { category: e.category, amount: e.amount, pct, status };
  });
}

function getBadgeClass(status: ExpenseStatus) {
  switch (status) {
    case "Critical":
      return "border-transparent bg-destructive text-destructive-foreground";
    case "Warning":
      return "border-warning text-warning bg-warning/10";
    default:
      return "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  }
}

function getBadgeVariant(status: ExpenseStatus): "destructive" | "outline" | "secondary" {
  switch (status) {
    case "Critical": return "destructive";
    case "Warning": return "outline";
    default: return "secondary";
  }
}

interface ExpenseTableProps {
  expenses: EnrichedExpense[];
  isLoading: boolean;
}

export function ExpenseTable({ expenses, isLoading }: ExpenseTableProps) {
  if (isLoading) return <LoadingSection rows={6} />;

  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display font-semibold">Monthly Expenses — March 2026</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount (₹)</TableHead>
              <TableHead className="text-right">% of Income</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.category}>
                <TableCell className="font-medium">{e.category}</TableCell>
                <TableCell className="text-right">₹{e.amount.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">{e.pct.toFixed(1)}%</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={getBadgeVariant(e.status)}
                    className={getBadgeClass(e.status)}
                  >
                    {e.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
