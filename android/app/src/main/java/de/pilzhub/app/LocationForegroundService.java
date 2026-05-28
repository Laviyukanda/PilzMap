package de.pilzhub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class LocationForegroundService extends Service {

    static final String CHANNEL_ID    = "pilzhub_gps";
    static final int    NOTIF_ID      = 42;

    // Statischer Callback: LocationPlugin trägt sich hier ein
    public interface LocationCallback {
        void onLocation(double lat, double lng, double alt, float acc);
    }
    public static LocationCallback pluginCallback = null;

    private LocationManager locationManager;

    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(Location loc) {
            if (pluginCallback != null) {
                pluginCallback.onLocation(
                    loc.getLatitude(),
                    loc.getLongitude(),
                    loc.getAltitude(),
                    loc.getAccuracy()
                );
            }
        }
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {}
        @Override public void onStatusChanged(String p, int s, Bundle e) {}
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notif = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, notif);
        }
        startGps();
        return START_STICKY;
    }

    private void startGps() {
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                3000,   // min 3 Sekunden
                5,      // min 5 Meter
                listener
            );
            // Netzwerk als Fallback
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, 5000, 10, listener);
            }
        } catch (SecurityException e) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            locationManager.removeUpdates(listener);
        }
        pluginCallback = null;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, openApp, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🍄 Pilz-Hub – GPS aktiv")
            .setContentText("Route wird aufgezeichnet…")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createNotificationChannel() {
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "GPS Aufzeichnung",
            NotificationManager.IMPORTANCE_LOW
        );
        ch.setDescription("Läuft im Hintergrund während der Routenaufzeichnung");
        getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
}
