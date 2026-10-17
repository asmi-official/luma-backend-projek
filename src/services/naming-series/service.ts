import { Transaction } from 'sequelize';
import { findNamingSeriesByKey, createNamingSeries, incrementSeq } from './repository';
import type { TypeNamingSeries } from './model';

// Format id: TYPE_OWNERID_PREFIX_YEAR_COMPANYCODE.
// owner_id ikut masuk id supaya counter tiap owner tidak saling bertabrakan di primary key
const buildId = (
  type_naming_series: TypeNamingSeries,
  owner_id: string,
  prefix: string,
  year: number,
  company_code: string
) => `${type_naming_series}_${owner_id}_${prefix}_${year}_${company_code}`;

// Format nomor dokumen: PREFIX/YEAR/COMPANYCODE/SEQ (SEQ 7 digit), contoh: PROD/2026/A3F9/0000001
const buildSerialNumber = (prefix: string, year: number, company_code: string, seq: number) =>
  `${prefix}/${year}/${company_code}/${String(seq).padStart(7, '0')}`;

// counter dipisah per type_naming_series + owner_id, jadi PRODUCT dan INVOICE punya
// urutan sendiri-sendiri, dan tiap owner punya urutannya sendiri juga
export const generateSerialNumber = async (
  type_naming_series: TypeNamingSeries,
  owner_id: string,
  prefix: string,
  year: number,
  company_code: string,
  t?: Transaction
): Promise<string> => {
  const existing = await findNamingSeriesByKey(
    type_naming_series,
    owner_id,
    prefix,
    year,
    company_code,
    t
  );

  if (existing) {
    // increment di DB dulu, lalu baca ulang supaya dapat nilai aktual bukan nilai lama di memory
    await incrementSeq(existing.id, t);
    const updated = await findNamingSeriesByKey(
      type_naming_series,
      owner_id,
      prefix,
      year,
      company_code,
      t
    );
    return buildSerialNumber(prefix, year, company_code, updated!.seq);
  }

  // belum ada kombinasi type+owner+prefix+year+company_code → buat record baru, seq mulai 1
  const id = buildId(type_naming_series, owner_id, prefix, year, company_code);
  await createNamingSeries(
    { id, type_naming_series, owner_id, prefix, year, company_code, seq: 1 },
    t
  );
  return buildSerialNumber(prefix, year, company_code, 1);
};
