export type ZoneActionError = Readonly<{
  message: string;
  sessionExpired: boolean;
}>;

/** Maps backend/proxy status codes to the copy shown on a zone card. */
export function mapActionError(status: number): ZoneActionError {
  if (status === 401) {
    return {
      message: "Sesión vencida. Iniciá sesión de nuevo.",
      sessionExpired: true,
    };
  }

  if (status === 502) {
    return {
      message: "No se pudo alcanzar la placa.",
      sessionExpired: false,
    };
  }

  return {
    message: "No se pudo ejecutar la acción.",
    sessionExpired: false,
  };
}
