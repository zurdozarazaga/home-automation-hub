"use client";

import Link from "next/link";
import { useState } from "react";
import { mapActionError } from "@/components/dashboard/action-error";

type ZoneControlCardProps = Readonly<{
  icon: string;
  name: string;
  status: string;
  statusTone: string;
  accent: string;
  deviceId?: string;
  // Widened: the backend capability-checks driver-declared targets at runtime.
  actionTarget: string;
}>;

type ZoneAction = "turn_on" | "turn_off";

export function ZoneControlCard({
  icon,
  name,
  status,
  statusTone,
  accent,
  deviceId,
  actionTarget,
}: ZoneControlCardProps) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentStatusTone, setCurrentStatusTone] = useState(statusTone);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const nextTone = (nextStatus: string): string =>
    nextStatus === "ON"
      ? "text-emerald-200 bg-emerald-500/15 border-emerald-500/20"
      : "text-rose-200 bg-rose-500/15 border-rose-500/20";

  async function handleAction(action: ZoneAction) {
    if (!deviceId) {
      setMessage("Dispositivo no disponible");
      return;
    }

    const previousStatus = currentStatus;
    const previousTone = currentStatusTone;
    const optimisticStatus = action === "turn_on" ? "ON" : "OFF";

    setCurrentStatus(optimisticStatus);
    setCurrentStatusTone(nextTone(optimisticStatus));
    setIsSending(true);
    setSessionExpired(false);
    setMessage(action === "turn_on" ? "Enviando encendido..." : "Enviando apagado...");

    try {
      const response = await fetch(`/api/devices/${deviceId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, target: actionTarget }),
      });

      if (!response.ok) {
        const error = mapActionError(response.status);
        setCurrentStatus(previousStatus);
        setCurrentStatusTone(previousTone);
        setMessage(error.message);
        setSessionExpired(error.sessionExpired);
        return;
      }

      const updatedStatus = action === "turn_on" ? "ON" : "OFF";
      setCurrentStatus(updatedStatus);
      setCurrentStatusTone(nextTone(updatedStatus));
      setMessage(
        action === "turn_on"
          ? "Encendido enviado correctamente"
          : "Apagado enviado correctamente",
      );
    } catch {
      setCurrentStatus(previousStatus);
      setCurrentStatusTone(previousTone);
      setMessage("No se pudo contactar con la API");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f172a]/70 p-4 sm:p-5">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden="true">{icon}</span>
              <span>{name}</span>
            </div>
            <p className="mt-1 text-sm text-white/45">Estado</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${currentStatusTone}`}
          >
            {currentStatus}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSending}
            onClick={() => void handleAction("turn_on")}
            className="h-12 rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Encender
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() => void handleAction("turn_off")}
            className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apagar
          </button>
        </div>
        <p className="text-xs text-white/55">
          {message ?? `Target ${actionTarget}`}
          {sessionExpired ? (
            <Link
              href="/login"
              className="ml-2 font-semibold text-cyan-200 underline underline-offset-2"
            >
              Ir a /login
            </Link>
          ) : null}
        </p>
      </div>
    </article>
  );
}
