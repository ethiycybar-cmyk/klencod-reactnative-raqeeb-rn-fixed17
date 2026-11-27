package com.raqeeb.app;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.zip.DataFormatException;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * ملف النسخة الاحتياطية: JSON مضغوط (Deflate) ثم مشفّر بـ AES-256-GCM.
 * المفتاح = PBKDF2-HMAC-SHA256 من كلمة التثبيت. كلمة خاطئة تُفشل فحص GCM فلا يُقبل الملف.
 * لا يعتمد على أي مكتبة أندرويد، فيُختبر على الحاسوب.
 */
public final class BackupCodec {

  public static final class WrongPasswordException extends Exception {
    public WrongPasswordException(String message) { super(message); }
  }

  public static final class BadFileException extends Exception {
    public BadFileException(String message) { super(message); }
  }

  private static final byte[] MAGIC = new byte[] {'R', 'Q', 'B', '1'};
  private static final int SALT_LEN = 16;
  private static final int IV_LEN = 12;
  private static final int TAG_BITS = 128;
  private static final int ITERATIONS = 100000;
  private static final int MAX_PLAIN_BYTES = 200 * 1024 * 1024;

  private BackupCodec() {}

  /** PBKDF2-HMAC-SHA256 بمخرج 32 بايت (كتلة واحدة). مكتوبة يدوياً لتعمل على كل إصدارات أندرويد. */
  static byte[] pbkdf2(byte[] password, byte[] salt, int iterations) throws GeneralSecurityException {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(password, "HmacSHA256"));
    byte[] block = Arrays.copyOf(salt, salt.length + 4);
    block[salt.length + 3] = 1; // INT(1) بترتيب big-endian
    byte[] u = mac.doFinal(block);
    byte[] t = u.clone();
    for (int i = 1; i < iterations; i++) {
      u = mac.doFinal(u);
      for (int j = 0; j < t.length; j++) t[j] ^= u[j];
    }
    return t;
  }

  private static byte[] deflate(byte[] data) {
    Deflater deflater = new Deflater(Deflater.BEST_COMPRESSION);
    try {
      deflater.setInput(data);
      deflater.finish();
      ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(64, data.length / 3));
      byte[] buffer = new byte[8192];
      while (!deflater.finished()) {
        int n = deflater.deflate(buffer);
        out.write(buffer, 0, n);
      }
      return out.toByteArray();
    } finally {
      deflater.end();
    }
  }

  private static byte[] inflate(byte[] data) throws BadFileException {
    Inflater inflater = new Inflater();
    try {
      inflater.setInput(data);
      ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(64, data.length * 3));
      byte[] buffer = new byte[8192];
      while (!inflater.finished()) {
        int n = inflater.inflate(buffer);
        if (n == 0 && (inflater.needsInput() || inflater.needsDictionary())) {
          throw new BadFileException("الملف ناقص أو تالف");
        }
        out.write(buffer, 0, n);
        if (out.size() > MAX_PLAIN_BYTES) throw new BadFileException("الملف أكبر من المسموح");
      }
      return out.toByteArray();
    } catch (DataFormatException e) {
      throw new BadFileException("الملف تالف");
    } finally {
      inflater.end();
    }
  }

  public static byte[] encrypt(String json, String password) throws GeneralSecurityException {
    byte[] plain = deflate(json.getBytes(StandardCharsets.UTF_8));
    SecureRandom random = new SecureRandom();
    byte[] salt = new byte[SALT_LEN];
    byte[] iv = new byte[IV_LEN];
    random.nextBytes(salt);
    random.nextBytes(iv);
    byte[] key = pbkdf2(password.getBytes(StandardCharsets.UTF_8), salt, ITERATIONS);

    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, iv));
    cipher.updateAAD(MAGIC);
    byte[] cipherText = cipher.doFinal(plain);

    byte[] out = new byte[MAGIC.length + SALT_LEN + IV_LEN + cipherText.length];
    int pos = 0;
    System.arraycopy(MAGIC, 0, out, pos, MAGIC.length);
    pos += MAGIC.length;
    System.arraycopy(salt, 0, out, pos, SALT_LEN);
    pos += SALT_LEN;
    System.arraycopy(iv, 0, out, pos, IV_LEN);
    pos += IV_LEN;
    System.arraycopy(cipherText, 0, out, pos, cipherText.length);
    return out;
  }

  public static String decrypt(byte[] file, String password) throws BadFileException, WrongPasswordException {
    int header = MAGIC.length + SALT_LEN + IV_LEN;
    if (file == null || file.length < header + TAG_BITS / 8) throw new BadFileException("ليس ملف نسخة احتياطية من رقيب");
    for (int i = 0; i < MAGIC.length; i++) {
      if (file[i] != MAGIC[i]) throw new BadFileException("ليس ملف نسخة احتياطية من رقيب");
    }
    byte[] salt = Arrays.copyOfRange(file, MAGIC.length, MAGIC.length + SALT_LEN);
    byte[] iv = Arrays.copyOfRange(file, MAGIC.length + SALT_LEN, header);
    byte[] cipherText = Arrays.copyOfRange(file, header, file.length);

    byte[] plain;
    try {
      byte[] key = pbkdf2(password.getBytes(StandardCharsets.UTF_8), salt, ITERATIONS);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, iv));
      cipher.updateAAD(MAGIC);
      plain = cipher.doFinal(cipherText);
    } catch (GeneralSecurityException e) {
      // فشل فحص GCM يعني كلمة خاطئة أو ملفاً معدَّلاً.
      throw new WrongPasswordException("كلمة التثبيت غير صحيحة أو الملف معدَّل");
    }
    return new String(inflate(plain), StandardCharsets.UTF_8);
  }
}
