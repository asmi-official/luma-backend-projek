import dotenv from 'dotenv';
import { migrator } from './migrator';

dotenv.config();

// CLI migration:
//   npm run migrate          → jalankan semua migration yang belum jalan
//   npm run migrate:down     → batalkan 1 migration terakhir
//   npm run migrate:status   → lihat mana yang sudah & belum jalan
const run = async (): Promise<void> => {
  const command = process.argv[2] ?? 'up';

  if (command === 'up') {
    const executed = await migrator.up();
    console.log(
      executed.length > 0
        ? `${executed.length} migration dijalankan`
        : 'Tidak ada migration baru'
    );
    return;
  }

  if (command === 'down') {
    const reverted = await migrator.down();
    console.log(
      reverted.length > 0
        ? `Dibatalkan: ${reverted.map((m) => m.name).join(', ')}`
        : 'Tidak ada migration yang bisa dibatalkan'
    );
    return;
  }

  if (command === 'status') {
    const executed = await migrator.executed();
    const pending = await migrator.pending();

    console.log('\nSudah jalan:');
    console.log(executed.length ? executed.map((m) => `  ✓ ${m.name}`).join('\n') : '  (belum ada)');

    console.log('\nBelum jalan:');
    console.log(pending.length ? pending.map((m) => `  • ${m.name}`).join('\n') : '  (tidak ada)');
    console.log('');
    return;
  }

  throw new Error(`Perintah tidak dikenal: ${command}. Gunakan up | down | status`);
};

run()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Migration gagal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
