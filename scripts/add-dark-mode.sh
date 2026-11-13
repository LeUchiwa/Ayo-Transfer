#!/usr/bin/env bash
set -euo pipefail

# 1. Créer le ThemeContext
cat > src/app/contexts/ThemeContext.tsx <<'EOF'
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("ayo_theme");
    if (saved === "light" || saved === "dark") return saved;
    // Par défaut, on suit le thème du système
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("ayo_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
EOF
echo "✅ ThemeContext créé"

# 2. Créer le bouton ThemeToggle
cat > src/app/components/ThemeToggle.tsx <<'EOF'
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "../contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full w-9 h-9 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      title="Changer de thème"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  );
}
EOF
echo "✅ ThemeToggle créé"

# 3. Mettre à jour App.tsx
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/App.tsx")
src = p.read_text(encoding="utf-8")

if "ThemeProvider" not in src:
    src = src.replace('import { WalletProvider } from "./contexts/WalletContext";', 'import { WalletProvider } from "./contexts/WalletContext";\nimport { ThemeProvider } from "./contexts/ThemeContext";')
    src = src.replace('<WalletProvider>', '<ThemeProvider>\n      <WalletProvider>')
    src = src.replace('</WalletProvider>', '</WalletProvider>\n    </ThemeProvider>')
    p.write_text(src, encoding="utf-8")
    print("✅ App.tsx enveloppé dans ThemeProvider")
PY

# 4. Ajouter le bouton dans le Header (ProtectedLayout.tsx)
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/components/ProtectedLayout.tsx")
src = p.read_text(encoding="utf-8")

if "ThemeToggle" not in src:
    src = src.replace('import { usePendingTransactionsCount } from "../hooks/usePendingTransactionsCount";', 'import { usePendingTransactionsCount } from "../hooks/usePendingTransactionsCount";\nimport { ThemeToggle } from "./ThemeToggle";')

# On l'ajoute juste avant le menu profil desktop
anchor = '<DropdownMenu>'
new_header = '''<ThemeToggle />
                <DropdownMenu>'''
if "<ThemeToggle />" not in src:
    # On ne le met que dans la nav desktop pour l'instant (au dessus du menu avatar)
    src = src.replace(anchor, new_header, 1)

# On l'ajoute aussi dans la version mobile
anchor_mobile = '<div className="md:hidden flex items-center gap-2">\n                <DropdownMenu>'
new_mobile = '<div className="md:hidden flex items-center gap-2">\n                <ThemeToggle />\n                <DropdownMenu>'
if "ThemeToggle />\n                <DropdownMenu>" not in src:
    src = src.replace(anchor_mobile, new_mobile, 1)

p.write_text(src, encoding="utf-8")
print("✅ Bouton ThemeToggle ajouté au Header")
PY
