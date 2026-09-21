// The device poller must never run during e2e: it would hit real networks
// and race the specs. 0 disables it (see DevicePollerService.onModuleInit).
process.env.DEVICE_POLL_INTERVAL_MS = '0';
