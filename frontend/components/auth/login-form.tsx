"use client";

import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401) {
        setError("Credenciales inválidas");
        return;
      }

      if (response.status === 503) {
        setError("Login deshabilitado: falta AUTH_PASSWORD en el backend");
        return;
      }

      if (!response.ok) {
        setError("No se pudo iniciar sesión. Intentá de nuevo.");
        return;
      }

      window.location.assign("/");
    } catch {
      setError("No se pudo contactar con el backend");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium text-white/70">
        Usuario
        <input
          type="text"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-base font-normal text-white outline-none transition focus:border-cyan-300/50 focus:bg-black/40"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-white/70">
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-base font-normal text-white outline-none transition focus:border-cyan-300/50 focus:bg-black/40"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSending}
        className="h-12 rounded-2xl border border-cyan-300/25 bg-cyan-400/15 text-sm font-semibold text-cyan-100 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
