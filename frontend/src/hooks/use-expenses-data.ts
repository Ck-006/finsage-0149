import { useQuery } from "@tanstack/react-query";
import { fetchMockProfile, postAnalyze, type DemoData, type AnalyzeResponse } from "@/lib/api";

export function useMockProfile() {
  return useQuery<DemoData>({
    queryKey: ["mock-profile"],
    queryFn: fetchMockProfile,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useExpenseInsights(profileData?: DemoData) {
  return useQuery<AnalyzeResponse>({
    queryKey: ["expense-insights", profileData ? "loaded" : "pending"],
    queryFn: () =>
      postAnalyze({
        message: "Analyze my spending patterns and give me the top 3 spending insights with emoji, finding, rupee impact, and actionable advice.",
        user_data: profileData,
      }),
    enabled: !!profileData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
