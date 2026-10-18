import logger from '../../config/logger';
import { syncPromoStatusService } from '../../services/promos/service';
import type { WorkerDefinition } from '../index';

// jalan tiap 5 menit: pergantian status paling telat 5 menit dari jam promo.
// query-nya ringan karena sudah difilter start_date/end_date, jadi hanya
// membaca promo yang periodenya mencakup hari ini
const INTERVAL_MS = 5 * 60 * 1000;

const run = async (): Promise<void> => {
  const result = await syncPromoStatusService('system');

  // hanya dicatat kalau ada yang berubah, supaya log tidak penuh baris kosong
  if (result.activated > 0 || result.paused > 0 || result.finished > 0) {
    logger.info(
      `[worker:promo-status] ${result.activated} diaktifkan, ${result.paused} ditunda, ${result.finished} diselesaikan (${result.checked_at} ${result.checked_time})`
    );
  }
};

export const promoStatusWorker: WorkerDefinition = {
  name: 'promo-status',
  intervalMs: INTERVAL_MS,
  run,
};

export default promoStatusWorker;
