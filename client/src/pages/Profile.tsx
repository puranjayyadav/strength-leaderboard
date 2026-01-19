import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Edit2, Save, X, Plus, TrendingUp, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingLift, setIsAddingLift] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(null);

  // If user has athleteId linked, use that, otherwise show selection OR allow them to create/link
  const athleteId = user?.athleteId || selectedAthleteId;

  const { data: athlete, isLoading: athleteLoading, refetch: refetchAthlete } = trpc.athlete.getById.useQuery(
    { id: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const { data: liftHistory = [], refetch: refetchLifts } = trpc.athlete.getLiftHistory.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const { data: weightHistory = [], refetch: refetchWeight } = trpc.athlete.getWeightHistory.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const [formData, setFormData] = useState({
    bodyWeight: "",
    squat: "",
    bench: "",
    deadlift: "",
    ohp: "",
  });

  const [newLift, setNewLift] = useState({
    exerciseType: "squat",
    weight: "",
    reps: "1",
    recordedDate: new Date().toISOString().split('T')[0],
  });

  const updateProfileMutation = trpc.athlete.updateProfile.useMutation();
  const addLiftMutation = trpc.athlete.addLift.useMutation();
  const addWeightMutation = trpc.athlete.addWeight.useMutation();

  const handleSave = async () => {
    if (!athleteId) return;
    try {
      await updateProfileMutation.mutateAsync({
        athleteId,
        bodyWeight: formData.bodyWeight ? parseFloat(formData.bodyWeight) : undefined,
        squat: formData.squat ? parseFloat(formData.squat) : undefined,
        bench: formData.bench ? parseFloat(formData.bench) : undefined,
        deadlift: formData.deadlift ? parseFloat(formData.deadlift) : undefined,
        ohp: formData.ohp ? parseFloat(formData.ohp) : undefined,
      });
      setIsEditing(false);
      refetchAthlete();
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handleAddLift = async () => {
    if (!athleteId) return;
    try {
      await addLiftMutation.mutateAsync({
        athleteId,
        exerciseType: newLift.exerciseType,
        weight: parseFloat(newLift.weight),
        reps: parseInt(newLift.reps),
        recordedDate: newLift.recordedDate,
      });

      // Also update the main profile PR if this is higher? 
      // The backend should probably handle that or we do it here.
      // For now, let's just refetch.

      setIsAddingLift(false);
      setNewLift({ ...newLift, weight: "" });
      refetchLifts();
      refetchAthlete();
    } catch (error) {
      console.error("Failed to add lift:", error);
    }
  };

  const handleAddWeight = async () => {
    if (!athleteId || !formData.bodyWeight) return;
    try {
      await addWeightMutation.mutateAsync({
        athleteId,
        weight: parseFloat(formData.bodyWeight),
        recordedDate: new Date().toISOString().split('T')[0],
      });
      refetchWeight();
    } catch (error) {
      console.error("Failed to add weight entry:", error);
    }
  };

  // Sync form data when athlete loads
  useMemo(() => {
    if (athlete) {
      setFormData({
        bodyWeight: athlete.bodyWeight?.toString() || "",
        squat: athlete.squat?.toString() || "",
        bench: athlete.bench?.toString() || "",
        deadlift: athlete.deadlift?.toString() || "",
        ohp: athlete.ohp?.toString() || "",
      });
    }
  }, [athlete]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your profile</p>
          <Button className="btn-dramatic" onClick={() => navigate("/")}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  if (athleteLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Loading athlete profile...</p>
      </div>
    );
  }

  if (!athleteId || !athlete) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <TrendingUp className="w-16 h-16 text-accent mx-auto mb-6" />
          <h1 className="text-3xl font-bold uppercase mb-4">No Profile Linked</h1>
          <p className="text-muted-foreground mb-8">
            Your account isn't linked to an athlete profile yet. If you're on the leaderboard,
            contact an admin to link your account, or wait for the auto-sync to pick up your name.
          </p>
          <Button className="btn-dramatic w-full" onClick={() => navigate("/")}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  // Prepare chart data for Lifts
  const liftChartData = (type: string) => {
    return liftHistory
      .filter(l => l.exerciseType.toLowerCase() === type.toLowerCase())
      .map(entry => ({
        date: new Date(entry.recordedDate).toLocaleDateString(),
        weight: parseFloat(entry.weight),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const weightChartData = weightHistory
    .map((entry) => ({
      date: new Date(entry.recordedDate).toLocaleDateString(),
      weight: parseFloat(entry.weight),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <div className="border-b border-border light-ray sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="uppercase font-bold text-xs tracking-widest">Back</span>
            </button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-accent/30 text-accent hover:bg-accent/10"
                onClick={() => setIsAddingLift(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Lift
              </Button>
              <Button
                size="sm"
                className="btn-dramatic"
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              >
                {isEditing ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit PRs
                  </>
                )}
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wider mb-1">
              {athlete.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground uppercase font-bold tracking-tighter">
              <span className="text-accent">Rank #?</span>
              <span>•</span>
              <span>{athlete.bodyWeight ? `${athlete.bodyWeight} lbs` : "No BW"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Squat", value: athlete.squat },
            { label: "Bench", value: athlete.bench },
            { label: "Deadlift", value: athlete.deadlift },
            { label: "OHP", value: athlete.ohp },
            { label: "Total", value: athlete.total },
          ].map((stat) => (
            <Card key={stat.label} className="card-dramatic p-4 text-center border-accent/20">
              <div className="text-xl md:text-2xl font-bold text-accent">
                {stat.value ? `${stat.value}` : "—"}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground uppercase font-black tracking-widest mt-1">
                {stat.label}
              </div>
            </Card>
          ))}
        </div>

        {/* Add Lift Overlay/Modal-like Card */}
        {isAddingLift && (
          <Card className="card-dramatic mb-8 border-accent border-2 bg-black/90">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                Record New Lift
              </h2>
              <button onClick={() => setIsAddingLift(false)} className="text-muted-foreground hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Exercise</Label>
                <select
                  className="w-full bg-input border border-border p-2 rounded-md text-foreground"
                  value={newLift.exerciseType}
                  onChange={(e) => setNewLift({ ...newLift, exerciseType: e.target.value })}
                >
                  <option value="squat">Squat</option>
                  <option value="bench">Bench</option>
                  <option value="deadlift">Deadlift</option>
                  <option value="ohp">OHP</option>
                </select>
              </div>
              <div>
                <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Weight (lbs)</Label>
                <Input type="number" value={newLift.weight} onChange={(e) => setNewLift({ ...newLift, weight: e.target.value })} />
              </div>
              <div>
                <Label className="text-accent uppercase font-bold text-[10px] mb-2 block">Reps</Label>
                <Input type="number" value={newLift.reps} onChange={(e) => setNewLift({ ...newLift, reps: e.target.value })} />
              </div>
              <div className="flex items-end">
                <Button className="btn-dramatic w-full" onClick={handleAddLift} disabled={!newLift.weight}>
                  Add Entry
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Edit PRs Form */}
        {isEditing && (
          <Card className="card-dramatic mb-8 border-accent/40">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase">Update Personal Records</h2>
              <button onClick={() => setIsEditing(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "BW", key: "bodyWeight" },
                { label: "Squat", key: "squat" },
                { label: "Bench", key: "bench" },
                { label: "DL", key: "deadlift" },
                { label: "OHP", key: "ohp" },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-accent uppercase font-bold text-[10px] mb-1 block">{field.label}</Label>
                  <Input
                    type="number"
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Button className="btn-dramatic flex-1" onClick={handleSave}>Save PRs</Button>
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* Charts & History */}
        <Tabs defaultValue="charts" className="mb-12">
          <TabsList className="bg-card border border-border mb-6">
            <TabsTrigger value="charts" className="data-[state=active]:bg-accent data-[state=active]:text-black">
              Progress Visuals
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-accent data-[state=active]:text-black">
              Full History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-8 mt-0">
            {/* Dynamic Lifts Logic */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['squat', 'bench', 'deadlift', 'ohp'].map(type => {
                const data = liftChartData(type);
                if (data.length < 2) return null;
                return (
                  <Card key={type} className="card-dramatic p-6">
                    <h3 className="text-lg font-bold uppercase text-accent mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {type} History
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(216, 180, 105, 0.05)" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="rgba(216, 180, 105, 0.4)" domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#000", border: "1px solid #d8b469" }}
                          labelStyle={{ color: "#d8b469" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#d8b469"
                          strokeWidth={3}
                          dot={{ fill: "#d8b469", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                );
              })}

              {/* Body Weight Chart */}
              {weightChartData.length >= 2 && (
                <Card className="card-dramatic p-6">
                  <h3 className="text-lg font-bold uppercase text-accent mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Weight Progress
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(216, 180, 105, 0.05)" />
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="rgba(216, 180, 105, 0.4)" domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#000", border: "1px solid #d8b469" }}
                        labelStyle={{ color: "#d8b469" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#d8b469"
                        strokeWidth={2}
                        dot={{ fill: "#d8b469", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>

            {(liftHistory.length < 2 && weightHistory.length < 2) && (
              <Card className="card-dramatic p-12 text-center border-dashed border-accent/20">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground italic">Add more entries to see your progress trends</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="card-dramatic overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-accent/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-accent tracking-widest">Exercise</th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase text-accent tracking-widest">Weight</th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase text-accent tracking-widest">Reps</th>
                      <th className="px-6 py-4 text-right text-xs font-black uppercase text-accent tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {liftHistory.sort((a, b) => new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()).map((lift) => (
                      <tr key={lift.id} className="hover:bg-accent/5 transition-colors">
                        <td className="px-6 py-4 font-bold uppercase text-sm">{lift.exerciseType}</td>
                        <td className="px-6 py-4 text-right text-accent font-black">{lift.weight} <span className="text-[10px] text-muted-foreground">LBS</span></td>
                        <td className="px-6 py-4 text-right font-medium">{lift.reps}</td>
                        <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                          {new Date(lift.recordedDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {liftHistory.length === 0 && (
                <div className="p-12 text-center text-muted-foreground italic">No lift entries yet.</div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
