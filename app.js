// === 0. Koordinatensystem für LUBW-Daten (EPSG:25832) definieren ===
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs");

// === 1. Karte initialisieren ===
const map = L.map('map').setView([48.9, 9.2], 8);

// === 9. Das Auto-Feature (Parken, Icon & Menü) ===
window.meinAutoStandort = null; 
let autoMarker = null; 

const autoIcon = L.divIcon({
    html: '<div style="font-size: 35px; line-height: 1; text-shadow: 2px 2px 4px rgba(0,0,0,0.4); text-align:center;">🚗</div>',
    className: 'mein-auto', 
    iconSize: [35, 35],
    iconAnchor: [17, 17], 
    popupAnchor: [0, -20] 
});

window.speichereAuto = function(lat, lng) {
    window.meinAutoStandort = L.latLng(lat, lng); 
    if(autoMarker) map.removeLayer(autoMarker); 
    
    const autoMenue = `
        <div style="text-align:center; font-family: sans-serif; min-width: 150px;">
            <b style="font-size: 1.1em;">Dein Auto 🚗</b><br><hr style="margin:8px 0; border:0; border-top:1px solid #ccc;">
            <button onclick="routeZumAuto()" style="width:100%; margin-bottom:8px; background:#2ca25f; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">
                🚶 Bring mich hin!
            </button>
            <button onclick="loescheAuto()" style="width:100%; background:#ff3333; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                🗑️ Auto löschen
            </button>
        </div>
    `;

    autoMarker = L.marker(window.meinAutoStandort, { icon: autoIcon })
        .addTo(map)
        .bindPopup(autoMenue)
        .openPopup();
        
    map.closePopup(); 
};

window.routeZumAuto = function() {
    if(!window.meinAutoStandort) return;
    navigator.geolocation.getCurrentPosition(function(pos) {
        window.routenPlaner.setWaypoints([
            L.latLng(pos.coords.latitude, pos.coords.longitude), 
            window.meinAutoStandort 
        ]);
        map.closePopup(); 
    }, function(error) {
        alert("📍 GPS-Ortung fehlgeschlagen! Ich verwende stattdessen deinen Karten-Mittelpunkt als Start.");
        window.routenPlaner.setWaypoints([
            map.getCenter(),
            window.meinAutoStandort
        ]);
        map.closePopup();
    });
};

window.loescheAuto = function() {
    if(autoMarker) {
        map.removeLayer(autoMarker); 
        window.meinAutoStandort = null; 
        autoMarker = null;
    }
};
// === 2. Basiskarte (OpenStreetMap) hinzufügen ===
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// === 2.1. Leere Sammelmappen & WMS anlegen ===
const waldLayer = L.layerGroup().addTo(map);
const fundstellenLayer = L.layerGroup().addTo(map); 
const stationenLayer = L.layerGroup().addTo(map); // Wieder auf addTo(map) gesetzt
const naturschutzLayer = L.layerGroup().addTo(map); 
const nationalparkLayer = L.layerGroup().addTo(map); 

// === 2.1.1 Schutzgebiete "Etikettieren" für Turf.js ===
waldLayer.isSchutzgebiet = true;
naturschutzLayer.isSchutzgebiet = true; // REPARIERT: War vorher doppelt waldLayer
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
    "📊 7-Tage-Regen (Messpunkte)": stationenLayer
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
            coordsToLatLng: function(coords) {
                const umgerechnet = proj4("EPSG:25832", "EPSG:4326", [coords[0], coords[1]]);
                return L.latLng(umgerechnet[1], umgerechnet[0]);
            },
            style: { color: '#ff0000', fillColor: '#ff0000', weight: 2, fillOpacity: 0.5 },
            onEachFeature: function(feature, layer) {
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
            coordsToLatLng: function(coords) {
                const umgerechnet = proj4("EPSG:25832", "EPSG:4326", [coords[0], coords[1]]);
                return L.latLng(umgerechnet[1], umgerechnet[0]);
            },
            style: { color: '#ff0000', fillColor: '#ff0000', weight: 2, fillOpacity: 0.5 },
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
    setTimeout(function() { standortMarker.openPopup(); }, 800);
    L.circle(e.latlng, e.accuracy, { color: 'blue', fillOpacity: 0.1 }).addTo(map);

    const wetterUrl = `https://api.open-meteo.com/v1/forecast?latitude=${e.latlng.lat}&longitude=${e.latlng.lng}&current_weather=true`;
    fetch(wetterUrl)
        .then(function(antwort) { return antwort.json(); })
        .then(function(daten) {
            if(daten.current_weather) {
                const temp = daten.current_weather.temperature;
                const hoehe = daten.elevation ?? "Unbekannt"; 
                const anzeigeFeld = document.getElementById('wetter-anzeige');
                if(anzeigeFeld) { 
                    anzeigeFeld.innerHTML = `${temp} °C | 🏔️ Höhe: ${hoehe} Meter`; 
                }
            }
        })
        .catch(function(fehler) { console.error("Wetter-Verbindung fehlgeschlagen:", fehler); });
}   

function standortFehler(e) {
    alert("GPS-Fehler: " + e.message);
}

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
                        
                        const regenMengen = wetterDaten.daily.precipitation_sum;
                        let regenSumme = 0;
                        for(let i = 0; i < 7; i++) { regenSumme += regenMengen[i] || 0; }
                        regenSumme = Math.round(regenSumme * 10) / 10;

                        // REPARIERT: Die Variablen lat und lng werden hier jetzt absolut sauber injiziert!
                        ladePopup.setContent(`
                            <div style="text-align: center; font-family: sans-serif;">
                                📍 <b>${ortsName}</b><br>
                                🌡️ ${temperatur} °C | 💨 ${wind} km/h<br>
                                🌧️ <b>Regen (7 Tage): ${regenSumme} mm</b>
                                <hr style="margin: 10px 0; border: 0; border-top: 1px solid #ccc;">
                                <button onclick="speichereAuto(${lat}, ${lng})" style="width: 100%; padding: 6px; margin-bottom: 5px; background: #3388ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                                    🚗 Hier Auto parken
                                </button>
                            </div>
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

window.pilzDatenSpeicher = {}; 
window.pilzMarkerSpeicher = {}; 

// === 6.1. Neues Fund-Formular (Rechtsklick) ===
map.on('contextmenu', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

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

window.speichereNeuenFund = async function(lat, lng) {
    const notizFeld = document.getElementById('neu-notiz').value;
    const genFeld = document.getElementById('neu-geniessbarkeit').value;
    const dateien = document.getElementById('neu-foto').files;
    const statusText = document.getElementById('upload-status');

    if (dateien.length > 3) { statusText.innerHTML = "❌ Maximal 3 Fotos erlaubt!"; return; }
    statusText.innerHTML = "⏳ Lade hoch... (das kann dauern)";
    let urls = [null, null, null]; 

    for (let i = 0; i < Math.min(dateien.length, 3); i++) {
        const dateiName = `${Date.now()}_${dateien[i].name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const { data, error } = await _supabase.storage.from('pilzfotos').upload(dateiName, dateien[i]);
        if (error) { statusText.innerHTML = `❌ Fehler bei Bild ${i+1}`; return; } 
        else { urls[i] = _supabase.storage.from('pilzfotos').getPublicUrl(dateiName).data.publicUrl; }
    }

    const { data, error } = await _supabase.from('pilze').insert([{ 
        lat: lat, lng: lng, notiz: notizFeld, geniessbarkeit: genFeld,
        foto_url: urls[0], foto_url_2: urls[1], foto_url_3: urls[2]
    }]).select(); 

    if (error) { statusText.innerHTML = "❌ Datenbank-Fehler!"; } 
    else { statusText.innerHTML = "✅ Gespeichert!"; setTimeout(() => { map.closePopup(); ladePilzeAusCloud(); }, 1000); }
};

window.generiereAnsicht = function(id) {
    const p = window.pilzDatenSpeicher[id];
    let html = `<div style="font-family: sans-serif; min-width: 240px; padding-bottom: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="margin: 0; font-size: 1.1em;">🍄 ${p.geniessbarkeit || "Unbekannt"}</h4>
            <button onclick="oeffneBearbeitung(${id})" style="background: none; border: none; cursor: pointer; font-size: 1.1em; padding: 0; opacity: 0.6;">✏️</button>
        </div>
        <p style="margin: 0 0 12px 0; color: #444;">${p.notiz || "<i>Keine Notiz</i>"}</p>
        <div style="display: flex; flex-direction: column; gap: 6px;">`;
    
    if (p.foto_url) { html += `<img src="${p.foto_url}" style="width: 100%; max-height: 220px; object-fit: contain; background: #f9f9f9; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">`; }
    if (p.foto_url_2 || p.foto_url_3) {
        html += `<div style="display: flex; gap: 6px; justify-content: center;">`;
        if (p.foto_url_2) { html += `<img src="${p.foto_url_2}" style="flex: 1; width: 100%; height: 100px; object-fit: contain; background: #f9f9f9; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">`; }
        if (p.foto_url_3) { html += `<img src="${p.foto_url_3}" style="flex: 1; width: 100%; height: 100px; object-fit: contain; background: #f9f9f9; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">`; }
        html += `</div>`;
    }
    html += `</div></div>`;
    return html;
};

window.oeffneBearbeitung = function(id) {
    const p = window.pilzDatenSpeicher[id];
    const marker = window.pilzMarkerSpeicher[id];
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
            ${p.foto_url ? `<div><span>📷 Foto 1:</span> <button onclick="loescheEigenschaft(${id}, 'foto_url')" style="color:red; background:none; border:none; cursor:pointer;">🗑️ Löschen</button></div>` : ''}
            ${p.foto_url_2 ? `<div><span>📷 Foto 2:</span> <button onclick="loescheEigenschaft(${id}, 'foto_url_2')" style="color:red; background:none; border:none; cursor:pointer;">🗑️ Löschen</button></div>` : ''}
            ${p.foto_url_3 ? `<div><span>📷 Foto 3:</span> <button onclick="loescheEigenschaft(${id}, 'foto_url_3')" style="color:red; background:none; border:none; cursor:pointer;">🗑️ Löschen</button></div>` : ''}
        </div>
        ${freieSlotsCount > 0 ? `<div style="background: #f9f9f9; padding: 8px; border-radius: 5px; border: 1px dashed #ccc;"><input type="file" id="edit-foto-${id}" accept="image/*" multiple style="width: 100%;"></div>` : ''}
        <button onclick="speichereAenderungen(${id})" style="width: 100%; margin-top:5px; padding: 6px; background: #2ca25f; color: white; border: none; border-radius: 5px; cursor:pointer;">💾 Speichern</button>
        <button onclick="loeschePilzKompett(${id})" style="width: 100%; margin-top:5px; padding: 6px; background: #ff3333; color: white; border: none; border-radius: 5px; cursor:pointer;">🚨 Löschen</button>
        <div id="edit-upload-status-${id}" style="margin-top: 10px; font-size: 0.9em; font-weight: bold;"></div>
    </div>`;
    marker.setPopupContent(html);
};

window.speichereAenderungen = async function(id) {
    const neueNotiz = document.getElementById(`edit-notiz-${id}`).value;
    const neuesGen = document.getElementById(`edit-gen-${id}`).value;
    const fotoFeld = document.getElementById(`edit-foto-${id}`);
    const dateien = fotoFeld ? fotoFeld.files : [];
    const p = window.pilzDatenSpeicher[id];
    
    let freieSlots = [];
    if (!p.foto_url) freieSlots.push('foto_url');
    if (!p.foto_url_2) freieSlots.push('foto_url_2');
    if (!p.foto_url_3) freieSlots.push('foto_url_3');

    if (dateien.length > freieSlots.length) { return; }

    const updateDaten = { notiz: neueNotiz, geniessbarkeit: neuesGen };
    for (let i = 0; i < dateien.length; i++) {
        const dateiName = `${Date.now()}_${dateien[i].name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const { error } = await _supabase.storage.from('pilzfotos').upload(dateiName, dateien[i]);
        if (!error) {
            const publicUrl = _supabase.storage.from('pilzfotos').getPublicUrl(dateiName).data.publicUrl;
            updateDaten[freieSlots[i]] = publicUrl;
        }
    }

    const { error } = await _supabase.from('pilze').update(updateDaten).eq('id', id);
    if (!error) {
        window.pilzDatenSpeicher[id].notiz = neueNotiz;
        window.pilzDatenSpeicher[id].geniessbarkeit = neuesGen;
        Object.keys(updateDaten).forEach(key => { window.pilzDatenSpeicher[id][key] = updateDaten[key]; });
        setTimeout(() => { window.pilzMarkerSpeicher[id].setPopupContent(window.generiereAnsicht(id)); }, 800);
    }
};

window.loescheEigenschaft = async function(id, spaltenName) {
    const updateDaten = {}; updateDaten[spaltenName] = null;
    const { error } = await _supabase.from('pilze').update(updateDaten).eq('id', id);
    if (!error) { window.pilzDatenSpeicher[id][spaltenName] = null; oeffneBearbeitung(id); }
};

window.loeschePilzKompett = async function(id) {
    if(confirm("Möchtest du diesen Fundort wirklich für immer löschen?")) {
        const { error } = await _supabase.from('pilze').delete().eq('id', id);
        if (!error) { fundstellenLayer.removeLayer(window.pilzMarkerSpeicher[id]); map.closePopup(); }
    }
};

async function ladePilzeAusCloud() {
    fundstellenLayer.clearLayers();
    const { data, error } = await _supabase.from('pilze').select('*');
    if (data) {
        data.forEach(function(pilz) {
            if (!pilz.id) return;
            window.pilzDatenSpeicher[pilz.id] = pilz;
            const marker = L.marker([pilz.lat, pilz.lng]).addTo(fundstellenLayer).bindPopup(() => window.generiereAnsicht(pilz.id));
            window.pilzMarkerSpeicher[pilz.id] = marker;
        });
    }
}
ladePilzeAusCloud();

// === 7. Schrotflinten-Modus: 7-Tage-Regen an festen Stationen ===
const wetterStationen = [
    { name: "Mannheim (Rheinebene)", lat: 49.4875, lng: 8.4660 },
    { name: "Heidelberg (Odenwald)", lat: 49.3988, lng: 8.6724 },
    { name: "Bad Mergentheim (Taubergrund)", lat: 49.4904, lng: 9.7733 },
    { name: "Heilbronn (Unterland)", lat: 49.1427, lng: 9.2109 },
    { name: "Schwäbisch Hall (Hohenlohe)", lat: 49.1123, lng: 9.7375 },
    { name: "Crailsheim (Hohenloher Ebene)", lat: 49.1368, lng: 10.0712 },
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
    { name: "Aalen (Ostalb)", lat: 48.8378, lng: 10.0936 },
    { name: "Heidenheim (Schwäbische Alb)", lat: 48.6773, lng: 10.1534 },
    { name: "Ulm (Donau-Iller)", lat: 48.3984, lng: 9.9915 },
    { name: "Rottweil (Neckarquelle)", lat: 48.1648, lng: 8.6253 },
    { name: "Freiburg (Breisgau)", lat: 47.9959, lng: 7.8522 },
    { name: "Titisee-Neustadt (Hochschwarzwald)", lat: 47.9150, lng: 8.2120 },
    { name: "Villingen-Schwenningen (Schwarzwald-Baar)", lat: 48.0583, lng: 8.4552 },
    { name: "Sigmaringen (Obere Donau)", lat: 48.0872, lng: 9.2173 },
    { name: "Tuttlingen (Donautal)", lat: 47.9850, lng: 8.8183 },
    { name: "Lörrach (Dreiländereck)", lat: 47.6146, lng: 7.6628 },
    { name: "Waldshut-Tiengen (Hochrhein)", lat: 47.6231, lng: 8.2144 },
    { name: "Biberach (Oberschwaben)", lat: 48.0953, lng: 9.7952 },
    { name: "Ravensburg (Schussental)", lat: 47.7811, lng: 9.6130 },
    { name: "Konstanz (Bodensee)", lat: 47.6592, lng: 9.1756 }
];

wetterStationen.forEach(function(station, index) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${station.lat}&longitude=${station.lng}&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Europe/Berlin`;
    setTimeout(function() {
        fetch(url)
            .then(function(antwort) { if (!antwort.ok) throw new Error("Blockade"); return antwort.json(); })
            .then(function(daten) {
                if (daten.daily && daten.daily.precipitation_sum) {
                    let summe = 0;
                    for(let i = 0; i < 7; i++) { summe += daten.daily.precipitation_sum[i] || 0; }
                    summe = Math.round(summe * 10) / 10;
                    let farbe = '#ff3333';
                    if (summe >= 5) farbe = '#ffcc00';
                    if (summe >= 15) farbe = '#2ca25f';
                    if (summe >= 30) farbe = '#0055ff';

                    L.circleMarker([station.lat, station.lng], { radius: 12, fillColor: farbe, color: '#ffffff', weight: 2, fillOpacity: 0.85 })
                    .bindPopup(`<div style="text-align: center;">📍 <b>${station.name}</b><br><hr style="margin:5px 0;">🌧️ 7-Tage-Regen:<br><span style="font-size:1.2em; font-weight:bold; color:${farbe};">${summe} mm</span></div>`)
                    .addTo(stationenLayer);
                }
            }).catch(function(f) { console.warn(f); });
    }, index * 200);
});

const regenLegende = L.control({ position: 'topright' });
regenLegende.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.backgroundColor = 'white'; div.style.padding = '10px'; div.style.borderRadius = '5px';
    div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)'; div.style.fontFamily = 'sans-serif'; div.style.fontSize = '14px';
    div.innerHTML = `<b>🌧️ 7-Tage-Regen</b><br>
        <i style="background: #ff3333; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> &lt; 5 mm (Trocken)<br>
        <i style="background: #ffcc00; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> 5 - 15 mm (Mäßig)<br>
        <i style="background: #2ca25f; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> 15 - 30 mm (Gut)<br>
        <i style="background: #0055ff; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></i> &gt; 30 mm (Sehr nass)`;
    return div;
};
regenLegende.addTo(map);

// === 8. Suchfeld (Simpel) & Routenplaner ===
if (typeof L.Control.geocoder === 'function') {
    L.Control.geocoder({ position: 'topleft', placeholder: 'Ort oder Wald suchen...' }).addTo(map);
}

const ORS_API_KEY = "DEIN_API_KEY_HIER_EINTRAGEN"; 
window.routenPlaner = L.Routing.control({
    waypoints: [],
    router: L.Routing.openrouteservice(ORS_API_KEY, { profile: 'foot-hiking', format: 'json' }),
    routeWhileDragging: true,
    show: false,
    addWaypoints: true,
    fitSelectedRoutes: true,
    language: 'de'
}).addTo(map);

// Event-Listener: Sobald die Route fertig berechnet ist, starten wir die Analyse!
window.routenPlaner.on('routesfound', function(e) {
    if(e.routes && e.routes[0]) {
        berechneWanderStatistik(e.routes[0]);
    }
});

async function berechneWanderStatistik(route) {
    const coords = route.coordinates;
    const distanzKm = (route.summary.totalDistance / 1000).toFixed(2);
    
    let aufstieg = 0, abstieg = 0;
    for (let i = 1; i < coords.length; i++) {
        let diff = (coords[i].alt || 0) - (coords[i-1].alt || 0);
        if (diff > 0) aufstieg += diff; else abstieg += Math.abs(diff);
    }

    const schutzGebieteGeoJSON = holeAlleSchutzgebieteGeoJSON(); 
    let schutzPunkte = 0;
    
    coords.forEach(p => {
        const pt = turf.point([p.lng, p.lat]);
        if (schutzGebieteGeoJSON.features.length > 0) {
            const inSchutz = schutzGebieteGeoJSON.features.some(f => turf.booleanPointInPolygon(pt, f));
            if (inSchutz) schutzPunkte++;
        }
    });

    const schutzAnteil = coords.length > 0 ? Math.round((schutzPunkte / coords.length) * 100) : 0;
    zeigeSpeichernDialog(distanzKm, aufstieg, abstieg, schutzAnteil, coords);
}

function zeigeSpeichernDialog(dist, auf, ab, nsg, coords) {
    const popupHtml = `
        <div style="font-family:sans-serif; min-width:200px; text-align: center;">
            <h4>🌲 Wanderung speichern?</h4>
            <input type="text" id="route-name" placeholder="Name der Route..." style="width:100%; padding: 5px; margin-bottom: 8px;"><br>
            <p style="font-size:0.9em; margin: 5px 0;">
                📏 <b>${dist} km</b> | 🏔️ <b>${auf.toFixed(0)}m Auf</b><br>
                🚩 Rote Gebiete: <b>${nsg}%</b>
            </p>
            <button onclick="speichereRouteInSupabase('${dist}', '${auf.toFixed(0)}', '${ab.toFixed(0)}', '${nsg}', '${JSON.stringify(coords)}')" style="width:100%; background:#2ca25f; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold; margin-top:5px;">
                💾 In Cloud speichern
            </button>
        </div>
    `;
    L.popup().setLatLng(coords[Math.floor(coords.length/2)]).setContent(popupHtml).openOn(map);
}

window.speichereRouteInSupabase = async function(dist, auf, ab, nsg, coordsJson) {
    const name = document.getElementById('route-name').value || "Unbenannte Wanderung";
    const { data, error } = await _supabase.from('wanderrouten').insert([{
        name: name,
        distanz_km: parseFloat(dist),
        hoehenmeter_auf: parseInt(auf),
        hoehenmeter_ab: parseInt(ab),
        anteil_nsg_prozent: parseInt(nsg),
        koordinaten: JSON.parse(coordsJson)
    }]);

    if (!error) { alert("Route erfolgreich in Supabase gespeichert! 🎉"); map.closePopup(); } 
    else { console.error("Fehler:", error); alert("Fehler beim Speichern!"); }
};

function holeAlleSchutzgebieteGeoJSON() {
    let alleFeatures = [];
    map.eachLayer(function(layer) {
        if (layer.isSchutzgebiet === true) {
            layer.eachLayer(function(subLayer) {
                if (subLayer.toGeoJSON) { alleFeatures.push(subLayer.toGeoJSON()); }
            });
        }
    });
    return turf.featureCollection(alleFeatures);
}


};
