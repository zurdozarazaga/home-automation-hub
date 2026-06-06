import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AutomationCard } from "@/components/dashboard/automation-card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DeviceList } from "@/components/dashboard/device-list";
import { FutureReadyPanel } from "@/components/dashboard/future-ready-panel";
import { SensorCard } from "@/components/dashboard/sensor-card";
import { ZoneControlCard } from "@/components/dashboard/zone-control-card";
import { getDashboardData } from "@/lib/dashboard-api";

export default async function Home() {
  const dashboardData = await getDashboardData();

  return (
    <main className="min-h-screen px-4 py-4 text-white sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <DashboardHeader
          location={dashboardData.location}
          temperature={dashboardData.temperature}
          forecast={dashboardData.forecast}
        />

        <section className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid gap-4 sm:gap-5">
            <DashboardSection eyebrow="Zonas" title="Control rápido">
              <div className="grid gap-4">
                {dashboardData.zones.map((zone) => (
                  <ZoneControlCard key={zone.name} {...zone} />
                ))}
              </div>
            </DashboardSection>

            <DashboardSection eyebrow="Dispositivos" title="ESP32 disponibles">
              <DeviceList devices={dashboardData.devices} />
            </DashboardSection>
          </div>

          <div className="grid gap-4 sm:gap-5">
            <DashboardSection eyebrow="Sensores" title="Clima y lectura">
              <SensorCard
                label="Temperatura"
                value={dashboardData.sensorTemperature}
                badge="Sensor Card"
              />
            </DashboardSection>

            <DashboardSection eyebrow="Automatizaciones" title="Riego Automático">
              <AutomationCard
                title="Riego Automático"
                schedule={dashboardData.irrigationSchedule}
                status={dashboardData.irrigationStatus}
              />
            </DashboardSection>

            <DashboardSection eyebrow="Actividad reciente" title="Últimos eventos">
              <ActivityFeed items={dashboardData.activity} />
            </DashboardSection>
          </div>
        </section>

        <FutureReadyPanel
          title="Zonas, dispositivos y escenas"
          places={dashboardData.places}
        />
      </div>
    </main>
  );
}
