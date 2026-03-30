import { WifiOff } from "lucide-react";

export function FinSageErrorState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <WifiOff className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">FinSage is thinking… please try again</p>
      <p className="text-xs text-muted-foreground/70">If this keeps happening, check your connection</p>
    </div>
  );
}
