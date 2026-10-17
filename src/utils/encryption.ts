import crypto from 'crypto';

// AES-256-GCM: selain merahasiakan, juga mendeteksi kalau ciphertext diubah orang (auth tag).
// format simpan: <iv>:<authTag>:<ciphertext>, semuanya hex, dipisah titik dua
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

// kunci diambil dari ENCRYPTION_KEY di .env.
// dibaca saat dipakai (bukan saat import) supaya dotenv sudah sempat jalan
const getKey = (): Buffer => {
  const raw = process.env.ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error('ENCRYPTION_KEY tidak ditemukan di .env');
  }

  // dukung 2 format: hex 64 karakter, atau string biasa yang di-hash jadi 32 byte
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : crypto.createHash('sha256').update(raw).digest();

  if (key.length !== KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY tidak valid');
  }

  return key;
};

export const encrypt = (plainText: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (cipherText: string): string => {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Format data terenkripsi tidak valid');
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

// data lama yang terlanjur tersimpan plain text tidak ikut rusak:
// kalau formatnya bukan hasil encrypt, kembalikan apa adanya
export const safeDecrypt = (value: string | null | undefined): string => {
  if (!value) return '';

  try {
    return decrypt(value);
  } catch {
    return value;
  }
};
