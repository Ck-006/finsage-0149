import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("finsage-theme") as Theme | null;
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  // Apply theme class. Remove theme-ready to suppress the transition
  // during the class swap, then re-enable it one rAF later so manual
  // toggles animate smoothly but initial load has no flash.
  useEffect(() => {
    const root = document.documentElement;

    // Suppress transitions while switching
    root.classList.remove("theme-ready");

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("finsage-theme", theme);

    // Re-enable transitions after browser paints the new theme
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("theme-ready");
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [theme]);

  // On first mount, enable transitions after a short delay
  // so the very first paint is instant but subsequent toggles are animated
  useEffect(() => {
    const timer = setTimeout(() => {
      document.documentElement.classList.add("theme-ready");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
