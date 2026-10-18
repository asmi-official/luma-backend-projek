import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import logger from "../config/logger";

dotenv.config();

// koneksi ke PostgreSQL menggunakan config dari .env
const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "",
  username: process.env.DB_USER ?? "",
  password: process.env.DB_PASSWORD ?? "",
  logging: false,
});

// model yang punya relasi mendeklarasikannya lewat static associate(),
// dipanggil loader setelah semua model ter-import
interface ModelWithAssociate {
  name: string;
  associate?: (models: Record<string, unknown>) => void;
}

// auto scan semua folder di src/services/, jika ada file model.ts maka langsung di-import
// sehingga tidak perlu daftar model secara manual setiap kali ada model baru
const importModels = async (): Promise<void> => {
  const servicesDir = path.join(__dirname, "..", "services");
  const folders = fs.readdirSync(servicesDir);

  const models: Record<string, ModelWithAssociate> = {};

  for (const folder of folders) {
    const modelPath = path.join(servicesDir, folder, "model.ts");
    if (fs.existsSync(modelPath)) {
      const imported = (await import(modelPath)) as {
        default?: ModelWithAssociate;
      };
      const model = imported.default;

      if (model?.name) models[model.name] = model;
    }
  }

  // asosiasi dijalankan belakangan supaya semua model dijamin sudah termuat,
  // jadi tidak bergantung urutan import dan tidak perlu import silang antar model
  for (const model of Object.values(models)) {
    model.associate?.(models);
  }
};

// sync({ alter: true }) HANYA untuk development.
// di luar itu perubahan skema wajib lewat migration (npm run migrate), karena:
// - alter bisa menghapus kolom yang hilang dari model → data hilang permanen
// - kalau alter gagal, server ikut mati (lihat startServer di bawah)
// - tidak ada jejak & tidak bisa di-rollback
// paksa nyalakan di environment lain dengan DB_SYNC_ALTER=true, tapi sadari risikonya
const shouldSyncAlter = (): boolean => {
  if (process.env.DB_SYNC_ALTER === "true") return true;
  if (process.env.DB_SYNC_ALTER === "false") return false;

  return (process.env.NODE_ENV ?? "development") === "development";
};

// autentikasi koneksi, import semua model, lalu sync tabel (khusus development)
export const connectDB = async (): Promise<void> => {
  await sequelize.authenticate();
  logger.info("Database connected successfully");

  await importModels();

  if (shouldSyncAlter()) {
    await sequelize.sync({ alter: true });
    logger.info("Database synced successfully (development)");
    return;
  }

  logger.info(
    "Skip auto-sync, perubahan skema lewat migration (npm run migrate)",
  );
};

// jalankan connectDB lalu start express server, jika gagal proses dihentikan.
// onReady dipanggil setelah server siap — dipakai untuk menyalakan worker,
// lewat callback supaya layer database tidak perlu tahu soal worker
export const startServer = (
  app: import("express").Application,
  port: string | number,
  onReady?: () => void,
): void => {
  connectDB()
    .then(() => {
      app.listen(port, () => {
        logger.info(`Server running on http://localhost:${port}`);
        onReady?.();
      });
    })
    .catch((err: unknown) => {
      logger.error(
        "Failed to start server",
        err instanceof Error ? err : new Error(String(err)),
      );
      process.exit(1);
    });
};

export default sequelize;
