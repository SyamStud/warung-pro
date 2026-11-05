package com.warung.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before the bridge starts so a share that launched the app
        // is already waiting in the plugin's pending queue.
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
