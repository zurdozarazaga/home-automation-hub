/*
  Warnings:

  - A unique constraint covering the columns `[mac_address]` on the table `devices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "mac_address" VARCHAR(17);

-- CreateTable
CREATE TABLE "device_commands" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "target" VARCHAR(40) NOT NULL,
    "endpoint" VARCHAR(120),
    "status" VARCHAR(20) NOT NULL,
    "result" VARCHAR(20),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMP(3),
    "acked_at" TIMESTAMP(3),

    CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_commands_device_id_status_idx" ON "device_commands"("device_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "devices_mac_address_key" ON "devices"("mac_address");

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
