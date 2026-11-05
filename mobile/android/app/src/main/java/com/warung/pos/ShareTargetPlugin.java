package com.warung.pos;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.Log;
import android.widget.Toast;
import androidx.core.content.IntentCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Receives images shared from other apps (ACTION_SEND / ACTION_SEND_MULTIPLE)
 * and copies them into the app cache so the WebView can read them.
 *
 * Capacitor's App plugin only handles VIEW intents, so the share sheet needs a
 * small plugin of its own. The native side never decodes the picture: it just
 * stores the bytes and hands back a path plus a mime type.
 *
 * The same activity can be the hidden SharePrintActivity (direct print) or the
 * normal MainActivity (setup fallback). The queue is static so pictures survive
 * that hand-off: the hidden side peeks, and if it cannot print it opens the app,
 * whose own plugin instance collects the very same batch.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static final String TAG = "ShareTarget";
    private static final long MAX_IMAGE_BYTES = 20L * 1024L * 1024L;

    /** Images waiting to be collected by JS (cold start, or before listeners exist). */
    private static final List<JSObject> pending = new ArrayList<>();

    private static int counter = 0;

    /**
     * Last time the hidden activity's JavaScript talked to us. Used as a safety
     * net: if the WebView never boots, the share must still open the app instead
     * of vanishing.
     */
    private static volatile long lastContactAt = 0L;

    private static void noteContact() {
        lastContactAt = System.currentTimeMillis();
    }

    static boolean contactedSince(long timestamp) {
        return lastContactAt >= timestamp;
    }

    /** True while this plugin belongs to the hidden direct-print activity. */
    private boolean isHeadless() {
        return getActivity() instanceof SharePrintActivity;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);

        List<JSObject> images = readImages(intent);
        if (images.isEmpty()) {
            return;
        }

        synchronized (pending) {
            pending.addAll(images);
        }

        JSObject payload = new JSObject();
        payload.put("images", new JSArray(images));
        // Not retained: JS calls getPending() on startup, so a cold start never
        // depends on a listener being registered in time.
        notifyListeners("shared", payload, false);
    }

    /** Returns and clears the images that arrived before the listener was ready. */
    @PluginMethod
    public void getPending(PluginCall call) {
        noteContact();

        List<JSObject> images;

        synchronized (pending) {
            images = new ArrayList<>(pending);
            pending.clear();
        }

        JSObject result = new JSObject();
        result.put("images", new JSArray(images));
        call.resolve(result);
    }

    /** Like {@link #getPending}, but the pictures stay queued for a retry. */
    @PluginMethod
    public void peek(PluginCall call) {
        noteContact();

        JSObject result = new JSObject();

        synchronized (pending) {
            result.put("images", new JSArray(new ArrayList<>(pending)));
        }

        call.resolve(result);
    }

    /**
     * Drops printed pictures from the queue. Passing the paths (rather than
     * clearing everything) keeps a share that arrived mid-print intact.
     */
    @PluginMethod
    public void acknowledge(PluginCall call) {
        noteContact();

        JSArray paths = call.getArray("paths");
        Set<String> printed = new HashSet<>();

        if (paths != null) {
            for (int index = 0; index < paths.length(); index += 1) {
                printed.add(paths.optString(index));
            }
        }

        synchronized (pending) {
            if (printed.isEmpty()) {
                pending.clear();
            } else {
                pending.removeIf((image) -> printed.contains(image.optString("path")));
            }
        }

        call.resolve();
    }

    /** Lets JS decide whether to render the app or the invisible print flow. */
    @PluginMethod
    public void isHeadless(PluginCall call) {
        noteContact();

        JSObject result = new JSObject();
        result.put("headless", isHeadless());
        call.resolve(result);
    }

    /**
     * Closes the hidden activity. A toast may be shown first so a silent share
     * still gives the user a small confirmation.
     */
    @PluginMethod
    public void closeHeadless(PluginCall call) {
        noteContact();

        String message = call.getString("message");

        if (message != null && !message.isEmpty()) {
            Toast.makeText(getContext(), message, Toast.LENGTH_SHORT).show();
        }

        if (getActivity() instanceof SharePrintActivity) {
            SharePrintActivity activity = (SharePrintActivity) getActivity();
            // Give the resolved call a moment to travel back to JS before the
            // WebView is torn down.
            new Handler(Looper.getMainLooper()).postDelayed(activity::close, 200);
        }

        call.resolve();
    }

    /**
     * Gives up on the silent path and brings the normal app forward, with the
     * pictures still queued so the print page can show them for setup.
     */
    @PluginMethod
    public void openApp(PluginCall call) {
        noteContact();

        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        getContext().startActivity(intent);

        if (getActivity() instanceof SharePrintActivity) {
            final SharePrintActivity activity = (SharePrintActivity) getActivity();

            // Let the app window animate in before the invisible one goes away.
            new Handler(Looper.getMainLooper()).postDelayed(activity::close, 400);
        }

        call.resolve();
    }

    private List<JSObject> readImages(Intent intent) {
        List<JSObject> images = new ArrayList<>();

        if (intent == null) {
            return images;
        }

        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return images;
        }

        String type = intent.getType();
        if (type != null && !type.startsWith("image/")) {
            return images;
        }

        List<Uri> uris = new ArrayList<>();

        if (Intent.ACTION_SEND.equals(action)) {
            Uri uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            if (uri != null) {
                uris.add(uri);
            }
        } else {
            ArrayList<Uri> shared = IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            if (shared != null) {
                uris.addAll(shared);
            }
        }

        for (Uri uri : uris) {
            JSObject image = storeImage(uri);
            if (image != null) {
                images.add(image);
            }
        }

        return images;
    }

    private JSObject storeImage(Uri uri) {
        if (uri == null) {
            return null;
        }

        try {
            String mimeType = getContext().getContentResolver().getType(uri);
            if (mimeType != null && !mimeType.startsWith("image/")) {
                return null;
            }

            File directory = new File(getContext().getCacheDir(), "shared-images");
            if (!directory.exists() && !directory.mkdirs()) {
                Log.w(TAG, "Cannot create the shared-images directory");
                return null;
            }

            pruneOldImages(directory);

            File destination = new File(directory, "share-" + System.currentTimeMillis() + "-" + counter++ + "." + extensionFor(mimeType));

            try (
                InputStream input = getContext().getContentResolver().openInputStream(uri);
                FileOutputStream output = new FileOutputStream(destination)
            ) {
                if (input == null) {
                    return null;
                }

                byte[] buffer = new byte[8192];
                long total = 0;
                int read;

                while ((read = input.read(buffer)) > 0) {
                    total += read;

                    if (total > MAX_IMAGE_BYTES) {
                        Log.w(TAG, "Shared image is larger than the limit; ignoring it");
                        //noinspection ResultOfMethodCallIgnored
                        destination.delete();
                        return null;
                    }

                    output.write(buffer, 0, read);
                }
            }

            JSObject image = new JSObject();
            image.put("path", destination.getAbsolutePath());
            image.put("mimeType", mimeType != null ? mimeType : "image/*");

            String name = displayName(uri);
            if (name != null) {
                image.put("name", name);
            }

            return image;
        } catch (Exception exception) {
            Log.w(TAG, "Failed to read a shared image", exception);
            return null;
        }
    }

    /** Copies stay a week at most; the OS cache alone is not guaranteed to be trimmed. */
    private void pruneOldImages(File directory) {
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }

        long cutoff = System.currentTimeMillis() - 7L * 24L * 60L * 60L * 1000L;

        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) {
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            }
        }
    }

    private String displayName(Uri uri) {
        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    return cursor.getString(index);
                }
            }
        } catch (Exception ignored) {
            // Some providers do not implement queries; the file name is optional.
        }

        return null;
    }

    private String extensionFor(String mimeType) {
        if (mimeType == null) {
            return "img";
        }

        switch (mimeType) {
            case "image/png":
                return "png";
            case "image/webp":
                return "webp";
            case "image/gif":
                return "gif";
            case "image/heic":
            case "image/heif":
                return "heic";
            default:
                return "jpg";
        }
    }
}
