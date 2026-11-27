import { utf8Encode } from './utf8';

/**
 * أرشيف ZIP قياسي بإدخال واحد ومحمي بكلمة مرور (ZipCrypto، وهو «كلمة مرور zip» المتعارف عليها
 * وتفتحه تطبيقات الملفات و7-Zip وWinRAR). الضغط/فكه يُمرَّران كدوال (deflate خام) ليسهل الاختبار.
 * تنبيه: ZipCrypto أضعف من التشفير الحديث؛ يكفي لمنع الفتح العرضي لا لمقاومة مهاجم متمكّن.
 */

export type RawDeflate = (data: Uint8Array) => Uint8Array;
export type RawInflate = (data: Uint8Array) => Uint8Array;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crcByte = (crc: number, byte: number) => (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = crcByte(c, data[i]);
  return (c ^ 0xffffffff) >>> 0;
}

class Keys {
  k0 = 0x12345678;
  k1 = 0x23456789;
  k2 = 0x34567890;
  constructor(password: Uint8Array) {
    for (let i = 0; i < password.length; i += 1) this.update(password[i]);
  }
  update(byte: number) {
    this.k0 = crcByte(this.k0, byte);
    this.k1 = (Math.imul((this.k1 + (this.k0 & 0xff)) >>> 0, 134775813) + 1) >>> 0;
    this.k2 = crcByte(this.k2, this.k1 >>> 24);
  }
  streamByte(): number {
    const t = (this.k2 | 2) & 0xffff;
    return (Math.imul(t, t ^ 1) >>> 8) & 0xff;
  }
  encrypt(plain: number): number {
    const c = plain ^ this.streamByte();
    this.update(plain);
    return c & 0xff;
  }
  decrypt(cipher: number): number {
    const p = (cipher ^ this.streamByte()) & 0xff;
    this.update(p);
    return p;
  }
}

const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export function createEncryptedZip(
  entryName: string,
  data: Uint8Array,
  password: string,
  deflate: RawDeflate,
  randomBytes: (n: number) => Uint8Array,
  now: Date = new Date(),
): Uint8Array {
  const nameBytes = utf8Encode(entryName);
  const crc = crc32(data);
  const compressed = deflate(data);
  const keys = new Keys(utf8Encode(password));

  const header = randomBytes(12).slice();
  header[11] = (crc >>> 24) & 0xff;
  const body = new Uint8Array(12 + compressed.length);
  for (let i = 0; i < 12; i += 1) body[i] = keys.encrypt(header[i]);
  for (let i = 0; i < compressed.length; i += 1) body[12 + i] = keys.encrypt(compressed[i]);

  const { time, date } = dosDateTime(now);
  const flags = 0x0801; // مشفّر + أسماء UTF-8
  const local = [
    ...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(8), ...u16(time), ...u16(date),
    ...u32(crc), ...u32(body.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
  ];
  const central = [
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(8), ...u16(time), ...u16(date),
    ...u32(crc), ...u32(body.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
    ...u16(0), ...u16(0), ...u32(0), ...u32(0),
  ];
  const localSize = local.length + nameBytes.length + body.length;
  const centralSize = central.length + nameBytes.length;
  const eocd = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1), ...u32(centralSize), ...u32(localSize), ...u16(0)];

  const out = new Uint8Array(localSize + centralSize + eocd.length);
  let o = 0;
  const put = (arr: ArrayLike<number>) => {
    out.set(arr as ArrayLike<number>, o);
    o += arr.length;
  };
  put(local); put(nameBytes); put(body); put(central); put(nameBytes); put(eocd);
  return out;
}

export class ZipError extends Error {
  constructor(public code: 'BAD_ARCHIVE' | 'WRONG_PASSWORD' | 'UNSUPPORTED') {
    super(code);
  }
}

const rd16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const rd32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** يقرأ أول إدخال في الأرشيف ويفك تشفيره. يرمي ZipError عند الخطأ أو كلمة مرور خاطئة. */
export function readEncryptedZip(zip: Uint8Array, password: string, inflate: RawInflate): { name: string; data: Uint8Array } {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i -= 1) {
    if (rd32(zip, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('BAD_ARCHIVE');
  const cdOffset = rd32(zip, eocd + 16);
  if (rd32(zip, cdOffset) !== 0x02014b50) throw new ZipError('BAD_ARCHIVE');
  const flags = rd16(zip, cdOffset + 8);
  const method = rd16(zip, cdOffset + 10);
  const crc = rd32(zip, cdOffset + 16);
  const csize = rd32(zip, cdOffset + 20);
  const usize = rd32(zip, cdOffset + 24);
  const nameLen = rd16(zip, cdOffset + 28);
  const localOffset = rd32(zip, cdOffset + 42);
  const nameBytes = zip.subarray(cdOffset + 46, cdOffset + 46 + nameLen);
  if (rd32(zip, localOffset) !== 0x04034b50) throw new ZipError('BAD_ARCHIVE');
  if ((method !== 8 && method !== 0) || (flags & 0x40)) throw new ZipError('UNSUPPORTED');
  const lNameLen = rd16(zip, localOffset + 26);
  const lExtraLen = rd16(zip, localOffset + 28);
  const start = localOffset + 30 + lNameLen + lExtraLen;
  if (start + csize > zip.length) throw new ZipError('BAD_ARCHIVE');
  let payload = zip.slice(start, start + csize);

  if (flags & 1) {
    if (payload.length < 12) throw new ZipError('BAD_ARCHIVE');
    const keys = new Keys(utf8Encode(password));
    const plain = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i += 1) plain[i] = keys.decrypt(payload[i]);
    const check = plain[11];
    const expected = (flags & 8) ? (rd16(zip, localOffset + 10) >>> 8) & 0xff : (crc >>> 24) & 0xff;
    if (check !== expected) throw new ZipError('WRONG_PASSWORD');
    payload = plain.subarray(12);
  }

  let data: Uint8Array;
  try {
    data = method === 8 ? inflate(payload) : payload;
  } catch {
    throw new ZipError('WRONG_PASSWORD');
  }
  if (data.length !== usize || crc32(data) !== crc) throw new ZipError('WRONG_PASSWORD');

  let name = '';
  for (let i = 0; i < nameBytes.length; i += 1) name += String.fromCharCode(nameBytes[i]);
  return { name, data };
}
