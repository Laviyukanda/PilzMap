package de.pilzhub.app;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // Icons weiß auf dunklem Header
        WindowInsetsControllerCompat ctrl = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView());
        ctrl.setAppearanceLightStatusBars(false);

        // Alle Views in der Hierarchie: fitsSystemWindows deaktivieren
        disableFitsSystemWindows(getWindow().getDecorView());
    }

    private void disableFitsSystemWindows(View view) {
        view.setFitsSystemWindows(false);
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                disableFitsSystemWindows(group.getChildAt(i));
            }
        }
    }
}
