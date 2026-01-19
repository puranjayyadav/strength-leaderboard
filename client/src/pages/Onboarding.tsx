import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, Save, ChevronRight, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Onboarding() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const utils = trpc.useUtils();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        bodyWeight: "",
        squat: "",
        bench: "",
        deadlift: "",
        ohp: "",
        avatarUrl: "",
    });
    const [uploading, setUploading] = useState(false);

    // Auto-fill name from auth data when it loads
    useEffect(() => {
        if (user?.name && !formData.name) {
            setFormData(prev => ({ ...prev, name: user.name || "" }));
        }
    }, [user?.name]);

    const setupMutation = trpc.athlete.setupProfile.useMutation({
        onSuccess: async () => {
            await utils.auth.me.invalidate();
            toast.success("Profile created! Welcome to the leaderboard.");
            setLocation("/");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to create profile. Please try again.");
        }
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
            toast.success("Image uploaded!");
        } catch (error: any) {
            toast.error(error.message || "Failed to upload image. (Make sure you have an 'avatars' bucket in Supabase)");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        await setupMutation.mutateAsync({
            name: formData.name,
            avatarUrl: formData.avatarUrl || undefined,
            bodyWeight: formData.bodyWeight ? parseFloat(formData.bodyWeight) : undefined,
            squat: formData.squat ? parseFloat(formData.squat) : undefined,
            bench: formData.bench ? parseFloat(formData.bench) : undefined,
            deadlift: formData.deadlift ? parseFloat(formData.deadlift) : undefined,
            ohp: formData.ohp ? parseFloat(formData.ohp) : undefined,
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
            <div className="max-w-xl w-full">
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Trophy className="w-16 h-16 text-accent mx-auto mb-6" />
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2">
                        Welcome to the Elite
                    </h1>
                    <p className="text-muted-foreground text-lg uppercase font-bold tracking-widest">
                        Let's set up your profile
                    </p>
                </div>

                <Card className="card-dramatic p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-muted">
                        <div
                            className="h-full bg-accent transition-all duration-500"
                            style={{ width: `${(step / 2) * 100}%` }}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex flex-col items-center gap-6 mb-8">
                                    <div className="relative group">
                                        <Avatar className="w-32 h-32 border-4 border-accent/20 group-hover:border-accent transition-all duration-500">
                                            <AvatarImage src={formData.avatarUrl} />
                                            <AvatarFallback className="bg-card text-accent">
                                                <Camera className="w-10 h-10" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <label
                                            htmlFor="pfp-upload"
                                            className="absolute bottom-0 right-0 bg-accent text-black p-2 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg"
                                        >
                                            <Upload className="w-5 h-5" />
                                        </label>
                                        <input
                                            id="pfp-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            disabled={uploading}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs uppercase font-black text-accent tracking-widest mb-1">
                                            {uploading ? "Uploading..." : "Profile Image"}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold italic">Show them who's coming for the #1 spot</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-xs uppercase font-black text-accent tracking-widest">
                                        Your Full Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter your name as you want it on the leaderboard"
                                        className="bg-card/50 border-border text-lg h-14"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground uppercase font-bold">This is how you will appear to other athletes.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bw" className="text-xs uppercase font-black text-accent tracking-widest">
                                        Current Body Weight (lbs)
                                    </Label>
                                    <Input
                                        id="bw"
                                        type="number"
                                        value={formData.bodyWeight}
                                        onChange={(e) => setFormData({ ...formData, bodyWeight: e.target.value })}
                                        placeholder="e.g. 185"
                                        className="bg-card/50 border-border text-lg h-14"
                                    />
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => formData.name && setStep(2)}
                                    disabled={!formData.name}
                                    className="w-full btn-dramatic h-14 text-lg"
                                >
                                    Next Step <ChevronRight className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <h3 className="text-xs uppercase font-black text-accent tracking-widest mb-4">Input Your Personal Records (Optional)</h3>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Squat</Label>
                                        <Input
                                            type="number"
                                            value={formData.squat}
                                            onChange={(e) => setFormData({ ...formData, squat: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bench Press</Label>
                                        <Input
                                            type="number"
                                            value={formData.bench}
                                            onChange={(e) => setFormData({ ...formData, bench: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Deadlift</Label>
                                        <Input
                                            type="number"
                                            value={formData.deadlift}
                                            onChange={(e) => setFormData({ ...formData, deadlift: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">OHP</Label>
                                        <Input
                                            type="number"
                                            value={formData.ohp}
                                            onChange={(e) => setFormData({ ...formData, ohp: e.target.value })}
                                            placeholder="Lbs"
                                            className="bg-card/50 border-border h-12"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="flex-1 h-14 uppercase font-bold"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={setupMutation.isPending}
                                        className="flex-[2] btn-dramatic h-14 text-lg"
                                    >
                                        {setupMutation.isPending ? "Saving..." : "Enter Leaderboard"}
                                        <Save className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>
                </Card>
            </div>
        </div>
    );
}
