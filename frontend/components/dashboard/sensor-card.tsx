import type { DashboardSensors } from "@/components/dashboard/dashboard-data";

export function SensorCard({
  sensors,
}: Readonly<{ sensors: DashboardSensors }>) {
  const hasReadings =
    sensors.temperature !== null || sensors.humidity !== null;

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/45">DHT22</p>
        {sensors.deviceName ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            {sensors.deviceName}
          </span>
        ) : null}
      </div>

      {hasReadings ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm text-white/45">Temperatura</p>
            <p className="mt-1 text-3xl font-semibold">
              {sensors.temperature ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-white/45">Humedad</p>
            <p className="mt-1 text-3xl font-semibold">
              {sensors.humidity ?? "—"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/55">
          Sin datos todavía
          {sensors.deviceName
            ? `: esperando lecturas de ${sensors.deviceName}`
            : ""}
        </p>
      )}
    </article>
  );
}
