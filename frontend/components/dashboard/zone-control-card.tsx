"use client";

import Link from "next/link";
import { useState } from "react";
import { mapActionError } from "@/components/dashboard/action-error";

type ZoneControlCardProps = Readonly<{
  icon: string;
  name: string;
  accent: string;
  deviceId?: string;
  // Widened: the backend capability-checks driver-declared targets at runtime.
  actionTarget: string;
}>;

type ZoneAction = "turn_on" | "turn_off";

/** The backend reports the live relay state nowhere, so it stays unknown. */
const UNKNOWN_STATUS = "—";
const UNKNOWN_TONE = "text-white/60 bg-white/5 border-white/15";

/** Irrigation always carries an auto-off, so a turn_on cannot leave water open. */
const IRRIGATION_DURATION_MINUTES = 15;

function statusTone(status: string): string {
  if (status === "ON") {
    return "text-emerald-200 bg-emerald-500/15 border-emerald-500/20";
  }

  if (status === "OFF") {
    return "text-rose-200 bg-rose-500/15 border-rose-500/20";
  }

  return UNKNOWN_TONE;
}

export function ZoneControlCard({
  icon,
  name,
  accent,
  deviceId,
  actionTarget,
}: ZoneControlCardProps) {
  const [currentStatus, setCurrentStatus] = useState(UNKNOWN_STATUS);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isDisabled = !deviceId;

  async function handleAction(action: ZoneAction) {
    if (!deviceId) {
      return;
    }

    const previousStatus = currentStatus;
    const optimisticStatus = action === "turn_on" ? "ON" : "OFF";
    const needsDuration =
      action === "turn_on" && actionTarget === "riego";

    setCurrentStatus(optimisticStatus);
    setIsSending(true);
    setSessionExpired(false);
    setMessage(
      action === "turn_on" ? "Enviando encendido..." : "Enviando apagado...",
    );

    try {
      const response = await fetch(`/api/devices/${deviceId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          target: actionTarget,
          ...(needsDuration
            ? { durationMinutes: IRRIGATION_DURATION_MINUTES }
            : {}),
        }),
      });

      if (!response.ok) {
        const error = mapActionError(response.status);
        setCurrentStatus(previousStatus);
        setMessage(error.message);
        setSessionExpired(error.sessionExpired);
        return;
      }

      // 202 means the command is queued for the board; only 200/201 prove it
      // already ran.
      setMessage(
        response.status === 202
          ? "En cola: la placa lo aplica en segundos"
          : "Ejecutado en la placa",
      );
    } catch {
      setCurrentStatus(previousStatus);
      setMessage("No se pudo contactar con la API");
    } finally {
      setIsSending(false);
    }
  }

  const hint = isDisabled
    ? `Ningún dispositivo declara la capacidad «${actionTarget}».`
    : message;

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
            {/* The backend exposes no live relay state yet (Etapa 2), so this
                is the last command we sent, never a claim about the relay. */}
            <p className="mt-1 text-sm text-white/45">Último comando</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${statusTone(currentStatus)}`}
          >
            {currentStatus}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSending || isDisabled}
            onClick={() => void handleAction("turn_on")}
            className="h-12 rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Encender
          </button>
          <button
            type="button"
            disabled={isSending || isDisabled}
            onClick={() => void handleAction("turn_off")}
            className="h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apagar
          </button>
        </div>
        {hint ? (
          <p className="text-xs text-white/55">
            {hint}
            {sessionExpired ? (
              <Link
                href="/login"
                className="ml-2 font-semibold text-cyan-200 underline underline-offset-2"
              >
                Ir a /login
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}
