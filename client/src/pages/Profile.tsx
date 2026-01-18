import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Edit2, Save, X } from "lucide-react";

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(null);

  // Get list of all athletes to allow selection
  const { data: allAthletes = [] } = trpc.leaderboard.getAll.useQuery();

  // If user has athleteId linked, use that, otherwise show selection
  const athleteId = selectedAthleteId || user?.athleteId;

  const { data: athlete, isLoading: athleteLoading } = trpc.athlete.getById.useQuery(
    { id: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const { data: liftHistory = [] } = trpc.athlete.getLiftHistory.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const { data: weightHistory = [] } = trpc.athlete.getWeightHistory.useQuery(
    { athleteId: athleteId || 0 },
    { enabled: !!athleteId }
  );

  const [formData, setFormData] = useState({
    bodyWeight: athlete?.bodyWeight || "",
    squat: athlete?.squat || "",
    bench: athlete?.bench || "",
    deadlift: athlete?.deadlift || "",
    ohp: athlete?.ohp || "",
  });

  const updateProfileMutation = trpc.athlete.updateProfile.useMutation();

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
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

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

  if (!athleteId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b border-border light-ray">
          <div className="container py-8">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-accent hover:text-accent/80 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="uppercase font-bold">Back</span>
            </button>
            <h1 className="text-5xl md:text-6xl font-bold uppercase tracking-wider">
              Select Your Profile
            </h1>
          </div>
        </div>

        <div className="container py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allAthletes.map((athlete) => (
              <Card
                key={athlete.id}
                className="card-dramatic cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setSelectedAthleteId(athlete.id)}
              >
                <h3 className="text-2xl font-bold text-accent mb-2">{athlete.name}</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground uppercase">Body Weight</div>
                    <div className="text-lg font-bold text-foreground">
                      {athlete.bodyWeight ? `${athlete.bodyWeight} lbs` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground uppercase">Total</div>
                    <div className="text-lg font-bold text-accent">
                      {athlete.total ? `${athlete.total} lbs` : "—"}
                    </div>
                  </div>
                </div>
                <Button className="btn-dramatic w-full">View Profile</Button>
              </Card>
            ))}
          </div>
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

  if (!athlete) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Athlete not found</p>
          <Button className="btn-dramatic" onClick={() => navigate("/")}>
            Back to Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = weightHistory.map((entry) => ({
    date: new Date(entry.recordedDate).toLocaleDateString(),
    weight: parseFloat(entry.weight),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border light-ray">
        <div className="container py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-accent hover:text-accent/80 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="uppercase font-bold">Back</span>
          </button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold uppercase tracking-wider mb-2">
                {athlete.name}
              </h1>
              <p className="text-muted-foreground">
                {athlete.bodyWeight ? `${athlete.bodyWeight} lbs` : "Body weight not recorded"}
              </p>
            </div>
            <Button
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
                  Edit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-12">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          {[
            { label: "Squat", value: athlete.squat },
            { label: "Bench", value: athlete.bench },
            { label: "Deadlift", value: athlete.deadlift },
            { label: "OHP", value: athlete.ohp },
            { label: "Total", value: athlete.total },
          ].map((stat) => (
            <Card key={stat.label} className="card-dramatic text-center">
              <div className="text-2xl md:text-3xl font-bold text-accent mb-1">
                {stat.value ? `${stat.value}` : "—"}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground uppercase font-bold">
                {stat.label}
              </div>
            </Card>
          ))}
        </div>

        {/* Edit form */}
        {isEditing && (
          <Card className="card-dramatic mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold uppercase">Edit Profile</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Body Weight (lbs)", key: "bodyWeight" },
                { label: "Squat (lbs)", key: "squat" },
                { label: "Bench (lbs)", key: "bench" },
                { label: "Deadlift (lbs)", key: "deadlift" },
                { label: "OHP (lbs)", key: "ohp" },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-accent uppercase font-bold text-sm mb-2 block">
                    {field.label}
                  </Label>
                  <Input
                    type="number"
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [field.key]: e.target.value,
                      })
                    }
                    className="bg-input border-border text-foreground"
                    placeholder="Enter value"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <Button className="btn-dramatic flex-1" onClick={handleSave}>
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Weight progress chart */}
        {chartData.length > 0 && (
          <Card className="card-dramatic mb-12">
            <h2 className="text-2xl font-bold uppercase mb-6">Weight Progress</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(216, 180, 105, 0.1)" />
                <XAxis dataKey="date" stroke="rgba(216, 180, 105, 0.6)" />
                <YAxis stroke="rgba(216, 180, 105, 0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(13, 13, 13, 0.95)",
                    border: "1px solid rgba(216, 180, 105, 0.3)",
                  }}
                  labelStyle={{ color: "rgba(216, 180, 105, 1)" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="rgba(216, 180, 105, 1)"
                  dot={{ fill: "rgba(216, 180, 105, 1)", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Body Weight (lbs)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Lift history */}
        {liftHistory.length > 0 && (
          <Card className="card-dramatic">
            <h2 className="text-2xl font-bold uppercase mb-6">Lift History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-bold uppercase text-accent">Exercise</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-accent">Weight</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-accent">Reps</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-accent">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {liftHistory.slice(-10).reverse().map((lift) => (
                    <tr key={lift.id} className="border-b border-border hover:bg-card/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{lift.exerciseType}</td>
                      <td className="px-4 py-3 text-right text-accent">{lift.weight} lbs</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{lift.reps}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {new Date(lift.recordedDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
