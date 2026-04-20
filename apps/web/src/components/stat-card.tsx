interface Props {
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ label, value, sub }: Props) {
  return (
    <div className="rounded-[8px] border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-fg">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold text-fg">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-muted-fg">{sub}</p>}
    </div>
  );
}
