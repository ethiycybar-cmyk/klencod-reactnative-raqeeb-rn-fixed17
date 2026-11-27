package com.raqeeb.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * جسر أصلي لثلاث مهام: مشاركة ملف (واتساب أو قائمة المشاركة)، مسح الباركود بكاميرا Google،
 * وحفظ/فتح ملفات النسخ الاحتياطي المشفّرة. الاسم في JavaScript: NativeModules.RaqeebNative
 */
public class RaqeebNativeModule extends ReactContextBaseJavaModule {

  private static final int REQ_SAVE = 7101;
  private static final int REQ_PICK = 7102;
  private static final int MAX_FILE_BYTES = 60 * 1024 * 1024;
  private static final ExecutorService POOL = Executors.newFixedThreadPool(2);

  private final ReactApplicationContext appContext;
  private final Object lock = new Object();
  private Promise pendingPromise;
  private String pendingBase64;
  private int pendingRequest = 0;

  RaqeebNativeModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.appContext = reactContext;
    reactContext.addActivityEventListener(new BaseActivityEventListener() {
      @Override
      public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        handleActivityResult(requestCode, resultCode, data);
      }
    });
  }

  @Override
  public String getName() {
    return "RaqeebNative";
  }

  private static String describe(Throwable e) {
    String m = e.getMessage();
    return m != null && !m.isEmpty() ? e.getClass().getSimpleName() + ": " + m : e.getClass().getSimpleName();
  }

  // ───────────────────────── مسح الباركود ─────────────────────────

  @ReactMethod
  public void scanBarcode(final Promise promise) {
    final Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "لا توجد شاشة نشطة");
      return;
    }
    activity.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        try {
          GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(activity);
          scanner.startScan()
              .addOnSuccessListener(barcode -> {
                String value = barcode.getRawValue();
                if (value == null || value.isEmpty()) value = barcode.getDisplayValue();
                if (value == null || value.isEmpty()) {
                  promise.reject("EMPTY", "لم يُقرأ باركود");
                } else {
                  promise.resolve(value);
                }
              })
              .addOnCanceledListener(() -> promise.reject("CANCELED", "تم الإلغاء"))
              .addOnFailureListener(e -> promise.reject("SCAN_FAILED", describe(e)));
        } catch (Exception e) {
          promise.reject("SCAN_FAILED", describe(e));
        }
      }
    });
  }

  // ───────────────────────── مشاركة ملف ─────────────────────────

  @ReactMethod
  public void shareFile(final String base64, final String filename, final String mime,
                        final String whatsappNumber, final String message, final Promise promise) {
    POOL.execute(new Runnable() {
      @Override
      public void run() {
        try {
          File dir = new File(appContext.getCacheDir(), "shared");
          if (!dir.exists() && !dir.mkdirs()) throw new IOException("تعذّر إنشاء مجلد المشاركة");
          cleanOld(dir);
          File file = new File(dir, safeName(filename));
          writeBytes(file, Base64.decode(base64, Base64.DEFAULT));
          Uri uri = FileProvider.getUriForFile(appContext, appContext.getPackageName() + ".raqeebfileprovider", file);
          launchShare(uri, mime, whatsappNumber, message, safeName(filename));
          promise.resolve("ok");
        } catch (Exception e) {
          promise.reject("SHARE_FAILED", describe(e));
        }
      }
    });
  }

  private static String safeName(String name) {
    String n = name == null ? "file" : name.replaceAll("[^A-Za-z0-9._-]", "_");
    return n.isEmpty() ? "file" : n;
  }

  private static void cleanOld(File dir) {
    File[] files = dir.listFiles();
    if (files == null) return;
    long limit = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
    for (File f : files) {
      if (f.lastModified() < limit) {
        //noinspection ResultOfMethodCallIgnored
        f.delete();
      }
    }
  }

  private static void writeBytes(File file, byte[] bytes) throws IOException {
    FileOutputStream out = new FileOutputStream(file);
    try {
      out.write(bytes);
    } finally {
      out.close();
    }
  }

  private boolean isInstalled(String pkg) {
    try {
      appContext.getPackageManager().getPackageInfo(pkg, 0);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  private void startShareActivity(Intent intent) {
    Activity activity = getCurrentActivity();
    if (activity != null) {
      activity.startActivity(intent);
    } else {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      appContext.startActivity(intent);
    }
  }

  private void launchShare(Uri uri, String mime, String number, String message, String name) {
    Intent send = new Intent(Intent.ACTION_SEND);
    send.setType(mime);
    send.putExtra(Intent.EXTRA_STREAM, uri);
    if (message != null && !message.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, message);
    send.setClipData(ClipData.newRawUri(name, uri));
    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

    if (number != null && !number.isEmpty()) {
      String[] packages = new String[] {"com.whatsapp", "com.whatsapp.w4b"};
      for (String pkg : packages) {
        if (!isInstalled(pkg)) continue;
        Intent direct = new Intent(send);
        direct.setPackage(pkg);
        direct.putExtra("jid", number + "@s.whatsapp.net");
        appContext.grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
          startShareActivity(direct);
          return;
        } catch (ActivityNotFoundException ignored) {
          // نجرّب التطبيق التالي ثم قائمة المشاركة العامة.
        }
      }
    }
    Intent chooser = Intent.createChooser(send, "مشاركة التقرير");
    startShareActivity(chooser);
  }

  // ───────────────────────── حفظ وفتح ملفات ─────────────────────────

  @ReactMethod
  public void saveFile(String base64, String filename, String mime, Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "لا توجد شاشة نشطة");
      return;
    }
    synchronized (lock) {
      if (pendingPromise != null) {
        promise.reject("BUSY", "عملية أخرى قيد التنفيذ");
        return;
      }
      pendingPromise = promise;
      pendingBase64 = base64;
      pendingRequest = REQ_SAVE;
    }
    try {
      Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType(mime);
      intent.putExtra(Intent.EXTRA_TITLE, filename);
      activity.startActivityForResult(intent, REQ_SAVE);
    } catch (Exception e) {
      failPending("SAVE_FAILED", describe(e));
    }
  }

  @ReactMethod
  public void pickFile(Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "لا توجد شاشة نشطة");
      return;
    }
    synchronized (lock) {
      if (pendingPromise != null) {
        promise.reject("BUSY", "عملية أخرى قيد التنفيذ");
        return;
      }
      pendingPromise = promise;
      pendingBase64 = null;
      pendingRequest = REQ_PICK;
    }
    try {
      Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType("*/*");
      activity.startActivityForResult(intent, REQ_PICK);
    } catch (Exception e) {
      failPending("PICK_FAILED", describe(e));
    }
  }

  private void failPending(String code, String message) {
    Promise promise;
    synchronized (lock) {
      promise = pendingPromise;
      pendingPromise = null;
      pendingBase64 = null;
      pendingRequest = 0;
    }
    if (promise != null) promise.reject(code, message);
  }

  private void handleActivityResult(int requestCode, int resultCode, Intent data) {
    final Promise promise;
    final String base64;
    final int request;
    synchronized (lock) {
      if (pendingPromise == null || requestCode != pendingRequest) return;
      promise = pendingPromise;
      base64 = pendingBase64;
      request = pendingRequest;
      pendingPromise = null;
      pendingBase64 = null;
      pendingRequest = 0;
    }
    if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
      promise.reject("CANCELED", "تم الإلغاء");
      return;
    }
    final Uri uri = data.getData();
    POOL.execute(new Runnable() {
      @Override
      public void run() {
        try {
          if (request == REQ_SAVE) {
            OutputStream out = appContext.getContentResolver().openOutputStream(uri, "w");
            if (out == null) throw new IOException("تعذّر فتح الملف للكتابة");
            try {
              out.write(Base64.decode(base64, Base64.DEFAULT));
              out.flush();
            } finally {
              out.close();
            }
            promise.resolve(uri.toString());
          } else {
            InputStream in = appContext.getContentResolver().openInputStream(uri);
            if (in == null) throw new IOException("تعذّر فتح الملف للقراءة");
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try {
              byte[] chunk = new byte[16384];
              int n;
              while ((n = in.read(chunk)) != -1) {
                buffer.write(chunk, 0, n);
                if (buffer.size() > MAX_FILE_BYTES) throw new IOException("الملف كبير جداً");
              }
            } finally {
              in.close();
            }
            promise.resolve(Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP));
          }
        } catch (Exception e) {
          promise.reject(request == REQ_SAVE ? "SAVE_FAILED" : "PICK_FAILED", describe(e));
        }
      }
    });
  }

  // ───────────────────────── تشفير النسخ الاحتياطي ─────────────────────────

  @ReactMethod
  public void encryptBackup(final String json, final String password, final Promise promise) {
    POOL.execute(new Runnable() {
      @Override
      public void run() {
        try {
          byte[] encrypted = BackupCodec.encrypt(json, password);
          promise.resolve(Base64.encodeToString(encrypted, Base64.NO_WRAP));
        } catch (Exception e) {
          promise.reject("ENCRYPT_FAILED", describe(e));
        }
      }
    });
  }

  @ReactMethod
  public void decryptBackup(final String base64, final String password, final Promise promise) {
    POOL.execute(new Runnable() {
      @Override
      public void run() {
        try {
          byte[] file = Base64.decode(base64, Base64.DEFAULT);
          promise.resolve(BackupCodec.decrypt(file, password));
        } catch (BackupCodec.WrongPasswordException e) {
          promise.reject("WRONG_PASSWORD", e.getMessage());
        } catch (BackupCodec.BadFileException e) {
          promise.reject("BAD_FILE", e.getMessage());
        } catch (Exception e) {
          promise.reject("DECRYPT_FAILED", describe(e));
        }
      }
    });
  }
}
