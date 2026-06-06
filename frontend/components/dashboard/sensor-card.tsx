type SensorCardProps = Readonly<{
  label: string;
  value: string;
  badge: string;
}>;

export function SensorCard({ label, value, badge }: SensorCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-white/45">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-4xl font-semibold">{value}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
          {badge}
        </span>
      </div>
    </article>
  );
}
