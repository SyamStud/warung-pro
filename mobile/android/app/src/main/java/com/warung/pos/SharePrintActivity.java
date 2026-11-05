package com.warung.pos;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * Share-sheet entry point that prints without showing the app.
 *
 * The activity hosts the usual Capacitor bridge so the ESC/POS encoder and the
 * printer plugin keep a single implementation, but the window is translucent,
 * untouchable and carries a fully transparent WebView. The user stays in the
 * app they shared from; once JS reports the result the activity finishes and
 * that app comes back.
 *
 * It lives in its own task (`taskAffinity=""`) so sharing never brings the
 * visible Warung POS task to the front.
 */
public class SharePrintActivity extends BridgeActivity {

    /**
     * Printing an image can take a while on a slow Bluetooth link; this is the
     * hard limit after which an invisible-but-stuck activity closes itself.
     */
    private static final long WATCHDOG_MS = 120_000L;

    /** How long the WebView gets to call back before we show the app instead. */
    private static final long JS_GRACE_MS = 15_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable watchdog = this::finish;
    private final Runnable jsFallback = this::openAppIfJsSilent;

    private long createdMillis;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before the bridge starts so the share intent that launched
        // this activity is waiting in the plugin queue.
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);

        // BridgeActivity has just painted an opaque window; make it see-through.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        );

        View decor = getWindow().getDecorView();
        decor.setBackgroundColor(Color.TRANSPARENT);

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setAlpha(0f);
        }

        createdMillis = System.currentTimeMillis();
        handler.postDelayed(jsFallback, JS_GRACE_MS);
        handler.postDelayed(watchdog, WATCHDOG_MS);
    }

    /**
     * A share must never disappear. If the WebView did not even say hello, the
     * silent path is broken on this device, so fall back to the visible app.
     */
    private void openAppIfJsSilent() {
        if (ShareTargetPlugin.contactedSince(createdMillis)) {
            return;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
        close();
    }

    /** Ends the hidden activity after JS finished (or gave up) printing. */
    public void close() {
        handler.removeCallbacks(watchdog);
        handler.removeCallbacks(jsFallback);
        finish();
    }

    /**
     * BridgeActivity hard-codes AppTheme.NoActionBar right before it inflates
     * the content view. Swapping themes at that same point is what lets the
     * window stay translucent; doing it after `super.onCreate` would be too late.
     */
    @Override
    public void setTheme(int resid) {
        super.setTheme(R.style.AppTheme_Transparent);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(watchdog);
        handler.removeCallbacks(jsFallback);
        super.onDestroy();
    }
}
