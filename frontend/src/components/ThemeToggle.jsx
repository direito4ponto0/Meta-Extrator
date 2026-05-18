import { useState, useEffect } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
      className="inline-flex h-10 w-10 items-center justify-center border transition-all hover:border-[var(--ma-accent)]"
      style={{ 
        borderColor: 'var(--ma-border)',
        backgroundColor: 'var(--ma-bg)',
        color: 'var(--ma-text)'
      }}
      title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
    >
      {theme === "light" ? (
        <Moon size={20} weight="bold" />
      ) : (
        <Sun size={20} weight="bold" />
      )}
    </button>
  );
}
