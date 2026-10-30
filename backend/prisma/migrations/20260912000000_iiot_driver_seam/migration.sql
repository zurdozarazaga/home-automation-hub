-- AlterTable: Device gains driver seam columns; ip/port become nullable (NULLs exempt from unique)
ALTER TABLE "devices" ADD COLUMN "driver" VARCHAR(40) NOT NULL DEFAULT 'esp32';

ALTER TABLE "devices" ADD COLUMN "capabilities" TEXT[] NOT NULL DEFAULT ARRAY['riego', 'luces'];

ALTER TABLE "devices" ADD COLUMN "mqtt_topic" VARCHAR(255);

ALTER TABLE "devices" ALTER COLUMN "ip_address" DROP NOT NULL;

ALTER TABLE "devices" ALTER COLUMN "port" DROP NOT NULL;
