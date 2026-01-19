import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Trophy, LogIn, LogOut, ArrowUpDown, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// getLoginUrl removed

export default function Leaderboard() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [sortBy, setSortBy] = useState<"total" | "squat" | "bench" | "deadlift" | "ohp">("total");
  const [selectedGymId, setSelectedGymId] = useState<number | undefined>(undefined);
  const [hasSetInitialGym, setHasSetInitialGym] = useState(false);

  const { data: gyms = [] } = trpc.gym.getAll.useQuery();
  const { data: athletes = [], isLoading } = trpc.leaderboard.getByExercise.useQuery({
    exercise: sortBy,
    gymId: selectedGymId,
  });

  const { data: athlete } = trpc.athlete.getById.useQuery(
    { id: (user as any)?.athleteId || 0 },
    { enabled: !!(user as any)?.athleteId && !hasSetInitialGym }
  );

  useEffect(() => {
    if (athlete && !hasSetInitialGym) {
      if (athlete.gymId) {
        setSelectedGymId(athlete.gymId);
      }
      setHasSetInitialGym(true);
    }
  }, [athlete, hasSetInitialGym]);

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
              <p className="text-muted-foreground text-lg uppercase font-bold tracking-widest italic flex items-center gap-2">
                {selectedGymId
                  ? gyms.find(g => g.id === selectedGymId)?.name
                  : "Global Rankings"}
                <MapPin className="w-4 h-4 text-accent" />
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <Select
                value={selectedGymId?.toString() || "global"}
                onValueChange={(val: string) => setSelectedGymId(val === "global" ? undefined : parseInt(val))}
              >
                <SelectTrigger className="w-[200px] bg-card/50 border-accent/20 font-bold uppercase text-xs h-10">
                  <SelectValue placeholder="Select Space" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="global" className="font-bold uppercase text-xs">🌍 Global Leaderboard</SelectItem>
                  {gyms.map(gym => (
                    <SelectItem key={gym.id} value={gym.id.toString()} className="font-bold uppercase text-xs">
                      🏟️ {gym.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                {loading ? null : isAuthenticated ? (
                  <>
                    <Link href="/profile">
                      <Button className="btn-dramatic">
                        My Profile
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
                    <th className="px-4 py-4 text-left text-xs font-black uppercase text-accent tracking-tighter">Rank</th>
                    <th className="px-4 py-4 text-left text-xs font-black uppercase text-accent tracking-tighter">Athlete</th>
                    <th className="px-4 py-4 text-right text-xs font-black uppercase text-accent tracking-tighter">BW</th>
                    <th
                      onClick={() => setSortBy('squat')}
                      className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'squat' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Squat <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => setSortBy('bench')}
                      className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'bench' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Bench <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => setSortBy('deadlift')}
                      className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'deadlift' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Deadlift <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => setSortBy('ohp')}
                      className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'ohp' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        OHP <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => setSortBy('total')}
                      className={`px-4 py-4 text-right text-xs font-black uppercase tracking-tighter cursor-pointer hover:bg-accent/5 transition-colors ${sortBy === 'total' ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-black uppercase text-accent tracking-tighter">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((athlete, idx) => {
                    return (
                      <tr
                        key={athlete.id}
                        className="border-b border-border hover:bg-card/50 transition-colors group"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <span className="text-xl">🥇</span>}
                            {idx === 1 && <span className="text-xl">🥈</span>}
                            {idx === 2 && <span className="text-xl">🥉</span>}
                            {idx >= 3 && (
                              <span className="text-xs font-black text-muted-foreground/50">#{idx + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Avatar className="w-12 h-12 border-2 border-accent/20 cursor-pointer hover:scale-105 transition-transform">
                                  <AvatarImage src={athlete.avatarUrl || ""} className="object-cover" />
                                  <AvatarFallback className="bg-muted text-sm font-black">{athlete.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                              </DialogTrigger>
                              <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                                <VisuallyHidden>
                                  <DialogTitle>{athlete.name}'s Profile Picture</DialogTitle>
                                </VisuallyHidden>
                                <img
                                  src={athlete.avatarUrl || ""}
                                  alt={athlete.name}
                                  className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                                />
                              </DialogContent>
                            </Dialog>
                            <div className="font-bold text-foreground group-hover:text-accent transition-colors">
                              {athlete.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-xs text-muted-foreground font-medium">
                          {athlete.bodyWeight ? `${athlete.bodyWeight}` : "—"}
                        </td>
                        <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'squat' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                          {athlete.squat || "—"}
                        </td>
                        <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'bench' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                          {athlete.bench || "—"}
                        </td>
                        <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'deadlift' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                          {athlete.deadlift || "—"}
                        </td>
                        <td className={`px-4 py-4 text-right text-sm font-bold ${sortBy === 'ohp' ? 'text-accent bg-accent/5' : 'text-foreground/70'}`}>
                          {athlete.ohp || "—"}
                        </td>
                        <td className={`px-4 py-4 text-right text-base font-black ${sortBy === 'total' ? 'text-accent bg-accent/10' : 'text-foreground'}`}>
                          {athlete.total || "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link href={`/athlete/${athlete.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] uppercase font-black hover:bg-accent hover:text-black transition-all"
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
