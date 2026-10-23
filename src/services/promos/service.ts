import { Transaction, WhereOptions, OrderItem, Op } from "sequelize";
import {
  createPromo,
  findAllPromos,
  findPromoById,
  findPromoByName,
  countPromosByStatus,
  findActivePromos,
  findPromosInPeriod,
  findPromosOutsidePeriod,
  bulkUpdatePromoStatus,
  updatePromo,
  toggleActivePromo,
  deletePromo,
} from "./repository";
import { findUserById } from "../users/repository";
import { syncProductPromoService } from "../products/service";
import {
  findProductsByPromoId,
  bulkUpdateProductPromo,
} from "../products/repository";
import { OWNER_ROLE } from "../users/model";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../utils/app-error";
import type { PromoStatus } from "./model";
import { CreatePromoInput, UpdatePromoInput } from "./types";

const resolveOwnerId = async (
  requester: { user_id: string; role: string },
  t: Transaction,
): Promise<string> => {
  if (requester.role === OWNER_ROLE) return requester.user_id;

  const requesterUser = await findUserById(requester.user_id, t);
  if (!requesterUser) throw new NotFoundError("User tidak ditemukan");

  return requesterUser.header_id ?? requesterUser.id;
};

// terima 'HH:mm' maupun 'HH:mm:ss', selalu disimpan sebagai 'HH:mm:ss'.
// kosong / null → null, artinya promo berlaku kapan saja sepanjang hari
const normalizeTime = (value: string | null | undefined): string | null => {
  const time = value?.trim();
  if (!time) return null;

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    throw new BadRequestError("Validasi gagal", [
      { field: "time", message: "Format jam harus HH:mm atau HH:mm:ss" },
    ]);
  }

  return time.length === 5 ? `${time}:00` : time;
};

// status default dihitung dari periode promo kalau client tidak menentukan sendiri
const resolveStatusFromPeriod = (
  start_date: string,
  end_date: string,
): PromoStatus => {
  const today = new Date().toISOString().split("T")[0] as string;

  if (end_date < today) return "Selesai";
  if (start_date > today) return "Terjadwal";
  return "Aktif";
};

// validasi spesifik per tipe diskon
const validateDiscountInput = (
  input: CreatePromoInput | UpdatePromoInput,
  isCreate: boolean,
) => {
  const discountType = input.discount_type;

  if (isCreate && !discountType) {
    throw new BadRequestError("Validasi gagal", [
      { field: "discount_type", message: "Tipe diskon wajib diisi" },
    ]);
  }

  if (discountType === "percentage") {
    if (
      isCreate &&
      (input.discount_value === undefined || input.discount_value === null)
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Nilai diskon persentase wajib diisi",
        },
      ]);
    }
    if (
      input.discount_value !== undefined &&
      Number(input.discount_value) > 100
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Diskon persentase tidak boleh lebih dari 100%",
        },
      ]);
    }
    if (
      input.discount_value !== undefined &&
      Number(input.discount_value) < 0
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Diskon persentase tidak boleh negatif",
        },
      ]);
    }
  }

  if (discountType === "fixed") {
    if (
      isCreate &&
      (input.discount_value === undefined || input.discount_value === null)
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Nilai diskon nominal wajib diisi",
        },
      ]);
    }
    if (
      input.discount_value !== undefined &&
      Number(input.discount_value) < 0
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Diskon nominal tidak boleh negatif",
        },
      ]);
    }
  }

  // harga spesial disimpan di discount_value, tidak ada kolom terpisah
  if (discountType === "special_price") {
    if (
      isCreate &&
      (input.discount_value === undefined || input.discount_value === null)
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Harga spesial wajib diisi untuk tipe harga spesial",
        },
      ]);
    }
    if (
      input.discount_value !== undefined &&
      Number(input.discount_value) < 0
    ) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "discount_value",
          message: "Harga spesial tidak boleh negatif",
        },
      ]);
    }
  }
};

export const createPromoService = async (
  input: CreatePromoInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  if (!input.name) {
    throw new BadRequestError("Validasi gagal", [
      { field: "name", message: "Nama promo wajib diisi" },
    ]);
  }

  if (!input.start_date) {
    throw new BadRequestError("Validasi gagal", [
      { field: "start_date", message: "Tanggal mulai wajib diisi" },
    ]);
  }

  if (!input.end_date) {
    throw new BadRequestError("Validasi gagal", [
      { field: "end_date", message: "Tanggal selesai wajib diisi" },
    ]);
  }

  // tanggal dibandingkan sebagai string: format 'YYYY-MM-DD' sudah urut
  // secara leksikografis, jadi tidak perlu Date yang rawan geser timezone
  const today = new Date().toISOString().split("T")[0] as string;

  if (input.start_date < today) {
    throw new BadRequestError("Validasi gagal", [
      {
        field: "start_date",
        message: "Tanggal mulai tidak boleh sebelum hari ini",
      },
    ]);
  }

  if (input.end_date < input.start_date) {
    throw new BadRequestError("Validasi gagal", [
      {
        field: "end_date",
        message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
      },
    ]);
  }

  if (!Array.isArray(input.products) || input.products.length === 0) {
    throw new BadRequestError("Validasi gagal", [
      { field: "products", message: "Produk promo wajib diisi minimal 1" },
    ]);
  }

  // validasi per tipe diskon
  validateDiscountInput(input, true);

  const owner_id = await resolveOwnerId(requester, t);

  // cek nama duplikat
  const duplicateName = await findPromoByName(input.name, owner_id, t);
  if (duplicateName) {
    throw new ConflictError("Nama promo sudah digunakan", [
      { field: "name", message: "Nama promo sudah digunakan" },
    ]);
  }

  const id = crypto.randomUUID();
  const start_time = normalizeTime(input.start_time);
  const end_time = normalizeTime(input.end_time);

  // discount_value menampung ketiga tipe:
  // percentage → nilai %, fixed → nominal potongan, special_price → harga tetap
  await createPromo(
    {
      id,
      name: input.name,
      description: input.description ?? null,
      discount_type: input.discount_type,
      discount_value: String(Number(input.discount_value ?? 0)),
      discount_text: input.discount_text ?? null,
      discount_description: input.discount_description ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      start_time,
      end_time,
      // status dihitung dari periode kalau client tidak menentukan sendiri
      status:
        input.status ??
        resolveStatusFromPeriod(input.start_date, input.end_date),
      user_id: requester.user_id,
      owner_id,
      created_by: requester.email,
      updated_by: requester.email,
    },
    t,
  );

  // pasang promo ini ke produk-produk yang dipilih
  await syncProductPromoService(id, input.products, requester, t);

  // dibaca ulang supaya produknya ikut lewat include
  return findPromoById(id, t);
};

export const getAllPromosService = async (
  requester: { user_id: string; role: string },
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t: Transaction,
  search?: string,
) => {
  const owner_id = await resolveOwnerId(requester, t);

  // search dicari ke name (iLike = tidak peduli huruf besar/kecil).
  // digabung sebagai [Op.and] supaya tidak menimpa kondisi dari `filter`
  const keyword = search?.trim();
  const effectiveWhere = {
    ...where,
    owner_id,
    ...(keyword && {
      [Op.and]: [{ name: { [Op.iLike]: `%${keyword}%` } }],
    }),
  };

  // produk ikut lewat include di repository, jadi tidak perlu digabung manual
  const { rows, count } = await findAllPromos(
    effectiveWhere,
    order,
    page,
    limit,
    t,
  );

  // ringkasan per status dihitung tanpa kondisi `status` dari filter user,
  // supaya saat user memfilter status=Aktif angka status lain tidak jadi 0
  const { status: _status, ...whereWithoutStatus } = effectiveWhere as Record<
    string,
    unknown
  >;
  const summary = await countPromosByStatus(
    whereWithoutStatus as WhereOptions,
    t,
  );

  return { rows, count, ...summary };
};

export const getPromoByIdService = async (
  id: string,
  requester: { user_id: string; role: string },
  t: Transaction,
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError("Promo tidak ditemukan");
  }

  // produk ikut lewat include di findPromoById
  return promo;
};

export const getActivePromosService = async (
  requester: { user_id: string; role: string },
  t: Transaction,
) => {
  const owner_id = await resolveOwnerId(requester, t);

  // produk ikut lewat include di findActivePromos
  return findActivePromos(owner_id, t);
};

export const updatePromoService = async (
  id: string,
  input: UpdatePromoInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError("Promo tidak ditemukan");
  }

  // promo yang masa berlakunya sudah berakhir tidak boleh diubah lagi
  if (promo.status === "Selesai") {
    throw new BadRequestError("Promo yang sudah selesai tidak dapat diubah", [
      {
        field: "status",
        message: "Promo dengan status Selesai tidak dapat diubah",
      },
    ]);
  }

  // cek nama duplikat jika nama diubah
  if (input.name && input.name !== promo.name) {
    const duplicateName = await findPromoByName(input.name, owner_id, t, id);
    if (duplicateName) {
      throw new ConflictError("Nama promo sudah digunakan", [
        { field: "name", message: "Nama promo sudah digunakan" },
      ]);
    }
  }

  // validasi tanggal
  // DATEONLY disimpan & dikembalikan sebagai string 'YYYY-MM-DD',
  // tidak dikonversi ke Date supaya tidak bergeser karena timezone
  const startDate = input.start_date ?? promo.start_date;
  const endDate = input.end_date ?? promo.end_date;

  // start_date hanya boleh digeser ke hari ini atau ke depan.
  // dicek hanya kalau start_date memang ikut diubah, supaya promo yang sudah
  // berjalan (start_date-nya di masa lalu) tetap bisa diupdate field lainnya
  if (input.start_date) {
    const today = new Date().toISOString().split("T")[0] as string;

    if (input.start_date < today) {
      throw new BadRequestError("Validasi gagal", [
        {
          field: "start_date",
          message: "Tanggal mulai tidak boleh sebelum hari ini",
        },
      ]);
    }
  }

  if (endDate < startDate) {
    throw new BadRequestError("Validasi gagal", [
      {
        field: "end_date",
        message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
      },
    ]);
  }

  // products wajib minimal 1: promo tanpa produk tidak ada gunanya.
  // dicek di awal, sebelum promo sempat diupdate
  if (!Array.isArray(input.products) || input.products.length === 0) {
    throw new BadRequestError("Validasi gagal", [
      { field: "products", message: "Produk promo wajib diisi minimal 1" },
    ]);
  }

  // validasi per tipe diskon
  const effectiveType = input.discount_type ?? promo.discount_type;
  if (input.discount_type) {
    validateDiscountInput(input, false);
  }

  // discount_value menampung ketiga tipe, termasuk harga tetap untuk special_price
  const discountValue =
    input.discount_value !== undefined
      ? String(Number(input.discount_value))
      : promo.discount_value;

  await updatePromo(
    id,
    {
      name: input.name ?? promo.name,
      description:
        input.description !== undefined
          ? (input.description ?? null)
          : promo.description,
      discount_type: effectiveType,
      discount_value: discountValue,
      discount_text:
        input.discount_text !== undefined
          ? (input.discount_text ?? null)
          : promo.discount_text,
      discount_description:
        input.discount_description !== undefined
          ? (input.discount_description ?? null)
          : promo.discount_description,
      start_date: startDate,
      end_date: endDate,
      start_time:
        input.start_time !== undefined
          ? normalizeTime(input.start_time)
          : promo.start_time,
      end_time:
        input.end_time !== undefined
          ? normalizeTime(input.end_time)
          : promo.end_time,
      status: input.status ?? promo.status,
      updated_by: requester.email,
    },
    t,
  );

  // sync penuh: produk di luar daftar ini dilepas dari promo
  await syncProductPromoService(id, input.products, requester, t);

  return getPromoByIdService(id, requester, t);
};

// toggle aktif / non-aktif promo
export const togglePromoActiveService = async (
  id: string,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError("Promo tidak ditemukan");
  }

  // Nonaktif → kembali mengikuti periode (Aktif/Terjadwal/Selesai),
  // status lainnya → dimatikan jadi Nonaktif
  const newStatus: PromoStatus =
    promo.status === "Nonaktif"
      ? resolveStatusFromPeriod(promo.start_date, promo.end_date)
      : "Nonaktif";

  await toggleActivePromo(id, newStatus, requester.email, t);
  return getPromoByIdService(id, requester, t);
};

export const deletePromoService = async (
  id: string,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError("Promo tidak ditemukan");
  }

  // lepas dulu promo dari produk-produknya, kalau tidak promo_id & promo_discount
  // akan tetap menempel dan menunjuk promo yang sudah dihapus
  const attachedProducts = await findProductsByPromoId(id, owner_id, t);
  if (attachedProducts.length > 0) {
    await bulkUpdateProductPromo(
      attachedProducts.map((product) => ({
        id: product.id,
        promo_id: null,
        promo_discount: null,
      })),
      requester.email,
      t,
    );
  }

  await deletePromo(id, requester.email, t);
};

export interface SyncPromoStatusResult {
  checked_at: string;
  checked_time: string;
  activated: number;    // Terjadwal → Aktif
  finished: number;     // Aktif → Selesai
  paused: number;       // Aktif → Terjadwal (di luar jam berlaku)
}

/**
 * Selaraskan kolom `status` promo dengan periode berjalannya.
 * Dipanggil worker secara berkala, bukan lewat HTTP.
 *
 * Jam ikut diperhitungkan kalau promo punya start_time/end_time:
 *   - punya jam  → hanya Aktif saat jam sekarang masuk rentangnya
 *   - tanpa jam  → berlaku sepanjang hari, cukup cek tanggal
 *
 * Transisi yang dilakukan:
 *   Terjadwal → Aktif     : tanggal & jam sedang berjalan
 *   Aktif     → Terjadwal : tanggal masih berlaku tapi jam sudah di luar rentang
 *                           (menunggu jam berikutnya, mis. promo 08:00-12:00 pada jam 14:00)
 *   Aktif     → Selesai   : end_date sudah lewat
 *
 * Yang sengaja TIDAK disentuh:
 *   - status `Nonaktif` (disetel manual user, tidak boleh dihidupkan worker)
 *   - promo `Terjadwal` yang end_date-nya sudah lewat tanpa pernah Aktif —
 *     hanya promo ber-status Aktif yang boleh jadi Selesai
 */
export const syncPromoStatusService = async (
  updated_by = 'system',
  t?: Transaction,
): Promise<SyncPromoStatusResult> => {
  const now = new Date();
  const today = now.toISOString().split('T')[0] as string;
  const currentTime = now.toTimeString().slice(0, 8); // 'HH:mm:ss' waktu lokal server

  // promo yang tanggal DAN jamnya sedang berjalan.
  // promo tanpa jam otomatis lolos filter waktu (berlaku sepanjang hari)
  const running = await findPromosInPeriod(
    { date: today, start_time: currentTime, end_time: currentTime },
    t,
  );
  const runningIds = new Set(running.map((promo) => promo.id));

  const toActivate = running
    .filter((promo) => promo.status === 'Terjadwal')
    .map((promo) => promo.id);

  // promo yang tanggalnya masih berlaku tapi TIDAK ikut hasil di atas
  // berarti jamnya sedang di luar rentang → dikembalikan ke Terjadwal
  const inDateRange = await findPromosInPeriod({ date: today }, t);
  const toPause = inDateRange
    .filter((promo) => promo.status === 'Aktif' && !runningIds.has(promo.id))
    .map((promo) => promo.id);

  // promo di luar periode → yang Aktif & end_date-nya sudah lewat ditandai selesai.
  // promo yang belum mulai (start_date > today) tidak termasuk di sini
  const outsidePeriod = await findPromosOutsidePeriod({ date: today }, t);
  const toFinish = outsidePeriod
    .filter((promo) => promo.status === 'Aktif' && promo.end_date < today)
    .map((promo) => promo.id);

  if (toActivate.length > 0) {
    await bulkUpdatePromoStatus(toActivate, 'Aktif', updated_by, t);
  }

  if (toPause.length > 0) {
    await bulkUpdatePromoStatus(toPause, 'Terjadwal', updated_by, t);
  }

  if (toFinish.length > 0) {
    await bulkUpdatePromoStatus(toFinish, 'Selesai', updated_by, t);
  }

  return {
    checked_at: today,
    checked_time: currentTime,
    activated: toActivate.length,
    paused: toPause.length,
    finished: toFinish.length,
  };
};
