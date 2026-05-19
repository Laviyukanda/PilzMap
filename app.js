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
const stationenLayer = L.layerGroup(); // NEU: Unsere Sammelmappe für die Wetterpunkte
const naturschutzLayer = L.layerGroup().addTo(map); 
const nationalparkLayer = L.layerGroup().addTo(map); 

//===2.1.1 Schutzgebiete
waldLayer.isSchutzgebiet = true;
waldLayer.isSchutzgebiet = true;
nationalparkLayer.isSchutzgebiet = true;

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
fetch('waldschutzgebiete.json')
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
fetch('naturschutzgebiet.json')
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
fetch('nationalpark.json')
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

// === 6. Supabase (Cloud-Datenbank) initialisieren ===
const supabaseUrl = 'https://htaftyhatzvvdtatmapk.supabase.co';
const supabaseKey = 'sb_publishable_uV0gGE5DEujJncxSoXcCug_B9SM4VXR';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// === 6.0. Globaler Speicher für unsere Pilz-App ===
window.pilzDatenSpeicher = {}; // Hier merken wir uns alle geladenen Pilze
window.pilzMarkerSpeicher = {}; // Hier merken wir uns die Marker auf der Karte

// === 6.1. Neues Fund-Formular (Rechtsklick) ===
map.on('contextmenu', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // NEU: 'multiple' erlaubt die Auswahl mehrerer Dateien
    const formHtml = `
        <div style="text-align: center; font-family: sans-serif; min-width: 220px;">
            <h4 style="margin: 0 0 10px 0;">🍄 Neuer Fund</h4>
            <input type="text" id="neu-notiz" placeholder="Welcher Pilz? / Notizen" style="width: 100%; margin-bottom: 10px; padding: 5px;"><br>
            <select id="neu-geniessbarkeit" style="width: 100%; margin-bottom: 10px; padding: 5px;">
                <option value="Unbekannt">❓ Unbekannt</option>
                <option value="Essbar">🍽️ Essbar</option>
                <option value="Ungenießbar">🤢 Ungenießbar</option>
                <option value="Giftig">☠️ Giftig</option>
            </select><br>
            <label style="font-size: 0.8em; display:block; text-align:left;">Bis zu 3 Fotos:</label>
            <input type="file" id="neu-foto" accept="image/*" multiple style="width: 100%; margin-bottom: 10px;"><br>
            <button onclick="speichereNeuenFund(${lat}, ${lng})" style="width: 100%; padding: 8px; background: #2ca25f; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Speichern & Hochladen
            </button>
            <div id="upload-status" style="margin-top: 10px; font-size: 0.9em; font-weight: bold;"></div>
        </div>
    `;

    L.popup().setLatLng(e.latlng).setContent(formHtml).openOn(map);
});

// === 6.2. CREATE: Neuen Fund in die Cloud laden (mit Fehler-Scanner) ===
window.speichereNeuenFund = async function(lat, lng) {
    const notizFeld = document.getElementById('neu-notiz').value;
    const genFeld = document.getElementById('neu-geniessbarkeit').value;
    const dateien = document.getElementById('neu-foto').files;
    const statusText = document.getElementById('upload-status');

    console.log("Versuche neuen Fund zu speichern. Ausgewählte Dateien:", dateien.length);

    if (dateien.length > 3) {
        statusText.innerHTML = "❌ Maximal 3 Fotos erlaubt!"; return;
    }

    statusText.innerHTML = "⏳ Lade hoch... (das kann dauern)";
    let urls = [null, null, null]; 

    // Wir laden die Bilder nacheinander hoch
    for (let i = 0; i < Math.min(dateien.length, 3); i++) {
        const dateiName = `${Date.now()}_${dateien[i].name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        console.log(`Starte Upload für Bild ${i+1}: ${dateiName}`);
        
        const { data, error } = await _supabase.storage.from('pilzfotos').upload(dateiName, dateien[i]);
        
        if (error) {
            console.error(`🚨 FEHLER beim Upload von Bild ${i+1}:`, error);
            statusText.innerHTML = `❌ Fehler bei Bild ${i+1}`;
            return; // Wir brechen hier hart ab, damit wir den Fehler sehen!
        } else {
            console.log(`✅ Bild ${i+1} erfolgreich in Storage geladen!`);
            urls[i] = _supabase.storage.from('pilzfotos').getPublicUrl(dateiName).data.publicUrl;
        }
    }

    console.log("Uploads fertig. Generierte URLs:", urls);

    // Ab in die Datenbank damit!
    const { data, error } = await _supabase.from('pilze').insert([{ 
        lat: lat, lng: lng, notiz: notizFeld, geniessbarkeit: genFeld,
        foto_url: urls[0], foto_url_2: urls[1], foto_url_3: urls[2]
    }]).select(); 

    if (error) {
        console.error("🚨 FEHLER beim Schreiben in die Datenbank:", error);
        statusText.innerHTML = "❌ Datenbank-Fehler!";
    } else {
        console.log("✅ Eintrag erfolgreich in der Datenbank erstellt!", data);
        statusText.innerHTML = "✅ Gespeichert!";
        setTimeout(() => { map.closePopup(); ladePilzeAusCloud(); }, 1000); 
    }
};

// === 6.3. READ: Die Ansicht eines Pilzes bauen (Bilder nicht abgeschnitten) ===
window.generiereAnsicht = function(id) {
    const p = window.pilzDatenSpeicher[id];
    
    let html = `<div style="font-family: sans-serif; min-width: 240px; padding-bottom: 5px;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="margin: 0; font-size: 1.1em;">🍄 ${p.geniessbarkeit || "Unbekannt"}</h4>
            <button onclick="oeffneBearbeitung(${id})" style="background: none; border: none; cursor: pointer; font-size: 1.1em; padding: 0; opacity: 0.6; transition: opacity 0.2s;" title="Eintrag bearbeiten" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                ✏️
            </button>
        </div>
        
        <p style="margin: 0 0 12px 0; color: #444;">${p.notiz || "<i>Keine Notiz</i>"}</p>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">`;
    
    // Foto 1 als großes Hauptbild
    if (p.foto_url) {
        // NEU: object-fit: contain; und ein minimal hellgrauer Hintergrund, falls Ränder entstehen
        html += `<img src="${p.foto_url}" style="width: 100%; max-height: 220px; object-fit: contain; background: #f9f9f9; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">`;
    }
    
    // Foto 2 und 3 nebeneinander darunter
    if (p.foto_url_2 || p.foto_url_3) {
        html += `<div style="display: flex; gap: 6px; justify-content: center;">`;
        if (p.foto_url_2) {
            html += `<img src="${p.foto_url_2}" style="flex: 1; width: 100%; height: 100px; object-fit: contain; background: #f9f9f9; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">`;
        }
        if (p.foto_url_3) {
            html += `<img src="${p.foto_url_3}" style="flex: 1; width: 100%; height: 100px; object-fit: contain; background: #f9f9f9; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">`;
        }
        html += `</div>`;
    }
    
    html += `</div></div>`;
    return html;
};
// === 6.4. UPDATE-UI: Den Bearbeitungs-Modus öffnen (mit dynamischem Nachladen) ===
window.oeffneBearbeitung = function(id) {
    const p = window.pilzDatenSpeicher[id];
    const marker = window.pilzMarkerSpeicher[id];

    // Wir prüfen dynamisch, wie viele der 3 Foto-Plätze aktuell frei/leer sind
    let freieSlotsCount = 0;
    if (!p.foto_url) freieSlotsCount++;
    if (!p.foto_url_2) freieSlotsCount++;
    if (!p.foto_url_3) freieSlotsCount++;

    let html = `<div style="font-family: sans-serif; min-width: 220px;">
        <h4 style="margin: 0 0 5px 0;">✏️ Pilz bearbeiten</h4>
        <input type="text" id="edit-notiz-${id}" value="${p.notiz || ''}" style="width: 100%; margin-bottom: 5px; padding: 5px;">
        
        <select id="edit-gen-${id}" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            <option value="Unbekannt" ${p.geniessbarkeit === 'Unbekannt' ? 'selected' : ''}>❓ Unbekannt</option>
            <option value="Essbar" ${p.geniessbarkeit === 'Essbar' ? 'selected' : ''}>🍽️ Essbar</option>
            <option value="Ungenießbar" ${p.geniessbarkeit === 'Ungenießbar' ? 'selected' : ''}>🤢 Ungenießbar</option>
            <option value="Giftig" ${p.geniessbarkeit === 'Giftig' ? 'selected' : ''}>☠️ Giftig</option>
        </select>
        
        <div style="font-size: 0.8em; margin-bottom: 10px;">
            ${p.foto_url ? `<div style="margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;"><span>📷 Foto 1:</span> <button onclick="loescheEigenschaft(${id}, 'foto_url')" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">🗑️ Löschen</button></div>` : ''}
            ${p.foto_url_2 ? `<div style="margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;"><span>📷 Foto 2:</span> <button onclick="loescheEigenschaft(${id}, 'foto_url_2')" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">🗑️ Löschen</button></div>` : ''}
            ${p.foto_url_3 ? `<div style="margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;"><span>📷 Foto 3:</span> <button onclick="loescheEigenschaft(${id}, 'foto_url_3')" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">🗑️ Löschen</button></div>` : ''}
        </div>

        ${freieSlotsCount > 0 ? `
            <div style="background: #f9f9f9; padding: 8px; border-radius: 5px; margin-bottom: 10px; border: 1px dashed #ccc;">
                <label style="font-size: 0.8em; display:block; text-align:left; font-weight:bold; margin-bottom:4px;">Fotos hinzufügen (noch ${freieSlotsCount} frei):</label>
                <input type="file" id="edit-foto-${id}" accept="image/*" multiple style="width: 100%; font-size: 0.85em;">
            </div>
        ` : ''}

        <button onclick="speichereAenderungen(${id})" style="width: 100%; margin-bottom: 5px; padding: 6px; background: #2ca25f; color: white; border: none; border-radius: 5px; cursor:pointer; font-weight:bold;">💾 Speichern</button>
        <button onclick="loeschePilzKompett(${id})" style="width: 100%; padding: 6px; background: #ff3333; color: white; border: none; border-radius: 5px; cursor:pointer;">🚨 Eintrag komplett löschen</button>
        
        <div id="edit-upload-status-${id}" style="margin-top: 10px; font-size: 0.9em; font-weight: bold; text-align:center;"></div>
    </div>`;

    marker.setPopupContent(html);
};

// === 6.5. UPDATE: Änderungen und NEUE FOTOS in die Cloud senden ===
window.speichereAenderungen = async function(id) {
    const neueNotiz = document.getElementById(`edit-notiz-${id}`).value;
    const neuesGen = document.getElementById(`edit-gen-${id}`).value;
    const fotoFeld = document.getElementById(`edit-foto-${id}`);
    const dateien = fotoFeld ? fotoFeld.files : [];
    const statusText = document.getElementById(`edit-upload-status-${id}`);

    const p = window.pilzDatenSpeicher[id];
    
    // Welche Spalten-Plätze sind bei diesem Pilz aktuell unbesetzt?
    let freieSlots = [];
    if (!p.foto_url) freieSlots.push('foto_url');
    if (!p.foto_url_2) freieSlots.push('foto_url_2');
    if (!p.foto_url_3) freieSlots.push('foto_url_3');

    // Sicherheits-Check: Hat der Nutzer versucht, zu viele Bilder auszuwählen?
    if (dateien.length > freieSlots.length) {
        if (statusText) statusText.innerHTML = `❌ Maximal ${freieSlots.length} weitere(s) Foto(s) erlaubt!`;
        return;
    }

    if (statusText && dateien.length > 0) {
        statusText.innerHTML = "⏳ Neue Fotos werden hochgeladen...";
    }

    // Wir bereiten das Paket für Supabase vor (Text-Updates sind immer dabei)
    const updateDaten = {
        notiz: neueNotiz,
        geniessbarkeit: neuesGen
    };

    // Wenn neue Bilder ausgewählt wurden, laden wir sie hoch und weisen sie den freien Plätzen zu
    for (let i = 0; i < dateien.length; i++) {
        const dateiName = `${Date.now()}_${dateien[i].name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const { error } = await _supabase.storage.from('pilzfotos').upload(dateiName, dateien[i]);
        
        if (!error) {
            const publicUrl = _supabase.storage.from('pilzfotos').getPublicUrl(dateiName).data.publicUrl;
            // Wir nehmen uns die nächste freie Spalte aus unserem Array (z.B. 'foto_url_2')
            const zielSlot = freieSlots[i];
            updateDaten[zielSlot] = publicUrl;
        } else {
            console.error("Fehler beim Upload im Edit-Modus:", error);
        }
    }

    // Ab zu Supabase mit dem erweiterten Update-Paket!
    const { error } = await _supabase.from('pilze').update(updateDaten).eq('id', id);

    if (!error) {
        if (statusText) statusText.innerHTML = "✅ Erfolgreich aktualisiert!";
        
        // Wir aktualisieren unseren lokalen Zwischenspeicher im Browser direkt mit
        window.pilzDatenSpeicher[id].notiz = neueNotiz;
        window.pilzDatenSpeicher[id].geniessbarkeit = neuesGen;
        Object.keys(updateDaten).forEach(key => {
            window.pilzDatenSpeicher[id][key] = updateDaten[key];
        });

        // Nach einer kurzen Sekunde wechseln wir das Popup zurück zur neuen, schönen Foto-Ansicht
        setTimeout(() => {
            window.pilzMarkerSpeicher[id].setPopupContent(window.generiereAnsicht(id));
        }, 800);
    } else {
        if (statusText) statusText.innerHTML = "❌ Fehler beim Speichern!";
    }
};

// === 6.6. DELETE: Ein einzelnes Foto aus der Datenbank löschen ===
window.loescheEigenschaft = async function(id, spaltenName) {
    const updateDaten = {};
    updateDaten[spaltenName] = null; // Wir leeren das Feld in der Cloud

    const { error } = await _supabase.from('pilze').update(updateDaten).eq('id', id);
    if (!error) {
        window.pilzDatenSpeicher[id][spaltenName] = null; // Lokal leeren
        oeffneBearbeitung(id); // Fenster aktualisieren, damit der Button verschwindet
    }
};

// === 6.7. DELETE: Den ganzen Marker löschen ===
window.loeschePilzKompett = async function(id) {
    if(confirm("Möchtest du diesen Fundort wirklich für immer löschen?")) {
        const { error } = await _supabase.from('pilze').delete().eq('id', id);
        if (!error) {
            fundstellenLayer.removeLayer(window.pilzMarkerSpeicher[id]); // Von der Karte fegen
            map.closePopup();
        }
    }
};

// === 6.8. INITIALISIERUNG: Pilze beim Start laden ===
async function ladePilzeAusCloud() {
    fundstellenLayer.clearLayers(); // Einmal aufräumen, falls wir nach einem Upload neu laden
    const { data, error } = await _supabase.from('pilze').select('*');

    if (data) {
        data.forEach(function(pilz) {
            if (!pilz.id) return; // Sicherheits-Check
            window.pilzDatenSpeicher[pilz.id] = pilz; // Im Lexikon abspeichern
            
            const marker = L.marker([pilz.lat, pilz.lng])
                .addTo(fundstellenLayer)
                .bindPopup(() => window.generiereAnsicht(pilz.id)); // Bindet die Ansicht dynamisch
            
            window.pilzMarkerSpeicher[pilz.id] = marker; // Marker abspeichern
        });
        console.log(`${data.length} Pilze aus der Cloud geladen!`);
    }
}

ladePilzeAusCloud();

// === 7. Schrotflinten-Modus: 7-Tage-Regen an festen Stationen in BW ===
// === 7. Schrotflinten-Modus: 7-Tage-Regen an 30 festen Stationen in BW (Gänsemarsch-Laden) ===

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

// === 8. Suchfeld (Simpel) & Routenplaner (Auto) ===

// Werkzeug 1: Die simple Lupe für die schnelle Orts-Suche (oben links)
if (typeof L.Control.geocoder === 'function') {
    L.Control.geocoder({
        position: 'topleft',
        placeholder: 'Ort oder Wald suchen...'
    }).addTo(map);
}

// === Werkzeug 2: Der Routenplaner mit Wander-Profil (ORS) ===
const ORS_API_KEY = "DEIN_API_KEY_HIER_EINTRAGEN"; // Hier deinen Schlüssel einfügen

window.routenPlaner = L.Routing.control({
    waypoints: [],
    // WICHTIG: Hier binden wir das Wander-Profil an
    router: L.Routing.openrouteservice(ORS_API_KEY, {
        profile: 'foot-hiking', // Das ist das magische Profil für Wanderwege!
        format: 'json'
    }),
    routeWhileDragging: true,
    show: false,
    addWaypoints: true, // Lass das auf 'true', damit du im Wald Punkte korrigieren kannst
    fitSelectedRoutes: true,
    language: 'de'
}).addTo(map);

function berechneWanderStatistik(route) {
    // 1. Koordinaten der Route extrahieren
    const koordinaten = route.coordinates; 
    
    // 2. Distanz in KM
    const distanzKm = (route.summary.totalDistance / 1000).toFixed(2);
    
    // 3. Höhenmeter (Hier kommt später die Magie, die die Höhen aus den Punkten liest)
    // Hinweis: OSRM/ORS liefern in route.coordinates bei jedem Punkt ein .alt oder .ele
    let aufstieg = 0;
    let abstieg = 0;
    
    for (let i = 1; i < koordinaten.length; i++) {
        let diff = (koordinaten[i].alt || 0) - (koordinaten[i-1].alt || 0);
        if (diff > 0) aufstieg += diff;
        else abstieg += Math.abs(diff);
    }

    console.log(`Statistik: ${distanzKm}km, Auf: ${aufstieg.toFixed(0)}m, Ab: ${abstieg.toFixed(0)}m`);
    
    // --- NÄCHSTER SCHRITT (Vorschau): ---
    // Hier rufen wir jetzt die Funktion auf, die prüft, wie viel NSG auf der Strecke liegt
    // und dann den "In Supabase speichern"-Button anzeigt.
}
async function berechneWanderStatistik(route) {
    const coords = route.coordinates;
    const distanzKm = (route.summary.totalDistance / 1000).toFixed(2);
    
    // Höhenmeter berechnen
    let aufstieg = 0, abstieg = 0;
    for (let i = 1; i < coords.length; i++) {
        let diff = (coords[i].alt || 0) - (coords[i-1].alt || 0);
        if (diff > 0) aufstieg += diff; else abstieg += Math.abs(diff);
    }

    // Naturschutzgebiet-Anteil berechnen (Turf.js Magie)
    // Wir holen uns die GeoJSON Daten aus deinem naturschutzLayer
    // (Wir nehmen an, naturschutzLayer ist ein L.geoJSON Layer)
    let nsgPunkte = 0;
    const geojson = naturschutzLayer.toGeoJSON(); // Wandelt den Layer zurück in Daten
    
    coords.forEach(p => {
        const pt = turf.point([p.lng, p.lat]);
        // Prüfen, ob der Punkt in irgendeinem der NSG-Polygone liegt
        const inNSG = geojson.features.some(f => turf.booleanPointInPolygon(pt, f));
        if (inNSG) nsgPunkte++;
    });

    const nsgAnteil = Math.round((nsgPunkte / coords.length) * 100);

    console.log(`Route: ${distanzKm}km, NSG: ${nsgAnteil}%`);
    
    // Jetzt zeigen wir das Speichern-Fenster
    zeigeSpeichernDialog(distanzKm, aufstieg, abstieg, nsgAnteil, coords);
}
//===Das "Speichern"-Dialog. Um die Route zu benennen, bauen wir ein kleines Formular, das aufpoppt, sobald die Berechnung fertig ist
function zeigeSpeichernDialog(dist, auf, ab, nsg, coords) {
    const popupHtml = `
        <div style="font-family:sans-serif; min-width:200px;">
            <h4>Wanderung speichern?</h4>
            <input type="text" id="route-name" placeholder="Name der Route..." style="width:100%"><br><br>
            <p style="font-size:0.9em">
                📏 ${dist} km | 🏔️ ${auf.toFixed(0)}m Auf | 🌲 ${nsg}% NSG
            </p>
            <button onclick="speichereRouteInSupabase('${dist}', '${auf.toFixed(0)}', '${ab.toFixed(0)}', '${nsg}', '${JSON.stringify(coords)}')">
                💾 In Cloud speichern
            </button>
        </div>
    `;
    L.popup().setLatLng(coords[Math.floor(coords.length/2)]).setContent(popupHtml).openOn(map);
}
//==Supabase-Upload in die Datenbank-Tabelle
window.speichereRouteInSupabase = async function(dist, auf, ab, nsg, coordsJson) {
    const name = document.getElementById('route-name').value;
    
    const { data, error } = await _supabase.from('wanderrouten').insert([{
        name: name,
        distanz_km: parseFloat(dist),
        hoehenmeter_auf: parseInt(auf),
        hoehenmeter_ab: parseInt(ab),
        anteil_nsg_prozent: parseInt(nsg),
        koordinaten: JSON.parse(coordsJson)
    }]);

    if (!error) {
        alert("Route gespeichert!");
        map.closePopup();
    } else {
        console.error("Fehler:", error);
    }
};
function holeAlleSchutzgebieteGeoJSON() {
    let alleFeatures = [];

    // Wir fragen die Karte: "Welche Layer hast du alle?"
    map.eachLayer(function(layer) {
        // Prüfen: Hat der Layer unser Etikett?
        if (layer.isSchutzgebiet === true) {
            // Jeden Layer durchlaufen und die Daten (Features) sammeln
            layer.eachLayer(function(subLayer) {
                if (subLayer.toGeoJSON) {
                    alleFeatures.push(subLayer.toGeoJSON());
                }
            });
        }
    });

    // Wir fassen alles in einer GeoJSON FeatureCollection zusammen
    // Turf.js braucht dieses Format, um darin zu "rechnen"
    return turf.featureCollection(alleFeatures);
}
