import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { Trophy, LogIn, LogOut } from "lucide-react";
// getLoginUrl removed

export default function Leaderboard() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [sortBy, setSortBy] = useState<"total" | "squat" | "bench" | "deadlift" | "ohp">("total");

  const { data: athletes = [], isLoading } = trpc.leaderboard.getByExercise.useQuery({
    exercise: sortBy,
  });

  const exercises = [
    { id: "total", label: "Total", icon: "🏆" },
    { id: "squat", label: "Squat", icon: "🦵" },
    { id: "bench", label: "Bench", icon: "💪" },
    { id: "deadlift", label: "Deadlift", icon: "🔥" },
    { id: "ohp", label: "OHP", icon: "⬆️" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with dramatic gradient */}
      <div className="relative overflow-hidden border-b border-border light-ray">
        <div className="container py-12 md:py-16 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold uppercase tracking-wider mb-2">
                Strength Leaderboard
              </h1>
              <p className="text-muted-foreground text-lg">
                Track the elite. Dominate the rankings.
              </p>
            </div>
            <div className="flex gap-3">
              {loading ? null : isAuthenticated ? (
                <>
                  <Link href="/profile">
                    <Button className="btn-dramatic">
                      My Profile
                    </Button>
                  </Link>
                  <Link href="/import">
                    <Button variant="outline" className="uppercase font-bold">
                      Import Data
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => logout()}
                    className="uppercase font-bold"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Link href="/auth">
                  <Button className="btn-dramatic text-white">
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-12">
        {/* Exercise tabs */}
        <div className="mb-8">
          <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-card border border-border p-2 rounded-lg">
              {exercises.map((ex) => (
                <TabsTrigger
                  key={ex.id}
                  value={ex.id}
                  className="uppercase font-bold text-xs sm:text-sm data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                >
                  <span className="mr-1">{ex.icon}</span>
                  <span>{ex.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Leaderboard table */}
        <div className="card-dramatic overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin mb-4">
                  <Trophy className="w-12 h-12 text-accent" />
                </div>
                <p className="text-muted-foreground">Loading leaderboard...</p>
              </div>
            </div>
          ) : athletes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No athletes found</p>
              {isAuthenticated && (
                <Link href="/profile">
                  <Button className="btn-dramatic">Add Your Lifts</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-4 text-left text-sm font-bold uppercase text-accent">Rank</th>
                    <th className="px-4 py-4 text-left text-sm font-bold uppercase text-accent">Athlete</th>
                    <th className="px-4 py-4 text-right text-sm font-bold uppercase text-accent">BW</th>
                    <th className="px-4 py-4 text-right text-sm font-bold uppercase text-accent">
                      {sortBy === "total" ? "Total" : sortBy.toUpperCase()}
                    </th>
                    <th className="px-4 py-4 text-right text-sm font-bold uppercase text-accent">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((athlete, idx) => {
                    const weight =
                      sortBy === "total"
                        ? athlete.total
                        : sortBy === "squat"
                          ? athlete.squat
                          : sortBy === "bench"
                            ? athlete.bench
                            : sortBy === "deadlift"
                              ? athlete.deadlift
                              : athlete.ohp;

                    return (
                      <tr
                        key={athlete.id}
                        className="border-b border-border hover:bg-card/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <span className="text-2xl">🥇</span>}
                            {idx === 1 && <span className="text-2xl">🥈</span>}
                            {idx === 2 && <span className="text-2xl">🥉</span>}
                            {idx >= 3 && (
                              <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-foreground">{athlete.name}</div>
                        </td>
                        <td className="px-4 py-4 text-right text-muted-foreground">
                          {athlete.bodyWeight ? `${athlete.bodyWeight} lbs` : "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-lg font-bold text-accent">
                            {weight ? `${weight} lbs` : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link href={`/athlete/${athlete.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs uppercase font-bold"
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="card-dramatic text-center">
            <div className="text-4xl font-bold text-accent mb-2">{athletes.length}</div>
            <div className="text-muted-foreground uppercase text-sm font-bold">Total Athletes</div>
          </Card>
          <Card className="card-dramatic text-center">
            <div className="text-4xl font-bold text-accent mb-2">
              {athletes[0]?.total ? `${athletes[0].total}` : "—"}
            </div>
            <div className="text-muted-foreground uppercase text-sm font-bold">Top Total</div>
          </Card>
          <Card className="card-dramatic text-center">
            <div className="text-4xl font-bold text-accent mb-2">
              {athletes[0]?.bodyWeight ? `${athletes[0].bodyWeight}` : "—"}
            </div>
            <div className="text-muted-foreground uppercase text-sm font-bold">Champion BW</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
