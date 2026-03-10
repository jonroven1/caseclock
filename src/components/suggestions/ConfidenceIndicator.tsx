"use client";

interface ConfidenceIndicatorProps {
  confidence: number;
  size?: "sm" | "md";
}

export function ConfidenceIndicator({
  confidence,
  size = "sm",
}: ConfidenceIndicatorProps) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-300";

  return (
    <div
      className={`flex items-center gap-1.5 ${size === "md" ? "gap-2" : ""}`}
      title={`Case match confidence: ${pct}%`}
    >
      <div
        className={`overflow-hidden rounded-full bg-slate-200 ${
          size === "md" ? "h-2 w-16" : "h-1.5 w-10"
        }`}
      >
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-medium text-slate-500 ${size === "md" ? "text-xs" : "text-[10px]"}`}
      >
        {pct}%
      </span>
    </div>
  );
}
