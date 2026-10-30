import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SESSION_COOKIE, isSessionRejected } from "@/lib/session";

export default async function LoginPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  // Cheap path for a valid session: skip the form. An expired token falls
  // through (401) so the form renders without a redirect loop.
  if (token && !(await isSessionRejected(token))) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
          Home Automation Hub
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Ingresá con el usuario del backend para ver el dashboard real.
        </p>

        {token ? (
          <p className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
            Tu sesión venció. Volvé a ingresar.
          </p>
        ) : null}

        <LoginForm />
      </section>
    </main>
  );
}
