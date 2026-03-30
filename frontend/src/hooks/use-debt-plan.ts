import { useQuery } from "@tanstack/react-query";
import { fetchDebtPlan, type DebtPlanResponse, type Loan } from "@/lib/api";
import { useDemoData } from "@/hooks/use-demo-data";

export function useDebtPlan() {
  const { data: demoData, isLoading: demoLoading } = useDemoData();

  const query = useQuery<DebtPlanResponse>({
    queryKey: ["debt-plan", demoData?.loans],
    queryFn: () => fetchDebtPlan(demoData!.loans),
    enabled: !!demoData?.loans,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    ...query,
    isLoading: demoLoading || query.isLoading,
    loans: demoData?.loans,
  };
}
