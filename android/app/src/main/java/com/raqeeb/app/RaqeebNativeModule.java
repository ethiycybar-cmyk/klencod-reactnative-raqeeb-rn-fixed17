package com.raqeeb.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * جسر أصلي صغير:
 *  - scanBarcode: ماسح Google (خدمات Play) بدون إذن كاميرا للتطبيق.
 *  - pickFile: اختيار ملف عبر نظام الملفات وإرجاعه base64 (لاستيراد النسخة الاحتياطية).
 */
public class RaqeebNativeModule extends ReactContextBaseJavaModule {
  private static final int PICK_REQUEST = 4271;
  private static final int MAX_FILE_BYTES = 25 * 1024 * 1024;

  private Promise pickPromise;

  private final ActivityEventListener activityListener = new BaseActivityEventListener() {
    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
      if (requestCode != PICK_REQUEST) {
        return;
      }
      final Promise promise = pickPromise;
      pickPromise = null;
      if (promise == null) {
        return;
      }
      if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
        promise.reject("CANCELED", "canceled");
        return;
      }
      final Uri uri = data.getData();
      new Thread(new Runnable() {
        @Override
        public void run() {
          try {
            InputStream in = getReactApplicationContext().getContentResolver().openInputStream(uri);
            if (in == null) {
              promise.reject("READ_FAILED", "cannot open file");
              return;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int read;
            int total = 0;
            while ((read = in.read(buffer)) != -1) {
              total += read;
              if (total > MAX_FILE_BYTES) {
                in.close();
                promise.reject("TOO_LARGE", "file too large");
                return;
              }
              out.write(buffer, 0, read);
            }
            in.close();
            promise.resolve(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
          } catch (Exception e) {
            promise.reject("READ_FAILED", e.getMessage(), e);
          }
        }
      }).start();
    }
  };

  public RaqeebNativeModule(ReactApplicationContext reactContext) {
    super(reactContext);
    reactContext.addActivityEventListener(activityListener);
  }

  @Override
  public String getName() {
    return "RaqeebNative";
  }

  @ReactMethod
  public void scanBarcode(final Promise promise) {
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "no activity");
      return;
    }
    try {
      GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
          .setBarcodeFormats(
              Barcode.FORMAT_EAN_13,
              Barcode.FORMAT_EAN_8,
              Barcode.FORMAT_UPC_A,
              Barcode.FORMAT_UPC_E,
              Barcode.FORMAT_CODE_128,
              Barcode.FORMAT_CODE_39,
              Barcode.FORMAT_CODE_93,
              Barcode.FORMAT_ITF,
              Barcode.FORMAT_QR_CODE)
          .enableAutoZoom()
          .build();
      GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(activity, options);
      scanner.startScan()
          .addOnSuccessListener(barcode -> {
            String value = barcode.getRawValue();
            if (value == null) {
              value = barcode.getDisplayValue();
            }
            promise.resolve(value);
          })
          .addOnCanceledListener(() -> promise.reject("CANCELED", "canceled"))
          .addOnFailureListener(e -> promise.reject("SCAN_FAILED", e.getMessage(), e));
    } catch (Exception e) {
      promise.reject("SCAN_FAILED", e.getMessage(), e);
    }
  }

  @ReactMethod
  public void pickFile(final Promise promise) {
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "no activity");
      return;
    }
    if (pickPromise != null) {
      promise.reject("BUSY", "picker already open");
      return;
    }
    pickPromise = promise;
    try {
      Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType("*/*");
      activity.startActivityForResult(intent, PICK_REQUEST);
    } catch (Exception e) {
      pickPromise = null;
      promise.reject("PICK_FAILED", e.getMessage(), e);
    }
  }
}
