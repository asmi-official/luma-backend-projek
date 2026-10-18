import logger from '../config/logger';
import { promoStatusWorker } from './promos/worker';

export interface WorkerDefinition {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

// daftar worker yang akan dijalankan. tambah worker baru cukup di sini,
// pola yang sama seperti router/indext.ts
const workers: WorkerDefinition[] = [
  promoStatusWorker,
];

const timers: NodeJS.Timeout[] = [];

// error satu worker tidak boleh menjatuhkan server atau menghentikan worker lain,
// jadi semua error ditangkap & dicatat di sini
const safeRun = async (worker: WorkerDefinition): Promise<void> => {
  try {
    await worker.run();
  } catch (err) {
    logger.error(
      `[worker:${worker.name}] gagal: ${err instanceof Error ? err.message : String(err)}`
    );
  }
};

// dipanggil dari src/index.ts setelah server siap.
// tiap worker langsung jalan sekali, lalu diulang sesuai intervalnya
export const startWorkers = (): void => {
  if (workers.length === 0) return;

  for (const worker of workers) {
    void safeRun(worker);

    const timer = setInterval(() => {
      void safeRun(worker);
    }, worker.intervalMs);

    // unref supaya timer tidak menahan proses tetap hidup saat server dimatikan
    timer.unref();
    timers.push(timer);
  }

  logger.info(`Worker aktif: ${workers.map((w) => w.name).join(', ')}`);
};

export const stopWorkers = (): void => {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
};
