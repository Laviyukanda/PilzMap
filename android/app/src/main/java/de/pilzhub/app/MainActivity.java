package de.pilzhub.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge-to-edge: WebView zeichnet unter Status- und Navigationsleiste.
        // CSS env(safe-area-inset-*) übernimmt dann das korrekte Spacing.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
