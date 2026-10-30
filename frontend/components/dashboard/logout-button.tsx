"use client";

import { useState } from "react";

export function LogoutButton() {
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleLogout() {
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("logout failed");
      }

      window.location.assign("/login");
    } catch {
      setError("No se pudo cerrar la sesión");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isSending}
        onClick={() => void handleLogout()}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:border-white/30 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? "Saliendo..." : "Salir"}
      </button>
      {error ? <span className="text-[10px] text-rose-300">{error}</span> : null}
    </div>
  );
}
