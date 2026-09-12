import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Your app starts here</CardTitle>
          <CardDescription>Describe what you want in the chat and watch it appear.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This page is replaced by the first build.
        </CardContent>
      </Card>
    </main>
  );
}
