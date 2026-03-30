import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Expenses from "./pages/Expenses.tsx";
import DebtPlanner from "./pages/DebtPlanner.tsx";
import AIAdvisor from "./pages/AIAdvisor.tsx";
import Goals from "./pages/Goals.tsx";
import CalendarPage from "./pages/CalendarPage.tsx";
import SavingsPage from "./pages/SavingsPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import FullScreenLoader from "./components/FullScreenLoader.tsx";
import { HealthProvider, useHealth } from "./context/HealthContext.tsx";
import { DeepAnalysisPanel } from "./components/DeepAnalysisPanel.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import { useAuth } from "./hooks/useAuth.ts";

const queryClient = new QueryClient();

function OfflineBanner() {
  const { status } = useHealth();
  if (status !== "offline") return null;
  return (
    <div
      id="backend-offline-banner"
      style={{
        height: "32px",
        width: "100%",
        background: "#fef3c7",
        color: "#92400e",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
        position: "relative",
        zIndex: 50,
        borderBottom: "1px solid #fde68a",
        flexShrink: 0,
      }}
    >
      ⚠️ Backend offline — FinSage AI running in lite mode
    </div>
  );
}

function AppRoutes() {
  useTheme();
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <OfflineBanner />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/transactions" element={<Expenses />} />
            <Route path="/debt-planner" element={<DebtPlanner />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/ai-advisor" element={<AIAdvisor />} />
            <Route path="/savings" element={<SavingsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        {/* Floating panel — outside Routes so it persists across navigation */}
        <DeepAnalysisPanel />
      </div>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HealthProvider>
        <AppRoutes />
      </HealthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
