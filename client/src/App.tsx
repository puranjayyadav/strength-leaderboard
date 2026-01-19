import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Leaderboard from "@/pages/Leaderboard";
import AthleteProfile from "@/pages/AthleteProfile";
import ImportData from "@/pages/ImportData";
import Auth from "@/pages/Auth";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./_core/hooks/useAuth";
import Profile from "@/pages/Profile";
import Onboarding from "@/pages/Onboarding";
import { useEffect } from "react";

function Router() {
  const { user, loading, error } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (error) return;

    if (!loading) {
      console.log("[Router] Auth state:", {
        hasUser: !!user,
        athleteId: (user as any)?.athleteId,
        location,
        loading
      });
      if (!user && location !== "/auth") {
        setLocation("/auth");
      } else if (user) {
        // @ts-ignore - athleteId is added in DB schema
        const hasNoAthlete = !user.athleteId;
        if (hasNoAthlete && location !== "/onboarding") {
          console.log("[Router] Redirecting to onboarding because no athleteId found");
          setLocation("/onboarding");
        } else if (!hasNoAthlete && (location === "/auth" || location === "/onboarding")) {
          console.log("[Router] Redirecting to home because athleteId found");
          setLocation("/");
        }
      }
    }
  }, [user, loading, location, setLocation, error]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">
            We couldn't verify your identity. This might be a temporary issue.
          </p>
          <pre className="text-xs bg-black/10 p-2 rounded text-left overflow-auto max-h-40 mb-4">
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path={"/auth"} component={Auth} />
      <Route path={"/onboarding"} component={Onboarding} />
      <Route path={"/"} component={Leaderboard} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/import"} component={ImportData} />
      <Route path={"/athlete/:id"} component={AthleteProfile} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
