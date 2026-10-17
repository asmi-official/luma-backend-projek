import type { Migration } from '../src/databases/migrator';

/**
 * Baseline: merekam struktur database yang sudah terbentuk lewat sync({ alter: true })
 * sampai hari ini, supaya database baru bisa dibangun tanpa menebak-nebak.
 *
 * Dibuat idempoten (IF NOT EXISTS / DO $$ ... $$) karena di database yang sudah
 * berjalan, objek-objek ini umumnya sudah ada.
 *
 * Termasuk 4 langkah yang sebelumnya dijalankan manual lewat psql dan tidak
 * tercatat di mana pun:
 *   1. index unik role_menu_permissions dengan nama pendek (nama auto > 63 char)
 *   2. companies.company_code + backfill + NOT NULL
 *   3. naming_series.type_naming_series & owner_id
 *   4. products.promo_id → FK + index ke promos
 */
export const up: Migration = async ({ context }) => {
  const { sequelize } = context;

  await sequelize.query(`
    -- 1. index lama bernama panjang (terpotong 63 char postgres) dibuang,
    --    diganti nama pendek supaya sync tidak membuatnya berulang kali
    DROP INDEX IF EXISTS role_menu_permissions_owner_id_flex_param_role_id_flex_param_me;

    CREATE UNIQUE INDEX IF NOT EXISTS role_menu_permissions_owner_role_menu_unique
      ON role_menu_permissions (owner_id, flex_param_role_id, flex_param_menu_id)
      WHERE deleted_at IS NULL;

    -- 2. company_code: kode 4 karakter untuk nomor dokumen (SKU, invoice).
    --    ditambah nullable dulu, diisi acak, baru dijadikan NOT NULL
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_code VARCHAR(4);

    UPDATE companies
    SET company_code = (
      SELECT string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), ''
      )
      FROM generate_series(1, 4)
    )
    WHERE company_code IS NULL;

    DO $$
    BEGIN
      ALTER TABLE companies ALTER COLUMN company_code SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END $$;

    -- 3. naming_series: counter dipisah per modul (PRODUCT/INVOICE) dan per owner
    ALTER TABLE naming_series ADD COLUMN IF NOT EXISTS type_naming_series VARCHAR(50);
    ALTER TABLE naming_series ADD COLUMN IF NOT EXISTS owner_id UUID;

    -- 4. relasi products → promos.
    --    dibuat manual karena sync({ alter: true }) gagal membuat FK di postgres
    --    (syntax error at or near "REFERENCES"), makanya asosiasi sequelize
    --    memakai constraints: false
    CREATE INDEX IF NOT EXISTS products_promo_id_idx ON products (promo_id);

    DO $$
    BEGIN
      ALTER TABLE products
        ADD CONSTRAINT products_promo_id_fkey
        FOREIGN KEY (promo_id) REFERENCES promos (id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
};

export const down: Migration = async ({ context }) => {
  const { sequelize } = context;

  // hanya membatalkan perubahan yang aman dibalik.
  // company_code TIDAK dihapus di sini supaya nomor dokumen yang sudah
  // terlanjur dibuat tidak kehilangan acuannya
  await sequelize.query(`
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_promo_id_fkey;
    DROP INDEX IF EXISTS products_promo_id_idx;
    DROP INDEX IF EXISTS role_menu_permissions_owner_role_menu_unique;
  `);
};
