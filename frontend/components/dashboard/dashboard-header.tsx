type DashboardHeaderProps = Readonly<{
  location: string;
  temperature: string;
  forecast: string;
}>;

export function DashboardHeader({
  location,
  temperature,
  forecast,
}: DashboardHeaderProps) {
  return (
    <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
            Casa
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {location}
          </h1>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-5xl font-semibold leading-none sm:text-6xl">
              {temperature}
            </span>
            <span className="pb-1 text-sm font-medium text-white/60 sm:text-base">
              {forecast}
            </span>
          </div>
        </div>
        <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
          Dark mode
        </div>
      </div>
    </header>
  );
}
