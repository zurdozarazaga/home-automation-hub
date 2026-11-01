type DeviceListItem = Readonly<{
  id: string;
  name: string;
  tone: string;
  statusLabel: string;
  ipAddress: string;
  /** Relative Spanish sync age, e.g. "visto hace 12 s" / "sin sincronizar". */
  lastSeenLabel: string;
  capabilities: readonly string[];
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
          <p className="mt-2 text-xs text-white/45">
            Registrá la placa con{" "}
            <code className="rounded-lg bg-black/40 px-2 py-1 font-mono text-[11px] text-cyan-200">
              npm run devices:register
            </code>{" "}
            y volvé a cargar el dashboard.
          </p>
        </article>
      ) : null}
      {devices.map((device) => (
        <article
          key={device.id}
          className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">{device.name}</h3>
              <p className="mt-1 text-xs text-white/45">IP: {device.ipAddress}</p>
              <p className="mt-1 text-xs text-white/45">{device.lastSeenLabel}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold ${device.tone}`}
            >
              {device.statusLabel}
            </span>
          </div>
          {device.capabilities.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {device.capabilities.map((capability) => (
                <li
                  key={capability}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-200"
                >
                  {capability}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}
