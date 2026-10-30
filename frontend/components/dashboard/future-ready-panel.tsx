type FutureReadyPanelProps = Readonly<{
  title: string;
  places: readonly string[];
}>;

export function FutureReadyPanel({ title, places }: FutureReadyPanelProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/40">
            Future ready
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/55">
          Garden first
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {places.map((place) => (
          <div
            key={place}
            className="rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-4 text-sm font-medium text-white/80"
          >
            {place}
          </div>
        ))}
      </div>
    </section>
  );
}
