// === 0. Koordinatensystem für LUBW-Daten (EPSG:25832) definieren ===
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs");

// === 1. Karte initialisieren ===
const map = L.map('map').setView([48.9, 9.2], 8);

// === 2. Basiskarte (OpenStreetMap) hinzufügen ===
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// === 2.1. Leere Sammelmappen & WMS anlegen ===
const waldLayer = L.layerGroup().addTo(map);
const fundstellenLayer = L.layerGroup().addTo(map); 
const stationenLayer = L.layerGroup().addTo(map); // NEU: Unsere Sammelmappe für die Wetterpunkte
const naturschutzLayer = L.layerGroup(); // Ohne .addTo(map), damit die Karte am Start nicht zu voll ist
const nationalparkLayer = L.layerGroup(); // Ohne .addTo(map)

const regenRadarDWD = L.tileLayer.wms('https://maps.dwd.de/geoserver/dwd/wms', {
    layers: 'dwd:Niederschlagsradar', 
    format: 'image/png',
    transparent: true,
    opacity: 0.5,
    attribution: '&copy; DWD'
});

// === 2.2. Schaltzentrale (Menü) ===
const basisKarten = { "Straßenkarte (OSM)": osm };
const overlayKarten = {
    "Waldschutzgebiete": waldLayer,
    "🌿 Naturschutzgebiete": naturschutzLayer,
    "🦅 Nationalparks": nationalparkLayer,
    "Fundstellen": fundstellenLayer,
    "🌧️ Regenradar Live (DWD)": regenRadarDWD,
    "📊 7-Tage-Regen (Messpunkte)": stationenLayer // NEU: Der Schrotflinten-Modus im Menü!
};
L.control.layers(basisKarten, overlayKarten).addTo(map);

// === 3. Waldschutzgebiete laden ===
fetch('PilzMap/waldschutzgebiete.json')
    .then(function(antwort) { return antwort.json(); })
    .then(function(waldDaten) {
        L.geoJSON(waldDaten, {
            style: function(feature) {
                let waldFarbe = '#2ca25f'; 
                if (feature.properties.SCHUTZSTAT === "Bannwald") { waldFarbe = '#ff0000'; }
                return { color: waldFarbe, fillColor: waldFarbe, weight: 2, fillOpacity: 0.5 };
            },
            onEachFeature: function(feature, layer) {
                if (feature.properties && feature.properties.OBJEKT) {
                    const typ = feature.properties.SCHUTZSTAT || "Waldschutzgebiet";
                    const name = feature.properties.OBJEKT;
                    layer.bindPopup(`🍄 <b>${typ}:</b><br>${name}`);
                }
            }
        }).addTo(waldLayer);
    })
    .catch(function(fehler) { console.error("Huch, der Wald-Postbote ist gestolpert:", fehler); });

// === 3.1 Naturschutzgebiete laden ===
fetch('PilzMap/naturschutzgebiet.json')
    .then(function(antwort) { return antwort.json(); })
    .then(function(nsgDaten) {
        L.geoJSON(nsgDaten, {
            // NEU: Koordinaten live von UTM32N in WGS84 (GPS) umrechnen
            coordsToLatLng: function(coords) {
                const umgerechnet = proj4("EPSG:25832", "EPSG:4326", [coords[0], coords[1]]);
                return L.latLng(umgerechnet[1], umgerechnet[0]);
            },
            style: { color: '#ff0000', fillColor: '#ff0000', weight: 2, fillOpacity: 0.5 }, // Orange
            onEachFeature: function(feature, layer) {
                // Wir versuchen NAME oder OBJEKT auszulesen, je nachdem wie die Datei aufgebaut ist
                const name = feature.properties.NAME || feature.properties.OBJEKT || "Unbenanntes Gebiet";
                layer.bindPopup(`🌿 <b>Naturschutzgebiet:</b><br>${name}`);
            }
        }).addTo(naturschutzLayer);
    })
    .catch(function(fehler) { console.warn("Naturschutzgebiete-Datei fehlt noch:", fehler); });

// === 3.2 Nationalparks laden ===
fetch('PilzMap/nationalpark.json')
    .then(function(antwort) { return antwort.json(); })
    .then(function(npDaten) {
        L.geoJSON(npDaten, {
            // NEU: Koordinaten live von UTM32N in WGS84 (GPS) umrechnen
            coordsToLatLng: function(coords) {
                const umgerechnet = proj4("EPSG:25832", "EPSG:4326", [coords[0], coords[1]]);
                return L.latLng(umgerechnet[1], umgerechnet[0]);
            },
            style: { color: '#ff0000', fillColor: '#ff0000', weight: 2, fillOpacity: 0.5 }, // Lila
            onEachFeature: function(feature, layer) {
                const name = feature.properties.NAME || feature.properties.OBJEKT || "Unbenanntes Gebiet";
                layer.bindPopup(`🦅 <b>Nationalpark:</b><br>${name}`);
            }
        }).addTo(nationalparkLayer);
    })
    .catch(function(fehler) { console.warn("Nationalparks-Datei fehlt noch:", fehler); });

// === 4. Live-Standort abfragen ===
function standortGefunden(e) {
    const standortMarker = L.marker(e.latlng).addTo(map).bindPopup("📍 Du bist hier!");
    
    // Kurz warten, bis die Karte fertig gezoomt ist, bevor das Popup öffnet
    setTimeout(function() { standortMarker.openPopup(); }, 800);

    L.circle(e.latlng, e.accuracy, { color: 'blue', fillOpacity: 0.1 }).addTo(map);

    const wetterUrl = `https://api.open-meteo.com/v1/forecast?latitude=${e.latlng.lat}&longitude=${e.latlng.lng}&current_weather=true`;
    
    // NEU: Wir protokollieren die URL in der Konsole
    console.log("Wetter wird angefragt unter:", wetterUrl);

    fetch(wetterUrl)
        .then(function(antwort) { return antwort.json(); })
        .then(function(daten) {
            // NEU: Wir schauen uns das Paket an
            console.log("Wetter-Antwort erhalten:", daten); 
            
            if(daten.current_weather) {
                const temp = daten.current_weather.temperature;
                // Wir nutzen ?? statt ||, damit 0 Meter Meereshöhe nicht als "Unbekannt" gewertet wird
                const hoehe = daten.elevation ?? "Unbekannt"; 
                
                const anzeigeFeld = document.getElementById('wetter-anzeige');
                if(anzeigeFeld) { 
                    anzeigeFeld.innerHTML = `${temp} °C | 🏔️ Höhe: ${hoehe} Meter`; 
                }
            } else {
                console.error("Das Wetter-Paket war leer!", daten);
            }
        })
        .catch(function(fehler) {
            // NEU: Wenn der Kellner stolpert, sagt er im Kasten Bescheid!
            console.error("Wetter-Verbindung fehlgeschlagen:", fehler);
            const anzeigeFeld = document.getElementById('wetter-anzeige');
            if(anzeigeFeld) { 
                anzeigeFeld.innerHTML = `Wetter offline ❌`; 
            }
        });
}   

function standortFehler(e) {
    alert("GPS-Fehler: " + e.message);
    console.error("GPS-Fehler Details:", e);
}

// Wir verknüpfen die Events und bitten die Karte um die GPS-Ortung
map.on('locationfound', standortGefunden);
map.on('locationerror', standortFehler);
map.locate({setView: true, maxZoom: 13});

// === 5. Live-Wetter, Ortsname & 7-Tage-Regen per Mausklick ===
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const ladePopup = L.popup()
        .setLatLng(e.latlng)
        .setContent("⏳ Assistenten suchen Daten...")
        .openOn(map);

    // NEU: Wir fragen bei Open-Meteo zusätzlich die letzten 7 Tage Niederschlag ab!
    // Die Zeitzone ist wichtig, damit die Tagesgrenzen für Deutschland stimmen.
    const wetterUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Europe/Berlin`;
    const ortsUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    fetch(ortsUrl)
        .then(function(antwort) { return antwort.json(); })
        .then(function(ortsDaten) {
            let ortsName = "Natur pur";
            if (ortsDaten.address) {
                ortsName = ortsDaten.address.city || ortsDaten.address.town || ortsDaten.address.village || ortsDaten.address.municipality || "Natur pur";
            }

            fetch(wetterUrl)
                .then(function(antwort) { return antwort.json(); })
                .then(function(wetterDaten) {
                    if(wetterDaten.current_weather && wetterDaten.daily) {
                        const temperatur = wetterDaten.current_weather.temperature;
                        const wind = wetterDaten.current_weather.windspeed;
                        
                        // NEU: Regen der letzten 7 Tage zusammenrechnen
                        const regenMengen = wetterDaten.daily.precipitation_sum;
                        let regenSumme = 0;
                        
                        // Wir summieren die Einträge der ersten 7 Tage (Tag 0 bis 6)
                        for(let i = 0; i < 7; i++) {
                            regenSumme += regenMengen[i] || 0;
                        }
                        
                        // Auf eine Kommastelle runden
                        regenSumme = Math.round(regenSumme * 10) / 10;

                        ladePopup.setContent(`
                            📍 <b>${ortsName}</b><br>
                            🌡️ Temperatur: ${temperatur} °C<br>
                            💨 Wind: ${wind} km/h<br>
                            <hr style="margin: 5px 0;">
                            🌧️ <b>Regen (letzte 7 Tage): ${regenSumme} mm</b>
                        `);
                    } else {
                        ladePopup.setContent(`📍 <b>${ortsName}</b><br>❌ Keine Wetterdaten gefunden.`);
                    }
                })
                .catch(function(fehler) { 
                    console.error(fehler);
                    ladePopup.setContent("❌ Wetter-Daten offline."); 
                });
        })
        .catch(function() { 
            ladePopup.setContent("❌ Adress-Server überlastet. Bitte kurz warten."); 
        });
});

// === 6. Eigene Fundstellen markieren (Rechtsklick) ===
map.on('contextmenu', function(e) {
    const notiz = prompt("🍄 Pilz gefunden! Was hast du hier entdeckt?");
    if (notiz) {
        L.marker(e.latlng)
            .addTo(fundstellenLayer)
            .bindPopup(`🎒 <b>Meine Fundstelle:</b><br>${notiz}`)
            .openPopup();
    }
});

// === 8. Schrotflinten-Modus: 7-Tage-Regen an festen Stationen in BW ===
// === 8. Schrotflinten-Modus: 7-Tage-Regen an 30 festen Stationen in BW (Gänsemarsch-Laden) ===

// Ein dichtes Netz aus 30 strategisch verteilten Koordinaten in Baden-Württemberg
const wetterStationen = [
    // --- Norden ---
    { name: "Mannheim (Rheinebene)", lat: 49.4875, lng: 8.4660 },
    { name: "Heidelberg (Odenwald)", lat: 49.3988, lng: 8.6724 },
    { name: "Bad Mergentheim (Taubergrund)", lat: 49.4904, lng: 9.7733 },
    { name: "Heilbronn (Unterland)", lat: 49.1427, lng: 9.2109 },
    { name: "Schwäbisch Hall (Hohenlohe)", lat: 49.1123, lng: 9.7375 },
    { name: "Crailsheim (Hohenloher Ebene)", lat: 49.1368, lng: 10.0712 },

    // --- Mitte / Westen ---
    { name: "Karlsruhe (Oberrhein)", lat: 49.0069, lng: 8.4037 },
    { name: "Pforzheim (Nordschwarzwald-Rand)", lat: 48.8950, lng: 8.6976 },
    { name: "Baden-Baden (Nordschwarzwald)", lat: 48.7620, lng: 8.2415 },
    { name: "Stuttgart (Mittlerer Neckar)", lat: 48.7758, lng: 9.1829 },
    { name: "Göppingen (Voralb)", lat: 48.7026, lng: 9.6525 },
    { name: "Offenburg (Ortenau)", lat: 48.4716, lng: 7.9426 },
    { name: "Lahr (Schwarzwald-Vorland)", lat: 48.3375, lng: 7.8694 },
    { name: "Freudenstadt (Schwarzwaldhochstraße)", lat: 48.4643, lng: 8.4116 },
    { name: "Tübingen (Neckar-Alb)", lat: 48.5216, lng: 9.0576 },
    { name: "Reutlingen (Albaufstieg)", lat: 48.4900, lng: 9.2100 },

    // --- Osten ---
    { name: "Aalen (Ostalb)", lat: 48.8378, lng: 10.0936 },
    { name: "Heidenheim (Schwäbische Alb)", lat: 48.6773, lng: 10.1534 },
    { name: "Ulm (Donau-Iller)", lat: 48.3984, lng: 9.9915 },

    // --- Süden / Südschwarzwald ---
    { name: "Rottweil (Neckarquelle)", lat: 48.1648, lng: 8.6253 },
    { name: "Freiburg (Breisgau)", lat: 47.9959, lng: 7.8522 },
    { name: "Titisee-Neustadt (Hochschwarzwald)", lat: 47.9150, lng: 8.2120 },
    { name: "Villingen-Schwenningen (Schwarzwald-Baar)", lat: 48.0583, lng: 8.4552 },
    { name: "Sigmaringen (Obere Donau)", lat: 48.0872, lng: 9.2173 },
    { name: "Tuttlingen (Donautal)", lat: 47.9850, lng: 8.8183 },
    { name: "Lörrach (Dreiländereck)", lat: 47.6146, lng: 7.6628 },
    { name: "Waldshut-Tiengen (Hochrhein)", lat: 47.6231, lng: 8.2144 },

    // --- Bodensee / Oberschwaben ---
    { name: "Biberach (Oberschwaben)", lat: 48.0953, lng: 9.7952 },
    { name: "Ravensburg (Schussental)", lat: 47.7811, lng: 9.6130 },
    { name: "Konstanz (Bodensee)", lat: 47.6592, lng: 9.1756 }
];

// Wir schicken unsere Boten nacheinander los (Throttling / Staggering)
wetterStationen.forEach(function(station, index) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${station.lat}&longitude=${station.lng}&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Europe/Berlin`;

    // Timeout: Index 0 startet sofort, Index 1 nach 200ms, Index 2 nach 400ms...
    setTimeout(function() {
        fetch(url)
            .then(function(antwort) { 
                if (!antwort.ok) {
                    throw new Error("Server-Blockade: " + antwort.status);
                }
                return antwort.json(); 
            })
            .then(function(daten) {
                if (daten.daily && daten.daily.precipitation_sum) {
                    // Regen der letzten 7 Tage berechnen
                    let summe = 0;
                    for(let i = 0; i < 7; i++) {
                        summe += daten.daily.precipitation_sum[i] || 0;
                    }
                    summe = Math.round(summe * 10) / 10;

                    // Farb-Logik für Pilzsammler
                    let farbe = '#ff3333'; // Rot = Staubtrocken (< 5 mm)
                    if (summe >= 5) farbe = '#ffcc00';  // Gelb = Mäßig (5 - 15 mm)
                    if (summe >= 15) farbe = '#2ca25f'; // Grün = Gutes Pilzwetter (15 - 30 mm)
                    if (summe >= 30) farbe = '#0055ff'; // Blau = Sehr nass (> 30 mm)

                    // Marker auf die Karte setzen
                    L.circleMarker([station.lat, station.lng], {
                        radius: 12,          // Leicht kleiner, da wir jetzt mehr Stationen haben
                        fillColor: farbe,
                        color: '#ffffff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.85
                    })
                    .bindPopup(`
                        <div style="text-align: center;">
                            📍 <b>${station.name}</b><br>
                            <hr style="margin: 5px 0;">
                            🌧️ 7-Tage-Regen:<br>
                            <span style="font-size: 1.2em; font-weight: bold; color: ${farbe === '#ffffff' ? '#000' : farbe}; text-shadow: 1px 1px 1px rgba(0,0,0,0.3);">
                                ${summe} mm
                            </span>
                        </div>
                    `)
                    .addTo(stationenLayer); // Wichtig: Kommt in unsere Sammelmappe aus Schritt 1!
                }
            })
            .catch(function(fehler) {
                console.warn(`⏳ Station ${station.name} konnte nicht geladen werden:`, fehler);
            });
            
    }, index * 200); // 200 Millisekunden Abstand pro Station
});

const regenLegende = L.control({ position: 'topright' });

regenLegende.onAdd = function(map) {
    // Wir erstellen das Element komplett neu in Leaflet - das ist fehlerfrei!
    const div = L.DomUtil.create('div', 'info legend');
    
    // Wir stylen das Fenster genau wie du es in deiner HTML gemacht hattest
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    div.style.fontFamily = 'sans-serif';
    div.style.fontSize = '14px';
    div.style.lineHeight = '1.8';

    // Wir befüllen es mit deinem Text und den Farben
    div.innerHTML = `
        <b>🌧️ 7-Tage-Regen</b><br>
        <i style="background: #ff3333; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> &lt; 5 mm (Trocken)<br>
        <i style="background: #ffcc00; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> 5 - 15 mm (Mäßig)<br>
        <i style="background: #2ca25f; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> 15 - 30 mm (Gut)<br>
        <i style="background: #0055ff; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> &gt; 30 mm (Sehr nass)
    `;
    
    return div;
};

// === Die Legende SOFORT auf die Karte setzen ===
// Da die Wetterpunkte standardmäßig an sind (Zeile 12), muss auch die Legende sofort an sein!
regenLegende.addTo(map);

// === Verbesserte Event-Listener (Bombensicher) ===
map.on('overlayadd', function(event) {
    // Pro-Tipp: Wir prüfen direkt das Layer-Objekt, nicht mehr den fehleranfälligen Text!
    if (event.layer === stationenLayer) {
        regenLegende.addTo(map); // Zeige Legende auf Karte
        
        const infoBox = document.getElementById('regen-info-box');
        if (infoBox) infoBox.style.display = 'block'; // Zeige HTML-Box außerhalb
    }
});

map.on('overlayremove', function(event) {
    if (event.layer === stationenLayer) {
        map.removeControl(regenLegende); // Entferne Legende
        
        const infoBox = document.getElementById('regen-info-box');
        if (infoBox) infoBox.style.display = 'none'; // Verstecke HTML-Box außerhalb
    }
});

// === 7. Das Suchfeld (Geocoder) einbauen ===
// Sicherheits-Check, falls die HTML-Einbindung fehlschlägt
if (typeof L.Control.geocoder === 'function') {
    L.Control.geocoder({
        position: 'topleft',
        placeholder: 'Ort oder Wald suchen...'
    }).addTo(map);
} else {
    console.warn("Suchfeld-Plugin wurde nicht geladen! Hast du es in der index.html eingebunden?");
}
