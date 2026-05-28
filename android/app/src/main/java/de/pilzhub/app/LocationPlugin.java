package de.pilzhub.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocationBackground")
public class LocationPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        // Basis-Permission prüfen
        if (ContextCompat.checkSelfPermission(getContext(),
                Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("GPS-Berechtigung fehlt");
            return;
        }

        // Callback registrieren: Standorte direkt an JS weiterleiten
        LocationForegroundService.pluginCallback = (lat, lng, alt, acc) -> {
            JSObject data = new JSObject();
            data.put("lat", lat);
            data.put("lng", lng);
            data.put("alt", alt);
            data.put("acc", acc);
            notifyListeners("locationUpdate", data, true);
        };

        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        getContext().stopService(new Intent(getContext(), LocationForegroundService.class));
        LocationForegroundService.pluginCallback = null;
        call.resolve();
    }
}
