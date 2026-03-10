interface BadgeProps {
  children: string;
  variant?: "default" | "success" | "warning" | "neutral";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const styles = {
    default: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
