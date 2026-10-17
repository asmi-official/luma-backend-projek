import type { Response } from 'express';

interface ApiResponseOptions {
  status: 'success' | 'fail' | 'error';
  message: string;
  data?: unknown;
  errors?: Record<string, string>[] | null;
}

export const apiResponse = (
  res: Response,
  statusCode: number,
  options: ApiResponseOptions
) => {
  const body: Record<string, unknown> = {
    status: options.status,
    message: options.message,
  };

  if (options.data !== undefined) body.data = options.data;
  if (options.errors) body.errors = options.errors;

  return res.status(statusCode).json(body);
};

export const sendSuccess = (res: Response, data: unknown, message = 'Berhasil', statusCode = 200) =>
  apiResponse(res, statusCode, { status: 'success', message, data });

export const sendCreated = (res: Response, data: unknown, message = 'Data berhasil dibuat') =>
  apiResponse(res, 201, { status: 'success', message, data });

export const sendBadRequest = (res: Response, message = 'Request tidak valid', errors?: Record<string, string>[]) =>
  apiResponse(res, 400, { status: 'fail', message, errors });

export const sendUnauthorized = (res: Response, message = 'Tidak terautentikasi', errors?: Record<string, string>[]) =>
  apiResponse(res, 401, { status: 'fail', message, errors });

export const sendForbidden = (res: Response, message = 'Tidak memiliki akses', errors?: Record<string, string>[]) =>
  apiResponse(res, 403, { status: 'fail', message, errors });

export const sendNotFound = (res: Response, message = 'Data tidak ditemukan', errors?: Record<string, string>[]) =>
  apiResponse(res, 404, { status: 'fail', message, errors });

export const sendConflict = (res: Response, message = 'Data sudah ada') =>
  apiResponse(res, 409, { status: 'fail', message });

export const sendServerError = (res: Response, message = 'Terjadi kesalahan pada server') =>
  apiResponse(res, 500, { status: 'error', message });

export interface PaginationParams {
  page: number;
  limit: number;
}

export const parsePagination = (query: Record<string, unknown>): PaginationParams => {
  const page = Math.max(1, parseInt(query['page'] as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query['limit'] as string) || 10));
  return { page, limit };
};

// extra: field tambahan opsional yang ditaruh tepat setelah message,
// dipakai misalnya untuk ringkasan jumlah data aktif/tidak aktif
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  params: PaginationParams,
  message = 'Berhasil mengambil data',
  extra?: Record<string, unknown>
) => {
  return res.status(200).json({
    status: 'success',
    message,
    ...extra,
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      total_pages: Math.ceil(total / params.limit),
    },
  });
};
