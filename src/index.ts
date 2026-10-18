import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { startServer } from './databases';
import { startWorkers } from './worker';
import httpLogger from './middlewares/http-logger';
import router from './router/indext';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

// folder & nama route disamakan dengan yang dipakai saat membangun file_url di documents service,
// supaya URL hasil upload benar-benar bisa diakses
const UPLOAD_FOLDER = process.env.PATH_FILE_UPLOAD?.trim() ?? 'files';

app.use(cors());
app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// sajikan file hasil upload (foto produk, dokumen, dll) sebagai static file
app.use(`/${UPLOAD_FOLDER}`, express.static(path.resolve(UPLOAD_FOLDER)));

app.get('/', (_req, res) => {
  res.json({ message: 'Server is running' });
});

app.use('/api', router);

// worker dinyalakan setelah database & server siap
startServer(app, PORT, startWorkers);

export default app;
