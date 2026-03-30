import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, Bot, User, ArrowRight } from "lucide-react";
import { API_BASE } from "@/config/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  navigation?: { label: string; route: string } | null;
}

interface ChatResponse {
  reply: string;
  navigation?: { label: string; route: string } | null;
}

function NavCard({ nav, onNavigate }: {
  nav: { label: string; route: string };
  onNavigate: (route: string) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(nav.route)}
      className="flex items-center gap-2 mt-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
      style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)", boxShadow: "0 4px 14px rgba(139,92,246,0.35)" }}
    >
      <ArrowRight size={14} />
      {nav.label}
    </button>
  );
}

function MessageBubble({ msg, onNavigate }: {
  msg: Message;
  onNavigate: (route: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: isUser ? "linear-gradient(135deg, #7c3aed, #9333ea)" : "hsl(var(--muted))",
        }}
      >
        {isUser ? <User size={14} style={{ color: "#fff" }} /> : <Bot size={14} className="text-violet-400" />}
      </div>

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style={{
            background: isUser ? "linear-gradient(135deg, #7c3aed, #9333ea)" : "hsl(var(--muted))",
            color: isUser ? "#fff" : "hsl(var(--foreground))",
            borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.content}
        </div>
        {msg.navigation && !isUser && (
          <NavCard nav={msg.navigation} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(var(--muted))" }}>
        <Bot size={14} className="text-violet-400" />
      </div>
      <div className="px-4 py-3 rounded-2xl" style={{ background: "hsl(var(--muted))", borderRadius: "4px 18px 18px 18px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: "50%", background: "#a78bfa",
              animation: "dotBounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
              display: "inline-block",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const STARTERS = [
  "How can I reduce my monthly expenses?",
  "Show me my debt situation",
  "What should I focus on for my savings goals?",
  "When are my upcoming EMI payments?",
];

export default function AIAdvisor() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm FinSage — your AI financial advisor 💼\n\nAsk me anything about your finances. I can help with transactions, debt, goals, savings, and more.",
      navigation: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleNavigate = useCallback((route: string) => {
    navigate(route);
  }, [navigate]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          user_id: "demo",
          context: { currentPage: location.pathname },
        }),
      });

      let data: ChatResponse;
      if (res.ok) {
        data = await res.json();
      } else {
        data = { reply: "⚠️ I encountered an issue. Please try again.", navigation: null };
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        navigation: data.navigation ?? null,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "⚠️ Connection error — check that the backend is running and try again.",
          navigation: null,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, location.pathname]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <AppLayout>
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">AI Advisor 🤖</h2>
          <p className="text-muted-foreground text-sm mt-1">Ask anything about your finances</p>
        </div>

        {/* Chat container */}
        <Card className="shadow-sm border" style={{ minHeight: "60vh", display: "flex", flexDirection: "column" }}>
          {/* Messages area */}
          <CardContent className="flex-1 p-4 overflow-y-auto" style={{ maxHeight: "calc(60vh - 80px)" }}>
            <div className="space-y-4 pb-2">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onNavigate={handleNavigate} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </CardContent>

          {/* Input area */}
          <div className="p-4 border-t" style={{ background: "hsl(var(--card))" }}>
            {/* Starter prompts — only when just welcome message */}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full border font-medium text-muted-foreground hover:text-foreground hover:border-violet-400/50 hover:bg-violet-500/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                id="chat-input"
                rows={1}
                className="flex-1 resize-none border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
                placeholder="Ask FinSage anything…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ maxHeight: 120, overflowY: "auto" }}
              />
              <button
                id="chat-send-btn"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}
              >
                <Send size={16} style={{ color: "#fff" }} />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Shift+Enter for newline · Enter to send · Powered by GPT-4o mini
            </p>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
