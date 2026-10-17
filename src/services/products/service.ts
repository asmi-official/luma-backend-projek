import { Transaction, WhereOptions, OrderItem, Op } from 'sequelize';
import {
  createProduct,
  findAllProducts,
  countProductsByActive,
  findProductById,
  findProductByName,
  findProductsByIds,
  findProductsByPromoId,
  findProductsWithOtherPromo,
  bulkUpdateProductPromo,
  updateProduct,
  deleteProduct,
} from './repository';
import { generateSerialNumber } from '../naming-series/service';
import { findUserById } from '../users/repository';
import { findCompanyById, findCompanyByUserId } from '../company/repository';
import { uploadDocumentService, updateDocumentService, deleteDocumentService } from '../documents/service';
import { findFlexParamById } from '../flex-params/repository';
import Promo from '../promos/model';
import { OWNER_ROLE } from '../users/model';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/app-error';
import { CreateProductInput, UpdateProductInput } from './types';

// request multipart/form-data mengirim semua nilai sebagai string, jadi "false" / "0"
// harus dinormalkan — kalau tidak, string "false" dianggap truthy dan tersimpan sebagai true
const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return !['false', '0', '', 'null'].includes(value.toLowerCase().trim());
  return Boolean(value);
};

export const resolveOwnerId = async (
  requester: { user_id: string; role: string },
  t: Transaction
): Promise<{ owner_id: string; company_code: string }> => {
  if (requester.role === OWNER_ROLE) {
    const company = await findCompanyByUserId(requester.user_id, t);
    return {
      owner_id: requester.user_id,
      company_code: company?.company_code ?? 'COMP',
    };
  }

  const requesterUser = await findUserById(requester.user_id, t);
  if (!requesterUser) throw new NotFoundError('User tidak ditemukan');

  const owner_id = requesterUser.header_id ?? requesterUser.id;
  let company_code = 'COMP';

  if (requesterUser.company_id) {
    const company = await findCompanyById(requesterUser.company_id, t);
    if (company?.company_code) company_code = company.company_code;
  }

  return { owner_id, company_code };
};

export const createProductService = async (
  input: CreateProductInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
  file?: Express.Multer.File
) => {
  if (!input.name) throw new BadRequestError('Validasi gagal', [{ field: 'name', message: 'Nama produk wajib diisi' }]);
  if (!input.category) throw new BadRequestError('Validasi gagal', [{ field: 'category', message: 'Kategori wajib diisi' }]);
  if (!input.category_id) throw new BadRequestError('Validasi gagal', [{ field: 'category_id', message: 'Category ID wajib diisi' }]);
  if (!input.unit) throw new BadRequestError('Validasi gagal', [{ field: 'unit', message: 'Satuan wajib diisi' }]);

  const { owner_id, company_code } = await resolveOwnerId(requester, t);

  const categoryParam = await findFlexParamById(input.category_id, t);
  if (!categoryParam) throw new NotFoundError('Kategori tidak ditemukan');

  const duplicate = await findProductByName(input.name, owner_id, t);
  if (duplicate) {
    throw new ConflictError('Nama produk sudah digunakan', [
      { field: 'name', message: 'Nama produk sudah digunakan' },
    ]);
  }

  const currentYear = new Date().getFullYear();
  const sku = await generateSerialNumber('PRODUCT', owner_id, 'PROD', currentYear, company_code, t);
  const id = crypto.randomUUID();

  let photo_id: string | null = null;
  let photo_url: string | null = null;

  if (file) {
    const doc = await uploadDocumentService(
      file,
      {
        user_id: requester.user_id,
        created_by: requester.email,
        updated_by: requester.email,
        ref_id: id,
        ref_type: 'FILE_PRODUCT',
      },
      t
    );
    photo_id = doc.id;
    photo_url = doc.file_url;
  }

  return createProduct(
    {
      id,
      sku,
      name: input.name,
      category: input.category,
      category_id: input.category_id,
      unit: input.unit,
      cost_price: Number(input.cost_price ?? 0),
      sell_price: Number(input.sell_price ?? 0),
      stock: Number(input.stock ?? 0),
      description: input.description ?? null,
      active: input.active !== undefined ? toBoolean(input.active) : true,
      photo_id,
      photo_url,
      user_id: requester.user_id,
      owner_id,
      created_by: requester.email,
      updated_by: requester.email,
    },
    t
  );
};

export const getAllProductsService = async (
  requester: { user_id: string; role: string },
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t: Transaction,
  search?: string
) => {
  const { owner_id } = await resolveOwnerId(requester, t);

  // search dicari ke name ATAU sku (iLike = tidak peduli huruf besar/kecil).
  // digabung sebagai [Op.and] supaya tidak menimpa kondisi dari `filter`
  const keyword = search?.trim();
  const effectiveWhere = {
    ...where,
    owner_id,
    ...(keyword && {
      [Op.and]: [
        {
          [Op.or]: [
            { name: { [Op.iLike]: `%${keyword}%` } },
            { sku: { [Op.iLike]: `%${keyword}%` } },
          ],
        },
      ],
    }),
  };

  const { rows, count } = await findAllProducts(effectiveWhere, order, page, limit, t);

  // ringkasan aktif/tidak aktif dihitung tanpa kondisi `active` dari filter user,
  // supaya saat user memfilter active=true angka total_inactive tidak jadi 0
  const { active: _active, ...whereWithoutActive } = effectiveWhere as Record<string, unknown>;
  const summary = await countProductsByActive(whereWithoutActive as WhereOptions, t);

  return { rows, count, ...summary };
};

export const getProductByIdService = async (
  id: string,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const product = await findProductById(id, t);

  if (!product || product.owner_id !== owner_id) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  return product;
};

export const updateProductService = async (
  id: string,
  input: UpdateProductInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
  file?: Express.Multer.File
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const product = await findProductById(id, t);

  if (!product || product.owner_id !== owner_id) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  if (input.name && input.name !== product.name) {
    const duplicate = await findProductByName(input.name, owner_id, t, id);
    if (duplicate) {
      throw new ConflictError('Nama produk sudah digunakan', [
        { field: 'name', message: 'Nama produk sudah digunakan' },
      ]);
    }
  }

  if (input.category_id) {
    const categoryParam = await findFlexParamById(input.category_id, t);
    if (!categoryParam) throw new NotFoundError('Kategori tidak ditemukan');
  }

  let photo_id = product.photo_id;
  let photo_url = product.photo_url;

  if (file && product.photo_id) {
    const updatedDoc = await updateDocumentService(
      product.photo_id,
      {
        updated_by: requester.email,
        ref_id: product.id,
        ref_type: 'FILE_PRODUCT',
      },
      t,
      file
    );
    photo_url = updatedDoc?.file_url ?? photo_url;
  } else if (file && !product.photo_id) {
    const doc = await uploadDocumentService(
      file,
      {
        user_id: requester.user_id,
        created_by: requester.email,
        updated_by: requester.email,
        ref_id: product.id,
        ref_type: 'FILE_PRODUCT',
      },
      t
    );
    photo_id = doc.id;
    photo_url = doc.file_url;
  }

  await updateProduct(
    id,
    {
      ...input,
      cost_price: input.cost_price !== undefined ? Number(input.cost_price) : product.cost_price,
      sell_price: input.sell_price !== undefined ? Number(input.sell_price) : product.sell_price,
      stock: input.stock !== undefined ? Number(input.stock) : product.stock,
      ...(input.active !== undefined && { active: toBoolean(input.active) }),
      photo_id,
      photo_url,
      updated_by: requester.email,
    },
    t
  );

  return findProductById(id, t);
};

// sync produk yang terikat 1 promo: daftar yang dikirim jadi acuan penuh.
// produk yang sebelumnya pakai promo ini tapi TIDAK ada di daftar baru
// akan dikosongkan promo_id & promo_discount-nya (promonya dilepas, datanya tidak dihapus).
// contoh: sebelumnya [1,2,3,4] lalu dikirim [1,2,3,5] → produk 4 dilepas, produk 5 ditambah
export const syncProductPromoService = async (
  promo_id: string,
  items: { id: string; promo_discount?: number | string | null }[],
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  if (!Array.isArray(items)) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'products', message: 'products harus berupa array' },
    ]);
  }

  const { owner_id } = await resolveOwnerId(requester, t);

  // id duplikat dirapikan dulu, yang terakhir menang
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const targetIds = Array.from(itemMap.keys());

  // semua produk yang dikirim wajib ada & milik owner yang sama
  const foundProducts = await findProductsByIds(targetIds, owner_id, t);
  const foundIds = new Set(foundProducts.map((p) => p.id));

  const missingIds = targetIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new NotFoundError(`Produk tidak ditemukan: ${missingIds.join(', ')}`);
  }

  // 1 produk tidak boleh terikat 2 promo yang sama-sama berjalan.
  // promo berstatus Selesai / Nonaktif tidak dihitung bentrok karena tidak jalan,
  // jadi produknya boleh dipindah ke promo ini
  const withOtherPromo = await findProductsWithOtherPromo(targetIds, owner_id, promo_id, t);

  if (withOtherPromo.length > 0) {
    const otherPromoIds = Array.from(
      new Set(withOtherPromo.map((p) => p.promo_id).filter((id): id is string => !!id))
    );
    const otherPromos = await Promo.findAll({
      where: { id: otherPromoIds },
      attributes: ['id', 'name', 'status'],
      transaction: t,
    });

    const runningPromos = new Map(
      otherPromos
        .filter((promo) => promo.status === 'Aktif' || promo.status === 'Terjadwal')
        .map((promo) => [promo.id, promo])
    );

    const conflicts = withOtherPromo.filter(
      (product) => product.promo_id && runningPromos.has(product.promo_id)
    );

    if (conflicts.length > 0) {
      throw new ConflictError(
        'Ada produk yang masih terikat promo lain yang sedang berjalan',
        conflicts.map((product) => {
          const promo = runningPromos.get(product.promo_id!)!;
          return {
            field: 'products',
            message: `${product.name} sedang dipakai promo "${promo.name}" (${promo.status})`,
          };
        })
      );
    }
  }

  // produk yang sebelumnya pakai promo ini tapi tidak ada di daftar baru → dilepas
  const currentProducts = await findProductsByPromoId(promo_id, owner_id, t);
  const releasedIds = currentProducts
    .map((p) => p.id)
    .filter((id) => !itemMap.has(id));

  if (releasedIds.length > 0) {
    await bulkUpdateProductPromo(
      releasedIds.map((id) => ({ id, promo_id: null, promo_discount: null })),
      requester.email,
      t
    );
  }

  if (targetIds.length > 0) {
    await bulkUpdateProductPromo(
      targetIds.map((id) => {
        const discount = itemMap.get(id)!.promo_discount;
        return {
          id,
          promo_id,
          promo_discount:
            discount === undefined || discount === null || discount === ''
              ? null
              : String(Number(discount)),
        };
      }),
      requester.email,
      t
    );
  }

  return {
    promo_id,
    attached: targetIds.length,
    released: releasedIds.length,
    products: await findProductsByPromoId(promo_id, owner_id, t),
  };
};

export const deleteProductService = async (
  id: string,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const product = await findProductById(id, t);

  if (!product || product.owner_id !== owner_id) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  if (product.photo_id) {
    await deleteDocumentService(product.photo_id, requester.email, t);
  }

  await deleteProduct(id, requester.email, t);
};
