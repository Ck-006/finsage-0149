import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function LoadingSection({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="shadow-sm border">
      <CardContent className="p-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function ErrorSection({ message = "FinSage is thinking… please try again" }: { message?: string }) {
  return (
    <Card className="shadow-sm border border-warning/30">
      <CardContent className="p-5 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-warning shrink-0" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
