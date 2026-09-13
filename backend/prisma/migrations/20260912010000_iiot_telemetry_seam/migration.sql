-- CreateTable: TelemetryReading time-series store; rows cascade on device delete
CREATE TABLE "telemetry_readings" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "metric" VARCHAR(60) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" VARCHAR(20),
    "source" VARCHAR(60),

    CONSTRAINT "telemetry_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telemetry_readings_device_id_ts_idx" ON "telemetry_readings"("device_id", "ts");

-- CreateIndex
CREATE INDEX "telemetry_readings_device_id_metric_ts_idx" ON "telemetry_readings"("device_id", "metric", "ts");

-- AddForeignKey
ALTER TABLE "telemetry_readings" ADD CONSTRAINT "telemetry_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
