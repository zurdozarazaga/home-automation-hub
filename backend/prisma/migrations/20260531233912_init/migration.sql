-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "port" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relays" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "gpio_pin" INTEGER NOT NULL,
    "state" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "target" VARCHAR(40) NOT NULL,
    "endpoint" VARCHAR(120) NOT NULL,
    "result" VARCHAR(20) NOT NULL,
    "http_status_code" INTEGER NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_name_key" ON "devices"("name");

-- CreateIndex
CREATE UNIQUE INDEX "devices_ip_address_port_key" ON "devices"("ip_address", "port");

-- CreateIndex
CREATE INDEX "action_logs_device_id_created_at_idx" ON "action_logs"("device_id", "created_at");

-- AddForeignKey
ALTER TABLE "relays" ADD CONSTRAINT "relays_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
