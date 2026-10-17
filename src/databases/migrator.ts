import path from 'path';
import { Umzug, SequelizeStorage } from 'umzug';
import type { QueryInterface } from 'sequelize';
import sequelize from './index';

// tiap file migration menerima context ini
export interface MigrationContext {
  queryInterface: QueryInterface;
  sequelize: typeof sequelize;
}

// riwayat migration yang sudah jalan disimpan di tabel `migrations_meta`,
// jadi file yang sama tidak pernah dijalankan dua kali
export const migrator = new Umzug<MigrationContext>({
  migrations: {
    glob: ['migrations/*.ts', { cwd: path.join(__dirname, '..', '..') }],
  },
  context: {
    queryInterface: sequelize.getQueryInterface(),
    sequelize,
  },
  storage: new SequelizeStorage({
    sequelize,
    modelName: 'migrations_meta',
  }),
  logger: console,
});

export type Migration = typeof migrator._types.migration;
