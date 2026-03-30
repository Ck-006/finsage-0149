import { AppLayout } from "@/components/AppLayout";
import { DebtCards } from "@/components/debt/DebtCards";
import { RepaymentStrategy } from "@/components/debt/RepaymentStrategy";
import { EMIHealth } from "@/components/debt/EMIHealth";
import { CreditScoreTips } from "@/components/debt/CreditScoreTips";
import { ErrorSection } from "@/components/LoadingSection";
import { useDebtPlan } from "@/hooks/use-debt-plan";
import { AddLoanModal, type LoanFormData } from "@/components/debt/AddLoanModal";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

const DebtPlanner = () => {
  const { data, loans, isLoading, isError } = useDebtPlan();
  const [showAddLoan, setShowAddLoan] = useState(false);
  const { toast } = useToast();

  const handleLoanAdded = (loan: LoanFormData) => {
    toast({
      description: `Loan "${loan.title}" saved — refresh to see it in your debt plan.`,
    });
  };

  return (
    <AppLayout>
      <AddLoanModal
        open={showAddLoan}
        onClose={() => setShowAddLoan(false)}
        onAdded={handleLoanAdded}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Debt Planner</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your loans and optimise your repayment strategy
            </p>
          </div>
          <button
            id="add-loan-btn"
            onClick={() => setShowAddLoan(true)}
            className="rounded-xl px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}
          >
            + Add Loan
          </button>
        </div>

        {isError && <ErrorSection />}

        <DebtCards loans={loans} isLoading={isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RepaymentStrategy
              avalanche={data?.avalanche}
              snowball={data?.snowball}
              avalancheSavings={data?.avalanche_savings}
              snowballSavings={data?.snowball_savings}
              isLoading={isLoading}
              isError={isError}
            />
          </div>
          <EMIHealth
            totalEmi={data?.total_emi}
            monthlyIncome={data?.monthly_income}
            emiRatio={data?.emi_ratio}
            isLoading={isLoading}
            isError={isError}
          />
        </div>

        <CreditScoreTips tips={data?.credit_score_tips} isLoading={isLoading} isError={isError} />
      </div>
    </AppLayout>
  );
};

export default DebtPlanner;
