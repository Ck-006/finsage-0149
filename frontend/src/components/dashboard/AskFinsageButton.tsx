import { Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AskFinsageButton() {
  const navigate = useNavigate();
  return (
    <button
      className="fixed bottom-6 right-6 h-14 px-5 rounded-full text-accent-foreground font-semibold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform z-50"
      style={{ background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))" }}
      onClick={() => navigate("/ai-advisor")}
    >
      <Bot className="h-5 w-5" />
      Ask FinSage
    </button>
  );
}
