import type { ReactNode } from "react";

type DashboardSectionProps = Readonly<{
  eyebrow: string;
  title: string;
  children: ReactNode;
}>;

export function DashboardSection({
  eyebrow,
  title,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/40">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
