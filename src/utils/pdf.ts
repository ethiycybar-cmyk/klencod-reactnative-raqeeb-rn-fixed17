/** أدوات خالصة (بدون مكتبات) لبناء PDF من صورة JPEG وتحويل base64. */

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = ABC.indexOf(clean[i]);
    const b = ABC.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? ABC.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? ABC.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    chunk += ABC[b0 >> 2] + ABC[((b0 & 3) << 4) | (b1 >> 4)] + (has1 ? ABC[((b1 & 15) << 2) | (b2 >> 6)] : '=') + (has2 ? ABC[b2 & 63] : '=');
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

export type JpegInfo = { width: number; height: number; components: number };

/** يقرأ أبعاد JPEG من ترويسة SOF دون فك ضغطه. */
export function jpegInfo(b: Uint8Array): JpegInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8], components: b[i + 9] };
    }
    i += 2 + len;
  }
  return null;
}

const ascii = (s: string): Uint8Array => {
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) a[i] = s.charCodeAt(i) & 255;
  return a;
};

/** PDF من صفحة واحدة بعرض A4 وارتفاع يتناسب مع الصورة، تُرجع base64. */
export function buildPdfFromJpegBase64(jpegB64: string): string {
  const jpeg = base64ToBytes(jpegB64);
  const info = jpegInfo(jpeg);
  if (!info || !info.width || !info.height) throw new Error('BAD_JPEG');
  const pageW = 595.28;
  const pageH = Number(((pageW * info.height) / info.width).toFixed(2));
  const colorSpace = info.components === 1 ? '/DeviceGray' : info.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (u: Uint8Array) => {
    chunks.push(u);
    pos += u.length;
  };

  push(ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
  offsets[1] = pos;
  push(ascii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  offsets[2] = pos;
  push(ascii('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  offsets[3] = pos;
  push(ascii(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`));
  offsets[4] = pos;
  push(ascii(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`));
  push(jpeg);
  push(ascii('\nendstream\nendobj\n'));
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  offsets[5] = pos;
  push(ascii(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`));

  const xrefPos = pos;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let n = 1; n <= 5; n += 1) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  push(ascii(xref));

  const all = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return bytesToBase64(all);
}
