import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Home as HomeIcon, Database, Archive } from "lucide-react";
import HomePage from "@/pages/home";
import KnowledgeBasePage from "@/pages/knowledge-base";
import SavedSequencesPage from "@/pages/saved-sequences";

type Tab = "home" | "knowledge-base" | "saved-sequences";

const tabs: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "knowledge-base", label: "Knowledge Base", icon: Database },
  { id: "saved-sequences", label: "Saved Sequences", icon: Archive },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [rerunInput, setRerunInput] = useState<string | null>(null);

  const handleRerun = (rawInput: string) => {
    setRerunInput(rawInput);
    setActiveTab("home");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">B</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate leading-tight" data-testid="text-app-title">
                Bruker Outreach Engine
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">
                Sequence Compiler
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={`gap-1.5 ${isActive ? "" : ""}`}
                  data-testid={`button-tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Button>
              );
            })}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        {activeTab === "home" && <HomePage key={rerunInput ?? "default"} />}
        {activeTab === "knowledge-base" && <KnowledgeBasePage />}
        {activeTab === "saved-sequences" && <SavedSequencesPage onRerun={handleRerun} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppContent />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
