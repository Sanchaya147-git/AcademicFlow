import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">AcademicFlow</h1>
      <p className="max-w-xl text-center text-lg text-muted-foreground">
        AI-powered academic execution data capture and schedule-linking layer.
      </p>
      <Button variant="default">Frontend is ready</Button>
    </main>
  );
}
