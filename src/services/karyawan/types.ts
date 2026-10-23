export interface CreateKaryawanInput {
  namaLengkap: string;
  email: string;
  nomorHp: string;
  idKaryawan?: string;
  cabangId: string;
  role: string;
  loginAccess: boolean;
  username?: string;
  password?: string;
}

export interface UpdateKaryawanInput {
  namaLengkap?: string;
  email?: string;
  nomorHp?: string;
  idKaryawan?: string;
  cabangId?: string;
  role?: string;
  loginAccess?: boolean;
  username?: string;
  password?: string;
}

export interface ResetKaryawanPasswordInput {
  password: string;
}

export interface KaryawanListQuery {
  search?: string;
  role?: string;
  cabangId?: string;
  branchId?: string;
  status?: string;
  sort?: string;
  order?: string;
}
