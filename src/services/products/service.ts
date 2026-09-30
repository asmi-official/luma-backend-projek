import { Transaction, WhereOptions, OrderItem } from 'sequelize';
import {
  createProduct,
  findAllProducts,
  findProductById,
  findProductByName,
  updateProduct,
  deleteProduct,
} from './repository';
import { generateSerialNumber } from '../naming-series/service';
import { findUserById } from '../users/repository';
import { findCompanyById, findCompanyByUserId } from '../company/repository';
import { uploadDocumentService, updateDocumentService, deleteDocumentService } from '../documents/service';
import { OWNER_ROLE } from '../users/model';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/app-error';
import { CreateProductInput, UpdateProductInput } from './types';

export const resolveOwnerId = async (
  requester: { user_id: string; role: string },
  t: Transaction
): Promise<{ owner_id: string; company_code: string }> => {
  if (requester.role === OWNER_ROLE) {
    const company = await findCompanyByUserId(requester.user_id, t);
    return {
      owner_id: requester.user_id,
      company_code: company?.id ? company.id.slice(0, 4).toUpperCase() : 'COMP',
    };
  }

  const requesterUser = await findUserById(requester.user_id, t);
  if (!requesterUser) throw new NotFoundError('User tidak ditemukan');

  const owner_id = requesterUser.header_id ?? requesterUser.id;
  let company_code = 'COMP';

  if (requesterUser.company_id) {
    const company = await findCompanyById(requesterUser.company_id, t);
    if (company?.id) company_code = company.id.slice(0, 4).toUpperCase();
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
  if (!input.unit) throw new BadRequestError('Validasi gagal', [{ field: 'unit', message: 'Satuan wajib diisi' }]);

  const { owner_id, company_code } = await resolveOwnerId(requester, t);

  const duplicate = await findProductByName(input.name, owner_id, t);
  if (duplicate) {
    throw new ConflictError('Nama produk sudah digunakan', [
      { field: 'name', message: 'Nama produk sudah digunakan' },
    ]);
  }

  const currentYear = new Date().getFullYear();
  const sku = await generateSerialNumber('PROD', currentYear, company_code, t);
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
      unit: input.unit,
      cost_price: Number(input.cost_price ?? 0),
      sell_price: Number(input.sell_price ?? 0),
      stock: Number(input.stock ?? 0),
      description: input.description ?? null,
      active: input.active ?? true,
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
  t: Transaction
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const effectiveWhere = { ...where, owner_id };

  return findAllProducts(effectiveWhere, order, page, limit, t);
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
      photo_id,
      photo_url,
      updated_by: requester.email,
    },
    t
  );

  return findProductById(id, t);
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
