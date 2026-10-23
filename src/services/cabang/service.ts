import {
  findAllCabangs,
  findCabangById,
  createCabangRepository,
  updateCabangRepository,
  deleteCabangRepository,
  countCabangsByActive,
} from "./repository";
import { BadRequestError, NotFoundError } from "../../utils/app-error";
import { Op, OrderItem, Transaction, WhereOptions } from "sequelize";
import { resolveOwnerId } from "../products/service";

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return !["false", "0", "", "null"].includes(value.toLowerCase().trim());
  }
  return Boolean(value);
};

export const createCabangService = async (
  payload: any,
  userInfo: any,
  transaction?: any,
) => {
  const { user_id } = userInfo;

  if (!payload.name?.trim()) {
    throw new BadRequestError("Validasi gagal", [
      { field: "name", message: "Nama cabang wajib diisi" },
    ]);
  }

  const id = crypto.randomUUID();
  const code = `CBG-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const { owner_id } = await resolveOwnerId(userInfo, transaction);
  const {
    name,
    address,
    phone,
    email,
    manager_name,
    active,
    created_by,
    updated_by,
  } = payload;

  return await createCabangRepository(
    {
      id,
      code,
      name: name.trim(),
      address,
      phone,
      email,
      manager_name,
      active: active === undefined ? true : toBoolean(active),
      user_id,
      owner_id,
      created_by,
      updated_by,
    },
    transaction,
  );
};

export const getAllCabangsService = async (
  requester: { user_id: string; role: string },
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  transaction?: Transaction,
  search?: string,
) => {
  const { owner_id } = await resolveOwnerId(
    requester,
    transaction as Transaction,
  );
  const keyword = search?.trim();
  const effectiveWhere = {
    ...where,
    owner_id,
    ...(keyword && {
      [Op.and]: [
        {
          [Op.or]: [
            { name: { [Op.iLike]: `%${keyword}%` } },
            { code: { [Op.iLike]: `%${keyword}%` } },
          ],
        },
      ],
    }),
  };

  const { rows, count } = await findAllCabangs(
    effectiveWhere,
    order,
    page,
    limit,
    transaction,
  );

  const { active: _active, ...whereWithoutActive } = effectiveWhere as Record<
    string,
    unknown
  >;
  const summary = await countCabangsByActive(
    whereWithoutActive as WhereOptions,
    transaction,
  );

  return { rows, count, ...summary };
};

export const getCabangByIdService = async (
  id: string,
  requester: { user_id: string; role: string },
  transaction?: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(
    requester,
    transaction as Transaction,
  );
  const cabang = await findCabangById(id, transaction);

  if (!cabang || cabang.owner_id !== owner_id) {
    throw new NotFoundError("Cabang tidak ditemukan");
  }

  return cabang;
};

export const updateCabangService = async (
  id: string,
  payload: any,
  userInfo: any,
  transaction?: any,
) => {
  await getCabangByIdService(id, userInfo, transaction);
  const {
    name,
    address,
    phone,
    email,
    manager_name,
    icon,
    color_icon,
    color_bg_icon,
    active,
  } = payload;

  return await updateCabangRepository(
    id,
    {
      ...(name !== undefined && { name: name.trim() }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(manager_name !== undefined && { manager_name }),
      ...(active !== undefined && { active: toBoolean(active) }),
    },
    transaction,
  );
};

export const deleteCabangService = async (
  id: string,
  deletedBy: string,
  userInfo: any,
  transaction?: any,
) => {
  await getCabangByIdService(id, userInfo, transaction);

  return await deleteCabangRepository(id, deletedBy, transaction);
};
