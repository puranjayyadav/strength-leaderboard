import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast"; // Or sonner? App.tsx uses Sonner
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft, Upload } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ImportData() {
  const { isAuthenticated, loading } = useAuth();
  const [data, setData] = useState("");
  const importMutation = trpc.athlete.importData.useMutation();

  const handleImport = async () => {
    if (!data.trim()) {
      toast.error("Please enter some data to import");
      return;
    }

    try {
      const result = await importMutation.mutateAsync(data);
      if (result.errorCount > 0) {
        toast.warning(`Imported ${result.successCount} records. Failed: ${result.errorCount}`);
        console.error("Import errors:", result.errors);
      } else {
        toast.success(`Successfully imported ${result.successCount} records!`);
        setData("");
      }
    } catch (error) {
      toast.error("Failed to import data");
      console.error(error);
    }
  };

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="container py-12 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be logged in to import data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Back to Leaderboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold uppercase tracking-wider">Import Data</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Import</CardTitle>
            <CardDescription>
              Paste the tab-separated data (e.g. from Excel/Spreadsheet) below.
              <br />
              Columns expected: Name, Bw, Squat, Bench, Deadlift, Total, OHP, Incline Bench, RDL, Rev Band Bench, Rev Band Squat, Rev Band DL, Slingshot Bench
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste data here..."
              className="min-h-[300px] font-mono text-sm"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <Button
              onClick={handleImport}
              className="w-full btn-dramatic"
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                "Importing..."
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
