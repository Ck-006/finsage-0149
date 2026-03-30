import { useQuery } from "@tanstack/react-query";
import { fetchDemoData, type DemoData } from "@/lib/api";

export function useDemoData() {
  return useQuery<DemoData>({
    queryKey: ["demo-data"],
    queryFn: fetchDemoData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
