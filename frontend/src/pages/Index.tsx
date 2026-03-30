import { AppLayout } from "@/components/AppLayout";
import { StatCards } from "@/components/dashboard/StatCards";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { DebtChart } from "@/components/dashboard/DebtChart";
import { GoalsProgress } from "@/components/dashboard/GoalsProgress";
import { AskFinsageButton } from "@/components/dashboard/AskFinsageButton";
import { ErrorSection } from "@/components/LoadingSection";
import { useDemoData } from "@/hooks/use-demo-data";

const Index = () => {
  const { data, isLoading, isError } = useDemoData();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">Your financial overview at a glance</p>
        </div>

        {isError && <ErrorSection />}

        <StatCards data={data} isLoading={isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpenseChart data={data?.expenses} isLoading={isLoading} isError={isError} />
          <DebtChart data={data?.debts} isLoading={isLoading} isError={isError} />
        </div>

        <GoalsProgress data={data?.goals} isLoading={isLoading} isError={isError} />
      </div>

      <AskFinsageButton />
    </AppLayout>
  );
};

export default Index;
