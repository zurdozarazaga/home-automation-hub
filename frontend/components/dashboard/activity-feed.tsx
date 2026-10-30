type ActivityItem = Readonly<{
  time: string;
  label: string;
}>;

export function ActivityFeed({
  items,
}: Readonly<{ items: readonly ActivityItem[] }>) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={`${item.time}-${item.label}`}
          className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3"
        >
          <span className="w-14 text-sm font-semibold text-white/50">{item.time}</span>
          <span className="h-2 w-2 rounded-full bg-cyan-300" />
          <span className="text-sm font-medium text-white/85">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
