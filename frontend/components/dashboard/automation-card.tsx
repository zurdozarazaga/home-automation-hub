type AutomationCardProps = Readonly<{
  title: string;
  schedule: string;
  status: string;
}>;

export function AutomationCard({ title, schedule, status }: AutomationCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4">
        <div>
          <p className="text-sm text-white/45">Horario</p>
          <p className="mt-1 text-lg font-semibold">{schedule}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/45">Estado</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">{status}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="h-12 rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-white">
          Activar
        </button>
        <button className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70">
          Pausar
        </button>
      </div>
      <p className="text-xs uppercase tracking-[0.28em] text-white/30">{title}</p>
    </div>
  );
}
