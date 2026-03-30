import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE } from "@/config/api";

type HealthStatus = "checking" | "online" | "offline";

interface HealthContextValue {
  status: HealthStatus;
  recheck: () => void;
}

const HealthContext = createContext<HealthContextValue>({
  status: "checking",
  recheck: () => {},
});

export function useHealth() {
  return useContext(HealthContext);
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<HealthStatus>("checking");

  const check = useCallback(async () => {
    setStatus("checking");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      setStatus(res.ok ? "online" : "offline");
    } catch {
      clearTimeout(timeoutId);
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [check]);

  return (
    <HealthContext.Provider value={{ status, recheck: check }}>
      {children}
    </HealthContext.Provider>
  );
}
