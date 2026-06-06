type DeviceListItem = Readonly<{
  id: string;
  name: string;
  state: string;
  tone: string;
  statusLabel: string;
  ipAddress: string;
}>;

export function DeviceList({
  devices,
}: Readonly<{ devices: readonly DeviceListItem[] }>) {
  return (
    <div className="space-y-3">
      {devices.length === 0 ? (
        <article className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-5">
          <p className="text-sm font-medium text-white/70">
            No hay dispositivos registrados en el backend.
          </p>
        </article>
      ) : null}
      {devices.map((device) => (
        <article
          key={device.id}
          className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4"
        >
          <div>
            <h3 className="text-base font-semibold text-white">{device.name}</h3>
            <p className={`mt-1 text-sm font-medium ${device.tone}`}>
              {device.statusLabel}
            </p>
            <p className="mt-1 text-xs text-white/45">IP: {device.ipAddress}</p>
          </div>
          <span className="text-xs uppercase tracking-[0.28em] text-white/30">
            {device.state}
          </span>
        </article>
      ))}
    </div>
  );
}
