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

// auto scan semua folder di src/services/, jika ada file model.ts maka langsung di-import
// sehingga tidak perlu daftar model secara manual setiap kali ada model baru
const importModels = async (): Promise<void> => {
  const servicesDir = path.join(__dirname, "..", "services");
  const folders = fs.readdirSync(servicesDir);

  for (const folder of folders) {
    const modelPath = path.join(servicesDir, folder, "model.ts");
    if (fs.existsSync(modelPath)) {
      await import(modelPath);
    }
  }
};

// autentikasi koneksi, import semua model, lalu sync tabel ke database
// alter:true = update struktur tabel jika ada perubahan tanpa hapus data
export const connectDB = async (): Promise<void> => {
  await sequelize.authenticate();
  logger.info("Database connected successfully");

  await importModels();
  await sequelize.sync({ alter: true });
};

// jalankan connectDB lalu start express server, jika gagal proses dihentikan
export const startServer = (
  app: import("express").Application,
  port: string | number,
): void => {
  connectDB()
    .then(() => {
      app.listen(port, () => {
        logger.info(`Server running on http://localhost:${port}`);
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
