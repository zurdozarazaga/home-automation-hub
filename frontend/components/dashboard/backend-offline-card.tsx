import Link from "next/link";

export function BackendOfflineCard() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-6 text-center backdrop-blur-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-200/70">
          Sin conexión
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          No se pudo contactar con el backend
        </h1>
        <p className="mt-3 text-sm text-white/60">
          El dashboard necesita la API para mostrar dispositivos y sensores.
          Verificá que el backend esté corriendo y que API_BASE_URL apunte al
          servicio correcto.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          Reintentar
        </Link>
      </section>
    </main>
  );
}
