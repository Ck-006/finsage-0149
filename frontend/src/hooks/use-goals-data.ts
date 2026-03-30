import { useQuery } from "@tanstack/react-query";
import { fetchMockProfile, type DemoData } from "@/lib/api";
import { API_BASE } from "@/config/api";

export function useGoalsProfile() {
  return useQuery<DemoData>({
    queryKey: ["mock-profile"],
    queryFn: fetchMockProfile,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

interface GoalsAnalysisResponse {
  response: string;
}

async function fetchGoalsInsights(profileData: DemoData): Promise<GoalsAnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/goals/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goals: profileData.goals,
      transactions_summary: {
        monthly_income: profileData.monthly_income,
        total_expenses: profileData.total_expenses,
      },
      user_id: "demo",
    }),
  });
  if (!res.ok) throw new Error(`Goals insights API error: ${res.status}`);
  return res.json();
}

export function useGoalsAnalysis(profileData?: DemoData) {
  return useQuery<GoalsAnalysisResponse>({
    queryKey: ["goals-analysis", profileData ? "loaded" : "pending"],
    queryFn: () => fetchGoalsInsights(profileData!),
    enabled: !!profileData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
