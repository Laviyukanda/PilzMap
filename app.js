    // === 0. Koordinatensystem für LUBW-Daten (EPSG:25832) definieren ===
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs");
proj4.defs("EPSG:31467", "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs");

// === 1. Karte initialisieren (Startansicht: ganz Baden-Württemberg) ===
const map = L.map('map').setView([48.65, 9.0], 8);

// === 2. Basiskarten ===
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> &copy; OpenStreetMap'
});

const cyclOsm = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a> &copy; OpenStreetMap'
});

const esriSatellit = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
});

const esriTopo = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS'
});

// === 2.1. Leere Sammelmappen & WMS anlegen ===
const waldLayer = L.layerGroup();
const fundstellenLayer = L.layerGroup().addTo(map); 
const stationenLayer = L.layerGroup();
const naturschutzLayer = L.layerGroup().addTo(map); 
const nationalparkLayer = L.layerGroup().addTo(map);
const bwiLayer     = L.layerGroup();
const phBodenLayer = L.layerGroup();
// SLD erzwingt exakte Farben auf dem Server (pH×10-Werte → Klassen)
const _phSld = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">' +
    '<NamedLayer><Name>phh2o_0-5cm_mean</Name><UserStyle><FeatureTypeStyle><Rule>' +
    '<RasterSymbolizer><ColorMap type="intervals">' +
    '<ColorMapEntry color="#000000" quantity="0"  opacity="0"/>' +
    '<ColorMapEntry color="#800026" quantity="1"  opacity="0.85" label="lt 4.5"/>' +
    '<ColorMapEntry color="#bd0026" quantity="45" opacity="0.85" label="4.5-5"/>' +
    '<ColorMapEntry color="#e04040" quantity="50" opacity="0.85" label="5-5.5"/>' +
    '<ColorMapEntry color="#fcccc8" quantity="55" opacity="0.85" label="5.5-6"/>' +
    '<ColorMapEntry color="#c8e8f8" quantity="60" opacity="0.85" label="6-6.5"/>' +
    '<ColorMapEntry color="#4898d0" quantity="65" opacity="0.85" label="6.5-7"/>' +
    '<ColorMapEntry color="#1c60c0" quantity="70" opacity="0.85" label="7-7.5"/>' +
    '<ColorMapEntry color="#083888" quantity="75" opacity="0.85" label="gt 7.5"/>' +
    '</ColorMap></RasterSymbolizer>' +
    '</Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';

const bodenPhWms = L.tileLayer.wms('https://maps.isric.org/mapserv?map=/map/phh2o.map', {
    layers:      'phh2o_0-5cm_mean',
    format:      'image/png',
    transparent: true,
    opacity:     0.75,
    version:     '1.3.0',
    SLD_BODY:    _phSld,
    attribution: '© ISRIC SoilGrids 2.0 (CC BY 4.0) – pH H₂O, 0–5 cm'
});

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
const basisKarten = {
    "🗺️ Straßenkarte (OSM)":     osm,
    "🏔️ Topographie (OpenTopo)": topoMap,
    "🚵 Outdoor / Wege (CyclOSM)": cyclOsm,
    "🛰️ Satellit (Esri)":        esriSatellit,
    "📐 Topo-Atlas (Esri)":      esriTopo
};
const overlayKarten = {
    "🌲 Waldrefugien (ForstBW)": waldLayer,
    "🌿 Naturschutzgebiete": naturschutzLayer,
    "🦅 Nationalparks": nationalparkLayer,
    "Fundstellen": fundstellenLayer,
    "🌧️ Regenradar Live (DWD)": regenRadarDWD,
    "📊 7-Tage-Regen (Messpunkte)": stationenLayer,
    "🌳 Bäume (OSM)": bwiLayer,
    "🌿 Bodenvegetation (BWI 2002)": phBodenLayer,
    "🧪 pH-Bodenwerte (ISRIC)": bodenPhWms
};
L.control.layers(basisKarten, overlayKarten).addTo(map);

// === 2.3. BW-Grenzmaske (alles außerhalb ausgegraut) ===
fetch('https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/master/2_bundeslaender/4_niedrig.geo.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
        const bw = data.features.find(function(f) {
            return f.properties.GEN === 'Baden-Württemberg' || f.properties.name === 'Baden-Württemberg';
        });
        if (!bw) return;

        // Größten Außenring ermitteln (BW ist ein Polygon)
        let bwRing;
        if (bw.geometry.type === 'Polygon') {
            bwRing = bw.geometry.coordinates[0];
        } else {
            bwRing = bw.geometry.coordinates
                .map(function(p) { return p[0]; })
                .reduce(function(a, b) { return a.length > b.length ? a : b; });
        }

        // Weltrechteck mit BW als Loch → alles außerhalb wird ausgegraut
        const welt = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
        L.geoJSON({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [welt, bwRing] }
        }, {
            style: { fillColor: '#888', fillOpacity: 0.28, stroke: false, fillRule: 'evenodd' }
        }).addTo(map);

        // BW-Umriss als dezente Linie
        L.geoJSON(bw, {
            style: { color: '#555', weight: 1.5, fill: false, opacity: 0.5 }
        }).addTo(map);

        // Startansicht exakt auf BW einpassen
        map.fitBounds(L.geoJSON(bw).getBounds(), { padding: [20, 20] });
    })
    .catch(function(err) { console.warn('BW-Grenze nicht geladen:', err); });

// === 3. Waldrefugien (ForstBW) laden – nach Baumart eingefärbt ===
const _waldKatLabels = { 'WR': 'Waldrefugium', 'aWR': 'Angehender Waldrefugien', 'Still': 'Stilllegung' };

function _waldBaumart(lwetText) {
    if (!lwetText) return 'Andere';
    const t = lwetText.toLowerCase();
    if (t.includes('buche'))                               return 'Buche';
    if (t.includes('fichte'))                              return 'Fichte';
    if (t.includes('kiefer') || t.includes('föhre'))       return 'Kiefer';
    if (t.includes('tanne'))                               return 'Tanne';
    if (t.includes('lärche') || t.includes('laerche'))     return 'Lärche';
    if (t.includes('douglasie'))                           return 'Douglasie';
    if (t.includes('eiche'))                               return 'Eiche';
    if (t.includes('esche'))                               return 'Esche';
    if (t.includes('ahorn'))                               return 'Ahorn';
    if (t.includes('birke'))                               return 'Birke';
    if (t.includes('erle'))                                return 'Erle';
    if (t.includes('mischwald'))                           return 'Mischwald';
    return 'Andere';
}

fetch('ForstBW_Waldrefugien_-38784724193262813.geojson')
    .then(function(antwort) { return antwort.json(); })
    .then(function(waldDaten) {
        const vorhandeneArten = new Set();

        L.geoJSON(waldDaten, {
            style: function(feature) {
                const art   = _waldBaumart(feature.properties && feature.properties.LWET_TEXT);
                const farbe = getBaumartFarbe(art);
                return { color: farbe, fillColor: farbe, weight: 1.2, fillOpacity: 0.45 };
            },
            onEachFeature: function(feature, layer) {
                const p        = feature.properties || {};
                const art      = _waldBaumart(p.LWET_TEXT);
                const katLabel = _waldKatLabels[p.NWW_KAT] || p.NWW_KAT || '';
                vorhandeneArten.add(art);
                layer.bindPopup(
                    '🌲 <b>' + art + '</b>' +
                    (p.LWET_TEXT ? '<br><span style="font-size:0.88em">' + p.LWET_TEXT + '</span>' : '') +
                    (katLabel    ? '<br><span style="font-size:0.8em;color:#888;">' + katLabel + '</span>' : '')
                );
            }
        }).addTo(waldLayer);

        // Legende dynamisch aus den tatsächlich vorhandenen Arten aufbauen
        const waldLegende = L.control({ position: 'bottomright' });
        waldLegende.onAdd = function() {
            const div = L.DomUtil.create('div', 'info legend');
            div.style.cssText = 'background:white;padding:6px 10px;border-radius:6px;font-size:0.82em;' +
                'line-height:1.8;box-shadow:0 1px 5px rgba(0,0,0,0.3);max-height:260px;overflow-y:auto;';
            div.innerHTML = '<b>🌲 Waldrefugien</b><br>' +
                '<span style="font-size:0.78em;color:#666;">ForstBW · Baumart</span><br>' +
                Array.from(vorhandeneArten).sort().map(function(art) {
                    const farbe = getBaumartFarbe(art);
                    return '<span style="display:inline-block;width:12px;height:12px;background:' + farbe +
                           ';border-radius:2px;margin-right:5px;vertical-align:middle;"></span>' + art;
                }).join('<br>');
            return div;
        };
        map.on('overlayadd',    function(e) { if (e.layer === waldLayer) waldLegende.addTo(map); });
        map.on('overlayremove', function(e) { if (e.layer === waldLayer) waldLegende.remove(); });
        if (map.hasLayer(waldLayer)) waldLegende.addTo(map);
    })
    .catch(function(fehler) { console.error('Waldrefugien konnten nicht geladen werden:', fehler); });

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

// === 3.3. Boden-pH / Bodenvegetation (BWI 2002, EPSG:31467) ===
fetch('ph-bodenwerte.json')
    .then(function(r) { return r.json(); })
    .then(function(phDaten) {
        const gezeigteCells = new Set();
        L.geoJSON(phDaten, {
            coordsToLatLng: function(coords) {
                const wgs = proj4("EPSG:31467", "EPSG:4326", [coords[0], coords[1]]);
                return L.latLng(wgs[1], wgs[0]);
            },
            filter: function(feature) {
                const id = feature.properties.cell_id;
                if (gezeigteCells.has(id)) return false;
                gezeigteCells.add(id);
                return true;
            },
            style: function(feature) {
                const p = feature.properties;
                // Azidität-Proxy aus säureliebenden Zeigerpflanzen (Heidelbeere, Preiselbeere, Heidekraut, Drahtschmiele)
                const score = (p.sbv01 || 0) + (p.sbv02 || 0) + (p.sbv03 || 0) + (p.sbv04 || 0);
                let farbe;
                if      (score >= 8) farbe = '#d7191c';
                else if (score >= 6) farbe = '#fdae61';
                else if (score >= 4) farbe = '#ffffbf';
                else if (score >= 2) farbe = '#a6d96a';
                else                 farbe = '#1a9641';
                return { fillColor: farbe, color: '#555', weight: 0.4, fillOpacity: 0.65 };
            },
            onEachFeature: function(feature, layer) {
                const p     = feature.properties;
                const score = (p.sbv01 || 0) + (p.sbv02 || 0) + (p.sbv03 || 0) + (p.sbv04 || 0);
                const saureText = score >= 8 ? 'Säurezeiger dominant (pH ~3,5–4)' :
                                  score >= 6 ? 'Säurezeiger häufig (pH ~4–4,5)' :
                                  score >= 4 ? 'Säurezeiger mäßig (pH ~4,5–5)' :
                                  score >= 2 ? 'Säurezeiger selten (pH ~5–5,5)' :
                                               'kaum Säurezeiger (pH >5,5)';
                layer.bindPopup(
                    '🌿 <b>Bodenvegetation (BWI 2002)</b><br>' +
                    'Bundesland: ' + (p.bl_txt  || '–') + '<br>' +
                    'Waldtyp: '    + (p.wald_txt || '–') + '<br>' +
                    '<hr style="margin:4px 0;">' +
                    '<b>' + saureText + '</b><br>' +
                    '<small style="color:#555;">Schätzung aus Zeigerpflanzen-Deckung (sbv01–04):</small><br>' +
                    '<small>' +
                    '🌾 Drahtschmiele: '  + (p.sbv01 || 0) + '<br>' +
                    '🫐 Heidelbeere: '    + (p.sbv02 || 0) + '<br>' +
                    '🔴 Preiselbeere: '   + (p.sbv03 || 0) + '<br>' +
                    '🌸 Heidekraut: '     + (p.sbv04 || 0) + '<br>' +
                    'Säure-Index: '       + score + ' / 12</small>'
                );
            }
        }).addTo(phBodenLayer);
    })
    .catch(function(fehler) { console.warn('Bodenvegetation (BWI): Lade-Fehler:', fehler); });

const phLegende = L.control({ position: 'bottomright' });
phLegende.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.cssText = 'background:white;padding:10px;border-radius:5px;box-shadow:0 0 15px rgba(0,0,0,0.2);font-family:sans-serif;font-size:13px;line-height:1.8;';
    div.innerHTML = '<b>🌿 Bodenvegetation (BWI 2002)</b><br>' +
        '<span style="font-size:0.8em;color:#666;">Säure-Index aus Zeigerpflanzen:<br>' +
        '🌾 Drahtschmiele · 🫐 Heidelbeere<br>' +
        '🔴 Preiselbeere · 🌸 Heidekraut</span><br>' +
        '<hr style="margin:4px 0;border:none;border-top:1px solid #ddd;">' +
        '<i style="background:#1a9641;width:12px;height:12px;display:inline-block;border-radius:2px;margin-right:5px;vertical-align:middle;"></i>kaum Zeigerpflanzen (pH &gt;5,5)<br>' +
        '<i style="background:#a6d96a;width:12px;height:12px;display:inline-block;border-radius:2px;margin-right:5px;vertical-align:middle;"></i>selten (pH ~5–5,5)<br>' +
        '<i style="background:#ffffbf;width:12px;height:12px;display:inline-block;border-radius:2px;margin-right:5px;vertical-align:middle;"></i>mäßig (pH ~4,5–5)<br>' +
        '<i style="background:#fdae61;width:12px;height:12px;display:inline-block;border-radius:2px;margin-right:5px;vertical-align:middle;"></i>häufig (pH ~4–4,5)<br>' +
        '<i style="background:#d7191c;width:12px;height:12px;display:inline-block;border-radius:2px;margin-right:5px;vertical-align:middle;"></i>dominant (pH ~3,5–4)<br>' +
        '<span style="font-size:0.75em;color:#999;">Quelle: BWI 2002, Thünen Institut</span>';
    return div;
};

// === 3.3.1 pH-Bodenwerte Legende (ISRIC SoilGrids) ===
const _phIsricFarben = [
    { farbe: '#800026', label: '&lt; 4,5' },
    { farbe: '#bd0026', label: '4,5 – 5' },
    { farbe: '#e04040', label: '5 – 5,5' },
    { farbe: '#fcccc8', label: '5,5 – 6' },
    { farbe: '#c8e8f8', label: '6 – 6,5' },
    { farbe: '#4898d0', label: '6,5 – 7' },
    { farbe: '#1c60c0', label: '7 – 7,5' },
    { farbe: '#083888', label: '&gt; 7,5' }
];
const bodenPhLegende = L.control({ position: 'bottomright' });
bodenPhLegende.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.cssText = 'background:white;padding:10px;border-radius:5px;box-shadow:0 0 15px rgba(0,0,0,0.2);font-family:sans-serif;font-size:13px;line-height:1.8;min-width:160px;';
    div.innerHTML = '<b>🧪 pH-Bodenwerte</b><br>' +
        '<span style="font-size:0.78em;color:#666;">ISRIC SoilGrids · 0–5 cm</span><br>' +
        '<hr style="margin:4px 0;border:none;border-top:1px solid #ddd;">' +
        _phIsricFarben.map(function(e) {
            return '<i style="background:' + e.farbe + ';width:14px;height:14px;display:inline-block;border-radius:2px;margin-right:6px;vertical-align:middle;"></i>' + e.label;
        }).join('<br>') +
        '<br><span style="font-size:0.72em;color:#999;">© ISRIC (CC BY 4.0)</span>';
    return div;
};

// === 3.4. Baumkartierung (OpenStreetMap / Overpass, viewport-basiert, Spezies-Filter) ===
let _baumGeogruppen       = {};
let _baumDeaktiviertArten = new Set();
let _baumDebounceTimer    = null;
let _baumWmsLayer         = null;
let _baumWmsAktiv         = false;

function _baumWmsHolen() {
    if (!_baumWmsLayer) {
        _baumWmsLayer = L.tileLayer.wms(
            'https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_ForestType_2018/ImageServer/WMSServer',
            {
                layers: '0',
                format: 'image/png',
                transparent: true,
                opacity: 0.65,
                attribution: '© Copernicus Land Monitoring Service 2018 (EEA)'
            }
        );
    }
    return _baumWmsLayer;
}

function getBaumartFarbe(name) {
    if (!name) return '#4a7ab5';
    const n = name.toLowerCase();
    if (n.includes('fichte')    || n.includes('picea'))                               return '#7a3a1a';
    if (n.includes('kiefer')    || n.includes('pinus') || n.includes('föhre'))        return '#c03020';
    if (n.includes('tanne')     || n.includes('abies'))                               return '#e0901a';
    if (n.includes('lärche')    || n.includes('laerche') || n.includes('larix'))      return '#c05090';
    if (n.includes('douglasie') || n.includes('pseudotsuga'))                         return '#8ac820';
    if (n.includes('buche')     || n.includes('fagus'))                               return '#2d6b1a';
    if (n.includes('eiche')     || n.includes('quercus'))                             return '#5a9a2a';
    if (n.includes('esche')     || n.includes('fraxinus'))                            return '#9aba2a';
    if (n.includes('ahorn')     || n.includes('acer'))                                return '#c07020';
    if (n.includes('birke')     || n.includes('betula'))                              return '#3bc0c0';
    if (n.includes('erle')      || n.includes('alnus'))                               return '#8a9a3a';
    if (n.includes('pappel')    || n.includes('populus'))                             return '#2a9d9d';
    if (n.includes('linde')     || n.includes('tilia'))                               return '#a0c040';
    if (n.includes('kirsche')   || n.includes('prunus'))                              return '#cc3366';
    if (n.includes('kastanie')  || n.includes('castanea') || n.includes('aesculus'))  return '#cc6600';
    if (n.includes('walnuss')   || n.includes('juglans'))                             return '#996633';
    if (n === 'laubwald')   return '#5a9a4a';
    if (n === 'nadelwald')  return '#2a4a2a';
    if (n === 'mischwald')  return '#4a7a3a';
    return '#4a7ab5';
}

function _baumArtLabel(tags) {
    if (!tags) return 'Andere';
    const raw = (tags['species:de'] || tags['species'] || tags['taxon'] || '').toLowerCase();
    if (raw.includes('buche')     || raw.includes('fagus'))                       return 'Buche';
    if (raw.includes('eiche')     || raw.includes('quercus'))                     return 'Eiche';
    if (raw.includes('fichte')    || raw.includes('picea'))                       return 'Fichte';
    if (raw.includes('kiefer')    || raw.includes('pinus') || raw.includes('föhre')) return 'Kiefer';
    if (raw.includes('lärche')    || raw.includes('laerche') || raw.includes('larix')) return 'Lärche';
    if (raw.includes('tanne')     || raw.includes('abies'))                       return 'Tanne';
    if (raw.includes('douglasie') || raw.includes('pseudotsuga'))                 return 'Douglasie';
    if (raw.includes('birke')     || raw.includes('betula'))                      return 'Birke';
    if (raw.includes('erle')      || raw.includes('alnus'))                       return 'Erle';
    if (raw.includes('esche')     || raw.includes('fraxinus'))                    return 'Esche';
    if (raw.includes('ahorn')     || raw.includes('acer'))                        return 'Ahorn';
    if (raw.includes('linde')     || raw.includes('tilia'))                       return 'Linde';
    if (raw.includes('pappel')    || raw.includes('populus'))                     return 'Pappel';
    if (raw.includes('kirsche')   || raw.includes('prunus'))                      return 'Kirsche';
    if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1, 24);
    const leaf = tags['leaf_type'] || '';
    if (leaf === 'broadleaved')  return 'Laubwald';
    if (leaf === 'needleleaved') return 'Nadelwald';
    if (leaf === 'mixed')        return 'Mischwald';
    return 'Andere';
}

function ladeBaeumeInSicht() {
    if (!map.hasLayer(bwiLayer)) return;

    clearTimeout(_baumDebounceTimer);
    _baumDebounceTimer = setTimeout(function() {
        _ladeBaeumeJetzt();
    }, 400);
}

function _ladeBaeumeJetzt() {
    if (!map.hasLayer(bwiLayer)) return;
    const zoom     = map.getZoom();
    const zoomHinw = document.getElementById('baum-zoom-hinweis');
    const ladeHinw = document.getElementById('baum-ladehinweis');

    if (zoom < 12) {
        // Overpass-Polygone entfernen, WMS-Übersicht sicherstellen
        Object.values(_baumGeogruppen).forEach(function(g) { bwiLayer.removeLayer(g); });
        _baumGeogruppen = {};
        if (!_baumWmsAktiv) { bwiLayer.addLayer(_baumWmsHolen()); _baumWmsAktiv = true; }
        if (zoomHinw) zoomHinw.style.display = '';
        if (ladeHinw) ladeHinw.style.display  = 'none';
        _aktualisiereBaumartListe({});
        return;
    }
    // Zoom ≥ 12: WMS durch Overpass-Artenpolygone ersetzen
    if (_baumWmsAktiv) { bwiLayer.removeLayer(_baumWmsHolen()); _baumWmsAktiv = false; }
    if (zoomHinw) zoomHinw.style.display = 'none';
    if (ladeHinw) ladeHinw.style.display  = '';

    const b    = map.getBounds();
    const bbox = b.getSouth().toFixed(5) + ',' + b.getWest().toFixed(5) + ',' +
                 b.getNorth().toFixed(5) + ',' + b.getEast().toFixed(5);
    const query =
        '[out:json][timeout:30];\n' +
        '(\n' +
        '  way["natural"="wood"]('    + bbox + ');\n' +
        '  way["landuse"="forest"]('  + bbox + ');\n' +
        ');\n' +
        'out body;\n>;\nout skel qt;';

    fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query)
    })
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function(data) {
            if (ladeHinw) ladeHinw.style.display = 'none';
            Object.values(_baumGeogruppen).forEach(function(g) { bwiLayer.removeLayer(g); });
            _baumGeogruppen = {};

            // Knotenkoordinaten indexieren
            const nodeMap = {};
            (data.elements || []).forEach(function(el) {
                if (el.type === 'node') nodeMap[el.id] = [el.lat, el.lon];
            });

            // Wege als Polygone rendern
            (data.elements || []).forEach(function(el) {
                if (el.type !== 'way') return;
                const coords = (el.nodes || []).map(function(id) { return nodeMap[id]; }).filter(Boolean);
                if (coords.length < 3) return;

                const tags  = el.tags || {};
                const art   = _baumArtLabel(tags);
                const farbe = getBaumartFarbe(art);

                if (!_baumGeogruppen[art]) _baumGeogruppen[art] = L.layerGroup();

                const poly = L.polygon(coords, {
                    color: farbe, fillColor: farbe,
                    weight: 0.8, fillOpacity: 0.5, opacity: 0.9
                });

                const name    = tags.name           || '';
                const spezDe  = tags['species:de']  || '';
                const spezLat = tags['species']      || '';
                const leaf    = tags['leaf_type']    || '';
                poly.bindPopup(
                    '🌲 <b>' + art + '</b>' +
                    (name   ? '<br><span style="font-size:0.88em">' + name + '</span>' : '') +
                    (spezDe ? '<br>Art: ' + spezDe : (spezLat ? '<br>Art: ' + spezLat : '')) +
                    (leaf   ? '<br>Laubtyp: ' + leaf : '')
                );
                _baumGeogruppen[art].addLayer(poly);
            });

            Object.keys(_baumGeogruppen).forEach(function(art) {
                if (!_baumDeaktiviertArten.has(art)) _baumGeogruppen[art].addTo(bwiLayer);
            });
            _aktualisiereBaumartListe(_baumGeogruppen);
        })
        .catch(function(err) {
            if (ladeHinw) ladeHinw.style.display = 'none';
            console.warn('Overpass Fehler:', err);
        });
}

function _aktualisiereBaumartListe(gruppen) {
    const liste = document.getElementById('baum-arten-liste');
    if (!liste) return;
    const arten = Object.keys(gruppen).sort();
    if (!arten.length) {
        liste.innerHTML = '<span style="font-size:0.82em;color:#aaa;">Keine Bäume in diesem Ausschnitt.</span>';
        return;
    }
    liste.innerHTML = arten.map(function(art) {
        const farbe    = getBaumartFarbe(art);
        const anzahl   = gruppen[art].getLayers().length;
        const an       = !_baumDeaktiviertArten.has(art);
        const safeArt  = art.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return '<label style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;font-size:0.85em;">' +
            '<input type="checkbox"' + (an ? ' checked' : '') +
            ' onchange="window.toggleBaumart(\'' + safeArt + '\',this.checked)">' +
            '<i style="background:' + farbe + ';width:12px;height:12px;border-radius:2px;display:inline-block;flex-shrink:0;"></i>' +
            '<span>' + art + ' <span style="color:#aaa;font-size:0.8em;">(' + anzahl + ')</span></span></label>';
    }).join('');
}

window.toggleBaumart = function(art, an) {
    if (an) {
        _baumDeaktiviertArten.delete(art);
        if (_baumGeogruppen[art]) _baumGeogruppen[art].addTo(bwiLayer);
    } else {
        _baumDeaktiviertArten.add(art);
        if (_baumGeogruppen[art]) bwiLayer.removeLayer(_baumGeogruppen[art]);
    }
};

window.alleBaumArtenAn = function() {
    _baumDeaktiviertArten.clear();
    Object.values(_baumGeogruppen).forEach(function(g) { g.addTo(bwiLayer); });
    _aktualisiereBaumartListe(_baumGeogruppen);
};

window.alleBaumArtenAus = function() {
    Object.keys(_baumGeogruppen).forEach(function(art) { _baumDeaktiviertArten.add(art); });
    Object.values(_baumGeogruppen).forEach(function(g) { bwiLayer.removeLayer(g); });
    _aktualisiereBaumartListe(_baumGeogruppen);
};

map.on('moveend zoomend', function() {
    if (map.hasLayer(bwiLayer)) ladeBaeumeInSicht();
});

// === 4. Live-Standort abfragen (via watchPosition – kein auto-setView) ===
let _standortMarker = null;
let _standortKreis  = null;
let _ersterStandort = true;

const _standortIcon = L.divIcon({
    className: '',
    html: '<div class="standort-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

navigator.geolocation.watchPosition(
    function(pos) {
        const latlng   = L.latLng(pos.coords.latitude, pos.coords.longitude);
        const accuracy = pos.coords.accuracy;

        if (_standortMarker) {
            _standortMarker.setLatLng(latlng);
            _standortKreis.setLatLng(latlng).setRadius(accuracy);
        } else {
            _standortMarker = L.marker(latlng, { icon: _standortIcon, zIndexOffset: 1000 }).addTo(map);
            _standortKreis  = L.circle(latlng, { radius: accuracy, color: '#2577b4', weight: 1, fillColor: '#2577b4', fillOpacity: 0.12 }).addTo(map);
        }

        if (_ersterStandort) {
            _ersterStandort = false;
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latlng.lat}&longitude=${latlng.lng}&current_weather=true`)
                .then(r => r.json())
                .then(function(daten) {
                    if (daten.current_weather) {
                        const anzeigeFeld = document.getElementById('wetter-anzeige');
                        if (anzeigeFeld) anzeigeFeld.innerHTML =
                            `${daten.current_weather.temperature} °C | 🏔️ Höhe: ${daten.elevation ?? '?'} m`;
                    }
                })
                .catch(function(err) { console.error('Wetter:', err); });
        }
    },
    function(err) { console.warn('GPS-Fehler:', err.message); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
);

window.zentriereAufStandort = function() {
    if (_standortMarker) {
        map.setView(_standortMarker.getLatLng(), 15);
    }
};

// === 5. Live-Wetter & Ortsname per Mausklick ===
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const latR = lat.toFixed(6);
    const lngR = lng.toFixed(6);

    const ladePopup = L.popup()
        .setLatLng(e.latlng)
        .setContent('<div style="padding:10px; text-align:center; color:#555;">⏳ Daten werden geladen...</div>')
        .openOn(map);

    const wetterUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latR}&longitude=${lngR}&current_weather=true&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Europe/Berlin`;
    const ortsUrl   = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latR}&lon=${lngR}`;

    Promise.all([fetch(ortsUrl).then(r => r.json()), fetch(wetterUrl).then(r => r.json())])
        .then(([ortsDaten, wetterDaten]) => {
            let ortsName = "Natur pur";
            if (ortsDaten.address) {
                ortsName = ortsDaten.address.city || ortsDaten.address.town ||
                           ortsDaten.address.village || ortsDaten.address.municipality || "Natur pur";
            }

            let wetterBlock = '';
            if (wetterDaten.current_weather && wetterDaten.daily) {
                const temp  = wetterDaten.current_weather.temperature;
                const wind  = wetterDaten.current_weather.windspeed;
                const regen = wetterDaten.daily.precipitation_sum;
                let regenSumme = 0;
                for (let i = 0; i < 7; i++) regenSumme += regen[i] || 0;
                regenSumme = Math.round(regenSumme * 10) / 10;
                wetterBlock = `
                    <div style="font-size:0.9em; color:#555; margin-bottom:3px;">🌡️ <b>${temp} °C</b> &nbsp;|&nbsp; 💨 ${wind} km/h</div>
                    <div style="font-size:0.82em; background:#eef5fc; color:#1e6091; padding:3px 10px; border-radius:20px; display:inline-block; font-weight:bold;">🌧️ 7-Tage-Regen: ${regenSumme} mm</div>`;
            }

            // Routing-Buttons je nach aktuellem Status
            const status = window.routingStatus;
            const zwischenstoppBtn = (status === 'route_fertig')
                ? `<button onclick="window.fuegeZwischenstopp(${latR},${lngR})" style="width:100%;padding:8px;background:#e67e22;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;font-size:0.85em;">➕ Zwischenstopp hier einfügen</button>`
                : '';

            ladePopup.setContent(`
                <div style="font-family:'Segoe UI',Tahoma,sans-serif; min-width:240px; padding:4px;">
                    <div style="text-align:center; margin-bottom:10px;">
                        <h4 style="margin:0 0 5px 0; color:#222; font-size:1.1em;">📍 ${ortsName}</h4>
                        ${wetterBlock}
                    </div>
                    <div style="border-top:1px solid #eee; padding-top:10px; display:flex; flex-direction:column; gap:7px;">
                        <div style="display:flex; gap:7px;">
                            <button onclick="window.setzeStart(${latR},${lngR})"
                                style="flex:1;padding:9px 4px;background:#27ae60;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;font-size:0.85em;">
                                🚀 Startpunkt
                            </button>
                            <button onclick="window.setzeZiel(${latR},${lngR})"
                                style="flex:1;padding:9px 4px;background:#2980b9;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;font-size:0.85em;">
                                🎯 Ziel setzen
                            </button>
                        </div>
                        ${zwischenstoppBtn}
                        <button onclick="window.speichereAuto(${latR},${lngR})"
                            style="width:100%;padding:8px;background:#7f8c8d;color:white;border:none;border-radius:7px;cursor:pointer;font-size:0.85em;">
                            🚗 Auto hier parken
                        </button>
                    </div>
                </div>
            `);
        })
        .catch(() => {
            ladePopup.setContent('<div style="padding:10px;">❌ Verbindung fehlgeschlagen.</div>');
        });
});

// === 6. Supabase (Cloud-Datenbank) initialisieren ===
const supabaseUrl = 'https://htaftyhatzvvdtatmapk.supabase.co';
const supabaseKey = 'sb_publishable_uV0gGE5DEujJncxSoXcCug_B9SM4VXR';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

window.pilzDatenSpeicher = {}; 
window.pilzMarkerSpeicher = {}; 

// === 6.1. Neues Fund-Formular (Rechtsklick) ===
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
    else {
        if (window._aufzeichnungAktiv && data && data[0]) {
            window._aufzeichnungFundeIds.push(data[0].id);
        }
        statusText.innerHTML = "✅ Gespeichert!";
        setTimeout(() => { map.closePopup(); ladePilzeAusCloud(); }, 1000);
    }
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
    
    if (p.foto_url) { html += `<img src="${p.foto_url}" onclick="window.oeffneLichtbox(${id},0)" style="width:100%;max-height:220px;object-fit:contain;background:#f9f9f9;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.15);cursor:pointer;">`; }
    if (p.foto_url_2 || p.foto_url_3) {
        html += `<div style="display:flex;gap:6px;justify-content:center;">`;
        if (p.foto_url_2) { html += `<img src="${p.foto_url_2}" onclick="window.oeffneLichtbox(${id},1)" style="flex:1;width:100%;height:100px;object-fit:contain;background:#f9f9f9;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.15);cursor:pointer;">`; }
        if (p.foto_url_3) { html += `<img src="${p.foto_url_3}" onclick="window.oeffneLichtbox(${id},2)" style="flex:1;width:100%;height:100px;object-fit:contain;background:#f9f9f9;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.15);cursor:pointer;">`; }
        html += `</div>`;
    }
    html += `</div></div>`;
    return html;
};

// === Foto-Lightbox ===
let _lichtboxFotos = [];
let _lichtboxIndex = 0;
let _lichtboxTouchX = null;

window.oeffneLichtbox = function(pilzId, startIndex) {
    const p = window.pilzDatenSpeicher[pilzId];
    _lichtboxFotos = [p.foto_url, p.foto_url_2, p.foto_url_3].filter(Boolean);
    _lichtboxIndex = Math.min(startIndex, _lichtboxFotos.length - 1);
    _lichtboxAktualisiere();
    document.getElementById('lichtbox').classList.add('offen');
};

window.schliesseLichtbox = function() {
    document.getElementById('lichtbox').classList.remove('offen');
};

window.lichtboxNavigiere = function(richtung) {
    _lichtboxIndex = Math.max(0, Math.min(_lichtboxFotos.length - 1, _lichtboxIndex + richtung));
    _lichtboxAktualisiere();
};

function _lichtboxAktualisiere() {
    document.getElementById('lichtbox-bild').src = _lichtboxFotos[_lichtboxIndex];
    document.getElementById('lichtbox-zurueck').classList.toggle('versteckt', _lichtboxIndex === 0);
    document.getElementById('lichtbox-weiter').classList.toggle('versteckt', _lichtboxIndex === _lichtboxFotos.length - 1);
    const dots = document.getElementById('lichtbox-dots');
    dots.innerHTML = _lichtboxFotos.length > 1
        ? _lichtboxFotos.map((_, i) => `<div class="lichtbox-dot${i === _lichtboxIndex ? ' aktiv' : ''}"></div>`).join('')
        : '';
}

const _lb = document.getElementById('lichtbox');
_lb.addEventListener('touchstart', function(e) { _lichtboxTouchX = e.touches[0].clientX; }, { passive: true });
_lb.addEventListener('touchend',   function(e) {
    if (_lichtboxTouchX === null) return;
    const diff = _lichtboxTouchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) window.lichtboxNavigiere(diff > 0 ? 1 : -1);
    _lichtboxTouchX = null;
});
document.addEventListener('keydown', function(e) {
    if (!_lb.classList.contains('offen')) return;
    if (e.key === 'ArrowRight') window.lichtboxNavigiere(1);
    if (e.key === 'ArrowLeft')  window.lichtboxNavigiere(-1);
    if (e.key === 'Escape')     window.schliesseLichtbox();
});

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
    { name: "Konstanz (Bodensee)", lat: 47.6592, lng: 9.1756 },
    // --- Ergänzungen: bisher nicht abgedeckte Regionen ---
    { name: "Bruchsal (Kraichgau)", lat: 49.1269, lng: 8.5978 },
    { name: "Sinsheim (Kraichgau)", lat: 49.2535, lng: 8.8758 },
    { name: "Mosbach (Neckar-Odenwald)", lat: 49.3533, lng: 9.1456 },
    { name: "Bühl (Ortenaukreis)", lat: 48.6981, lng: 8.1353 },
    { name: "Calw (Nordschwarzwald)", lat: 48.7166, lng: 8.7375 },
    { name: "Backnang (Murrtal)", lat: 48.9466, lng: 9.4338 },
    { name: "Waiblingen (Rems-Murr)", lat: 48.8304, lng: 9.3190 },
    { name: "Schwäbisch Gmünd (Ostalbkreis)", lat: 48.7997, lng: 9.7980 },
    { name: "Ellwangen (Jagst)", lat: 48.9619, lng: 10.1322 },
    { name: "Horb am Neckar", lat: 48.4440, lng: 8.6912 },
    { name: "Balingen (Zollernalb)", lat: 48.2736, lng: 8.8511 },
    { name: "Rottenburg am Neckar", lat: 48.4767, lng: 8.9339 },
    { name: "Münsingen (Schwäbische Alb)", lat: 48.4106, lng: 9.4956 },
    { name: "Ehingen (Donau)", lat: 48.2806, lng: 9.7244 },
    { name: "Singen (Hegau)", lat: 47.7600, lng: 8.8411 },
    { name: "Stockach (Hegau)", lat: 47.8521, lng: 8.9999 },
    { name: "Friedrichshafen (Bodensee-Ost)", lat: 47.6539, lng: 9.4785 },
    { name: "Wangen im Allgäu", lat: 47.6869, lng: 9.8335 },
    { name: "Leutkirch im Allgäu", lat: 47.8258, lng: 10.0161 },
    { name: "Schopfheim (Südschwarzwald)", lat: 47.6511, lng: 7.8222 }
];

const REGEN_REFRESH_MS = 15 * 60 * 1000; // alle 15 Minuten
let _regenInterval = null;

function ladeRegenStationen() {
    stationenLayer.clearLayers();
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
                        if (summe >= 5)  farbe = '#ffcc00';
                        if (summe >= 15) farbe = '#2ca25f';
                        if (summe >= 30) farbe = '#0055ff';

                        L.circleMarker([station.lat, station.lng], { radius: 12, fillColor: farbe, color: '#ffffff', weight: 2, fillOpacity: 0.85 })
                        .bindPopup(`<div style="text-align: center;">📍 <b>${station.name}</b><br><hr style="margin:5px 0;">🌧️ 7-Tage-Regen:<br><span style="font-size:1.2em; font-weight:bold; color:${farbe};">${summe} mm</span></div>`)
                        .addTo(stationenLayer);
                    }
                }).catch(function(f) { console.warn(f); });
        }, index * 200);
    });
}

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

map.on('overlayadd', function(e) {
    if (e.layer === stationenLayer) {
        regenLegende.addTo(map);
        ladeRegenStationen();
        _regenInterval = setInterval(ladeRegenStationen, REGEN_REFRESH_MS);
    }
    if (e.layer === phBodenLayer) {
        phLegende.addTo(map);
    }
    if (e.layer === bodenPhWms) {
        bodenPhLegende.addTo(map);
    }
    if (e.layer === bwiLayer) {
        const sek = document.getElementById('baum-filter-sektion');
        if (sek) sek.style.display = '';
        const panel = document.getElementById('filter-panel');
        const btn   = document.getElementById('filter-btn');
        if (panel && !panel.classList.contains('offen')) {
            panel.classList.add('offen');
            if (btn) btn.classList.add('aktiv');
        }
        bwiLayer.addLayer(_baumWmsHolen());
        _baumWmsAktiv = true;
        ladeBaeumeInSicht();
    }
});
map.on('overlayremove', function(e) {
    if (e.layer === stationenLayer) {
        regenLegende.remove();
        clearInterval(_regenInterval);
        _regenInterval = null;
    }
    if (e.layer === phBodenLayer) {
        phLegende.remove();
    }
    if (e.layer === bodenPhWms) {
        bodenPhLegende.remove();
    }
    if (e.layer === bwiLayer) {
        const sek = document.getElementById('baum-filter-sektion');
        if (sek) sek.style.display = 'none';
        bwiLayer.clearLayers();
        _baumGeogruppen = {};
        _baumWmsAktiv = false;
    }
});

// === 8. Suchfeld & Routenplaner ===
if (typeof L.Control.geocoder === 'function') {
    L.Control.geocoder({ position: 'topleft', placeholder: 'Ort oder Wald suchen...' }).addTo(map);
}

// === 8.0. Routing-Zustandsverwaltung ===
window.routingStatus = 'leer'; // 'leer' | 'start_gesetzt' | 'berechnung' | 'route_fertig'
window.routingAbortController = null;

window.aktualisiereRoutenBar = function() {
    const bar    = document.getElementById('routen-bar');
    const inhalt = document.getElementById('routen-bar-inhalt');
    if (!bar || !inhalt) return;

    bar.classList.remove('status-start', 'status-berechnung', 'status-fertig', 'status-gespeichert', 'status-aufzeichnung');

    if (window.routingStatus === 'leer') {
        bar.classList.remove('aktiv');
        return;
    }

    if (window.routingStatus === 'aufzeichnung') {
        bar.classList.add('aktiv', 'status-aufzeichnung');
        const vergangen = Date.now() - window._aufzeichnungStart;
        const min = Math.floor(vergangen / 60000);
        const sek = Math.floor((vergangen % 60000) / 1000);
        const zeitText = min > 0 ? `${min}m ${sek}s` : `${sek}s`;
        const distKm = (window._aufzeichnungDistanz / 1000).toFixed(2);
        inhalt.innerHTML = `
            <div class="rb-status"><span class="rb-rec-dot"></span>Aufzeichnung läuft</div>
            <div class="rb-stats-grid" style="grid-template-columns:1fr 1fr;">
                <div class="rb-stat">
                    <div class="rb-stat-val">📏 ${distKm} km</div>
                    <div class="rb-stat-label">Zurückgelegt</div>
                </div>
                <div class="rb-stat">
                    <div class="rb-stat-val">⏱️ ${zeitText}</div>
                    <div class="rb-stat-label">Dauer</div>
                </div>
            </div>
            <div class="rb-actions">
                <button class="routen-btn routen-btn-gruen" onclick="window.stoppeAufzeichnung()">⏹ Stopp & Speichern</button>
                <button class="routen-btn routen-btn-rot"   onclick="window.verwerfAufzeichnung()">🗑️</button>
            </div>`;
        return;
    }
    bar.classList.add('aktiv');

    if (window.routingStatus === 'start_gesetzt') {
        bar.classList.add('status-start');
        inhalt.innerHTML = `
            <div class="rb-status">🚀 Startpunkt gesetzt</div>
            <div class="rb-hint">Klicke auf der Karte auf <b>🎯 Ziel setzen</b>, um die Route zu berechnen.</div>
            <button class="routen-btn routen-btn-grau rb-btn-full" onclick="window.routeKomplettLoeschen()">✕ Abbrechen</button>`;
        return;
    }

    if (window.routingStatus === 'berechnung') {
        bar.classList.add('status-berechnung');
        inhalt.innerHTML = `
            <div class="rb-status">⏳ Route wird berechnet…</div>
            <div class="routen-ladebalken"></div>
            <button class="routen-btn routen-btn-grau rb-btn-full" onclick="window.abbrechenBerechnung()">✕ Abbrechen</button>`;
        return;
    }

    if (window.routingStatus === 'route_fertig') {
        bar.classList.add('status-fertig');
        const d = window.aktuelleTourDaten;
        const stunden = Math.floor(d.dauer / 60);
        const minuten = d.dauer % 60;
        const dauerText = stunden > 0 ? `${stunden}h ${minuten}m` : `${minuten} Min.`;
        inhalt.innerHTML = `
            <div class="rb-stats-grid">
                <div class="rb-stat">
                    <div class="rb-stat-val">📏 ${d.distanz} km</div>
                    <div class="rb-stat-label">Strecke</div>
                </div>
                <div class="rb-stat">
                    <div class="rb-stat-val">⏱️ ${dauerText}</div>
                    <div class="rb-stat-label">Gehzeit</div>
                </div>
                <div class="rb-stat">
                    <div class="rb-stat-val">↗ ${d.aufstieg} m</div>
                    <div class="rb-stat-label">Aufstieg</div>
                </div>
                <div class="rb-stat">
                    <div class="rb-stat-val">↘ ${d.abstieg} m</div>
                    <div class="rb-stat-label">Abstieg</div>
                </div>
            </div>
            <div class="rb-nsg">🌿 ${d.nsg_anteil}% Naturschutzgebiet</div>
            <div class="rb-actions">
                <button class="routen-btn routen-btn-gruen" onclick="window.oeffneTourSpeichern()">💾 Speichern</button>
                <button class="routen-btn routen-btn-rot"   onclick="window.routeKomplettLoeschen()">🗑️ Löschen</button>
            </div>`;
        return;
    }

    if (window.routingStatus === 'gespeicherte_route') {
        bar.classList.add('status-gespeichert');
        const d = window.angezeigteTourDaten;
        const dauerZelle = d.dauerText ? `
                <div class="rb-stat">
                    <div class="rb-stat-val">⏱️ ${d.dauerText}</div>
                    <div class="rb-stat-label">Gehzeit</div>
                </div>` : '';

        const genIkon = { 'Essbar': '🍽️', 'Ungenießbar': '🤢', 'Giftig': '☠️', 'Unbekannt': '❓' };
        const fundeBlock = d.funde && d.funde.length > 0 ? `
            <div style="background:#fff8f0; border-radius:9px; padding:9px 11px;">
                <div style="font-weight:bold; font-size:0.82em; color:#8e4a00; margin-bottom:6px;">
                    🍄 ${d.funde.length} Fund${d.funde.length > 1 ? 'e' : ''} auf dieser Tour
                </div>
                ${d.funde.map(f => `
                    <div style="font-size:0.8em; color:#555; padding:2px 0; border-bottom:1px solid #f0e0cc;">
                        ${genIkon[f.geniessbarkeit] || '❓'} ${f.notiz || '<i>Ohne Notiz</i>'}
                    </div>`).join('')}
            </div>` : '';

        inhalt.innerHTML = `
            <div class="rb-tour-name">🗺️ ${d.name}</div>
            <div class="rb-stats-grid">
                <div class="rb-stat">
                    <div class="rb-stat-val">📏 ${d.distanz} km</div>
                    <div class="rb-stat-label">Strecke</div>
                </div>
                ${dauerZelle}
                <div class="rb-stat">
                    <div class="rb-stat-val">↗ ${d.aufstieg} m</div>
                    <div class="rb-stat-label">Aufstieg</div>
                </div>
                <div class="rb-stat">
                    <div class="rb-stat-val">↘ ${d.abstieg} m</div>
                    <div class="rb-stat-label">Abstieg</div>
                </div>
                <div class="rb-stat">
                    <div class="rb-stat-val">🌿 ${d.nsg_anteil}%</div>
                    <div class="rb-stat-label">NSG</div>
                </div>
            </div>
            ${fundeBlock}
            <button class="routen-btn routen-btn-grau rb-btn-full" onclick="window.schliesseGespeicherteRoute()">✕ Schließen</button>`;
    }
};

window.setzeStart = function(lat, lng) {
    window.routingStatus = 'start_gesetzt';
    window.routenPlaner.setWaypoints([L.latLng(lat, lng)]);
    window.aktualisiereRoutenBar();
    map.closePopup();
};

window.setzeZiel = function(lat, lng) {
    if (window.routingStatus === 'leer') {
        // Kleiner Hinweis-Toast, kein Alert
        const hint = L.popup({ closeButton: false, autoPan: false, className: 'hint-popup' })
            .setLatLng(L.latLng(lat, lng))
            .setContent('<div style="padding:6px 10px; font-size:0.9em;">Bitte zuerst einen <b>🚀 Startpunkt</b> wählen!</div>')
            .openOn(map);
        setTimeout(() => map.closePopup(), 2200);
        return;
    }
    const punkte = window.routenPlaner.getWaypoints().filter(p => p.latLng);
    punkte.push(L.latLng(lat, lng));
    window.routingStatus = 'berechnung';
    window.aktualisiereRoutenBar();
    window.routenPlaner.setWaypoints(punkte);
    map.closePopup();
};

window.fuegeZwischenstopp = function(lat, lng) {
    const punkte = window.routenPlaner.getWaypoints().filter(p => p.latLng);
    // Vor dem letzten Punkt einfügen, damit die Reihenfolge stimmt
    punkte.splice(punkte.length - 1, 0, L.latLng(lat, lng));
    window.routingStatus = 'berechnung';
    window.aktualisiereRoutenBar();
    window.routenPlaner.setWaypoints(punkte);
    map.closePopup();
};

window.routeKomplettLoeschen = function() {
    if (window.routingAbortController) {
        window.routingAbortController.abort();
        window.routingAbortController = null;
    }
    if (window._routeLinie) { map.removeLayer(window._routeLinie); window._routeLinie = null; }
    window.routenPlaner.setWaypoints([]);
    window.aktuelleTourDaten = null;
    window.routingStatus = 'leer';
    window.aktualisiereRoutenBar();
    map.closePopup();
};

window.abbrechenBerechnung = function() {
    if (window.routingAbortController) {
        window.routingAbortController.abort();
        window.routingAbortController = null;
    }
    // Startpunkt bleibt erhalten — Nutzer kann einfach ein neues Ziel wählen
    window.routingStatus = 'start_gesetzt';
    window.aktualisiereRoutenBar();
};

// 🚨 HIER fügst du deinen kostenlosen Key von graphhopper.com ein:
const GH_API_KEY = '628e151d-3f4d-4914-885c-92fe701e71f9';

function zeigeRoutingFehler(meldung) {
    window.routingAbortController = null;
    window.routingStatus = 'start_gesetzt';
    const bar    = document.getElementById('routen-bar');
    const inhalt = document.getElementById('routen-bar-inhalt');
    if (!bar || !inhalt) return;
    bar.classList.add('aktiv');
    inhalt.innerHTML = `
        <span style="color:#e74c3c; font-weight:bold; flex:1;">${meldung}</span>
        <button class="routen-btn routen-btn-grau" onclick="window.routeKomplettLoeschen()">✕ Abbrechen</button>`;
}

window.routenPlaner = L.Routing.control({
    waypoints: [],
    routeWhileDragging: false,
    show: false,
    addWaypoints: false,
    fitSelectedRoutes: true,
    language: 'de',
    router: {
        route: function(waypoints, callback) {
            // Laufende Anfrage immer erst abbrechen
            if (window.routingAbortController) {
                window.routingAbortController.abort();
                window.routingAbortController = null;
            }

            const punkte = waypoints.filter(p => p.latLng);
            if (punkte.length < 2) { return; }

            window.routingAbortController = new AbortController();
            const signal = window.routingAbortController.signal;

            const points = punkte.map(p => [p.latLng.lng, p.latLng.lat]);
            const url = `https://graphhopper.com/api/1/route?key=${GH_API_KEY}`;

            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile: 'foot',
                    points: points,
                    points_encoded: false,
                    elevation: true
                }),
                signal: signal
            })
            .then(r => r.json())
            .then(data => {
                window.routingAbortController = null;
                if (!data.paths || data.message) {
                    console.error('GH Fehler:', data.message || 'Keine Pfade zurückgegeben');
                    zeigeRoutingFehler('❌ Route konnte nicht berechnet werden — bitte ein anderes Ziel wählen.');
                    return;
                }
                const path = data.paths[0];
                const latlngs = path.points.coordinates.map(
                    c => L.latLng(c[1], c[0], c[2] || 0)
                );
                // LRM 3.2.12: callback crasht intern (self._pendingRequest auf undefined).
                // Route direkt als Polyline zeichnen und Stats manuell berechnen.
                if (window._routeLinie) map.removeLayer(window._routeLinie);
                window._routeLinie = L.polyline(latlngs, { color: '#2577b4', weight: 6, opacity: 0.85 }).addTo(map);
                map.fitBounds(window._routeLinie.getBounds(), { padding: [40, 40] });
                window._verarbeiteRoute(latlngs, path.distance, path.time);
            })
            .catch(err => {
                window.routingAbortController = null;
                if (err.name === 'AbortError') return; // Nutzer hat abgebrochen — kein Fehler anzeigen
                console.error('Netzwerk-Fehler:', err);
                zeigeRoutingFehler('❌ Verbindung fehlgeschlagen — bitte versuche es erneut.');
            });
        }
    }
}).addTo(map);

// === 10. Routen-Auswertung ===
window.aktuelleTourDaten = null;
window._routeLinie = null;

window._verarbeiteRoute = function(coords, distanzM, zeitMs) {
    const distanzKm = (distanzM / 1000).toFixed(2);
    const dauerMin  = Math.round(zeitMs / 1000 / 60);

    let aufstieg = 0, abstieg = 0;
    for (let i = 1; i < coords.length; i++) {
        const diff = (coords[i].alt || 0) - (coords[i-1].alt || 0);
        if (diff > 0) aufstieg += diff; else abstieg += Math.abs(diff);
    }

    const schutzGebieteGeoJSON = holeAlleSchutzgebieteGeoJSON();
    let schutzPunkte = 0;
    if (schutzGebieteGeoJSON.features.length > 0) {
        coords.forEach(p => {
            const pt = turf.point([p.lng, p.lat]);
            if (schutzGebieteGeoJSON.features.some(f => {
                const typ = f.geometry && f.geometry.type;
                return (typ === 'Polygon' || typ === 'MultiPolygon') && turf.booleanPointInPolygon(pt, f);
            })) schutzPunkte++;
        });
    }
    const schutzAnteil = coords.length > 0 ? Math.round((schutzPunkte / coords.length) * 100) : 0;

    window.aktuelleTourDaten = {
        distanz: distanzKm,
        dauer:   dauerMin,
        aufstieg: Math.round(aufstieg),
        abstieg:  Math.round(abstieg),
        nsg_anteil: schutzAnteil,
        koordinaten: coords
    };

    window.routingStatus = 'route_fertig';
    window.aktualisiereRoutenBar();
};

window.routenPlaner.on('routingerror', function(e) {
    console.error('LRM routingerror:', e.error && e.error.message);
    zeigeRoutingFehler('❌ Route konnte nicht berechnet werden — bitte ein anderes Ziel wählen.');
});

// === 11. Tour-Speicher-Popup (öffnet sich über die Routen-Bar) ===
window.oeffneTourSpeichern = function() {
    const d = window.aktuelleTourDaten;
    if (!d) return;

    const stunden = Math.floor(d.dauer / 60);
    const minuten = d.dauer % 60;
    const dauerText = stunden > 0 ? `${stunden}h ${minuten}m` : `${minuten} Min.`;
    const mitte = d.koordinaten[Math.floor(d.koordinaten.length / 2)];

    L.popup({ maxWidth: 300 })
        .setLatLng(mitte)
        .setContent(`
            <div style="font-family:'Segoe UI',Tahoma,sans-serif; min-width:250px; text-align:center; padding:4px;">
                <h3 style="margin:0 0 14px 0; color:#2ca25f;">🏔️ Tour speichern</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
                    <div style="background:#f8f9fa; padding:10px; border-radius:8px;">
                        <div style="font-size:0.78em; color:#888;">Strecke</div>
                        <div style="font-weight:bold; color:#2c3e50;">${d.distanz} km</div>
                    </div>
                    <div style="background:#f8f9fa; padding:10px; border-radius:8px;">
                        <div style="font-size:0.78em; color:#888;">Gehzeit</div>
                        <div style="font-weight:bold; color:#2c3e50;">${dauerText}</div>
                    </div>
                    <div style="background:#f8f9fa; padding:10px; border-radius:8px;">
                        <div style="font-size:0.78em; color:#888;">Auf & Ab</div>
                        <div style="font-weight:bold; font-size:0.9em; color:#e67e22;">↗ ${d.aufstieg}m | ↘ ${d.abstieg}m</div>
                    </div>
                    <div style="background:#f8f9fa; padding:10px; border-radius:8px;">
                        <div style="font-size:0.78em; color:#888;">Natur</div>
                        <div style="font-weight:bold; color:#27ae60;">${d.nsg_anteil}% NSG</div>
                    </div>
                </div>
                <input type="text" id="tour-name" placeholder="Name für diese Tour?"
                    style="width:100%; padding:8px; margin-bottom:10px; border:1px solid #ccc; border-radius:6px; font-size:0.95em;">
                <button onclick="window.speichereFinaleTour()"
                    style="width:100%; padding:10px; background:#2ca25f; color:white; border:none; border-radius:7px; font-weight:bold; font-size:1em; cursor:pointer;">
                    💾 In Supabase speichern
                </button>
            </div>
        `)
        .openOn(map);
};

window.speichereFinaleTour = async function() {
    const name = document.getElementById('tour-name').value.trim() || "Wald-Expedition";
    const d = window.aktuelleTourDaten;

    const { data: routeData, error } = await _supabase.from('wanderrouten').insert([{
        name: name,
        distanz_km: parseFloat(d.distanz),
        hoehenmeter_auf: d.aufstieg,
        hoehenmeter_ab: d.abstieg,
        anteil_nsg_prozent: d.nsg_anteil,
        dauer_min: d.dauer,
        koordinaten: d.koordinaten
    }]).select('id').single();

    if (!error) {
        // Pilzfunde der Aufzeichnungssession mit der Route verknüpfen
        if (routeData && window._aufzeichnungFundeIds.length > 0) {
            await _supabase.from('pilze')
                .update({ route_id: routeData.id })
                .in('id', window._aufzeichnungFundeIds);
            window._aufzeichnungFundeIds = [];
            ladePilzeAusCloud();
        }
        alert("🎉 Tour erfolgreich gespeichert!");
        map.closePopup();
        window.routeKomplettLoeschen();
    } else {
        console.error(error);
        alert("❌ Speicher-Fehler – Details in der Konsole.");
    }
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

// === 9. Das Auto-Feature ===
window.meinAutoStandort = null;
let autoMarker = null;


const autoIcon = L.divIcon({
    html: '<div style="font-size: 35px; line-height: 1; text-shadow: 2px 2px 4px rgba(0,0,0,0.4); text-align:center;">🚗</div>',
    className: 'mein-auto',
    iconSize: [35, 35],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20]
});

function erstelleAutoMenue() {
    return `
        <div style="text-align:center; font-family: sans-serif; min-width: 150px;">
            <b style="font-size: 1.1em;">Dein Auto 🚗</b>
            <hr style="margin:8px 0; border:0; border-top:1px solid #ccc;">
            <button id="btn-route-auto" style="width:100%; margin-bottom:8px; background:#2ca25f; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">
                🚶 Bring mich hin!
            </button>
            <button id="btn-loesche-auto" style="width:100%; background:#ff3333; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                🗑️ Auto löschen
            </button>
        </div>
    `;
}

// Globaler popupopen-Listener — fängt ALLE Popups ab
map.on('popupopen', function() {
    setTimeout(function() {
        const btnRoute = document.getElementById('btn-route-auto');
        const btnLoesch = document.getElementById('btn-loesche-auto');
        if (btnRoute) btnRoute.addEventListener('click', routeZumAuto);
        if (btnLoesch) btnLoesch.addEventListener('click', loescheAuto);
    }, 50);
});

// Funktion 1: Auto parken
window.speichereAuto = function(lat, lng) {
    window.routeKomplettLoeschen(); // Route zurücksetzen + Status bar leeren

    window.meinAutoStandort = L.latLng(lat, lng);
    if (autoMarker) map.removeLayer(autoMarker);
    localStorage.setItem('meinParkplatz', JSON.stringify({ lat: lat, lng: lng }));

    autoMarker = L.marker(window.meinAutoStandort, { icon: autoIcon })
        .addTo(map)
        .bindPopup(erstelleAutoMenue())
        .openPopup();
};

// Funktion 2: Route zum Auto
window.routeZumAuto = function() {
    if (!window.meinAutoStandort) return;
    window.routingStatus = 'berechnung';
    window.aktualisiereRoutenBar();
    navigator.geolocation.getCurrentPosition(function(pos) {
        window.routenPlaner.setWaypoints([
            L.latLng(pos.coords.latitude, pos.coords.longitude),
            window.meinAutoStandort
        ]);
        map.closePopup();
    }, function() {
        window.routenPlaner.setWaypoints([map.getCenter(), window.meinAutoStandort]);
        map.closePopup();
    });
};

// Funktion 3: Auto löschen
window.loescheAuto = function() {
    window.routeKomplettLoeschen();
    if (autoMarker) {
        map.removeLayer(autoMarker);
        window.meinAutoStandort = null;
        autoMarker = null;
        localStorage.removeItem('meinParkplatz');
    }
};

// Funktion 4: Beim Seitenstart laden
window.ladeAutoBeimStart = function() {
    const gespeichert = localStorage.getItem('meinParkplatz');
    if (gespeichert) {
        const coords = JSON.parse(gespeichert);
        window.meinAutoStandort = L.latLng(coords.lat, coords.lng);
        autoMarker = L.marker(window.meinAutoStandort, { icon: autoIcon })
            .addTo(map)
            .bindPopup(erstelleAutoMenue());
    }
};

ladeAutoBeimStart();

// === 12. Filter-Panel: Pilzfunde & gespeicherte Routen ===
window._gespeicherteRouteLinie = null;

window.toggleFilterPanel = function() {
    const panel = document.getElementById('filter-panel');
    const btn   = document.getElementById('filter-btn');
    const offen = panel.classList.toggle('offen');
    btn.classList.toggle('aktiv', offen);
    if (offen) window.ladeGespeicherteRouten();
};

const _genIkon = { 'Essbar': '🍽️', 'Ungenießbar': '🤢', 'Giftig': '☠️', 'Unbekannt': '❓' };
window._gefilterteIds = [];

window.wendeFilterAn = function() {
    const suchText   = (document.getElementById('filter-name').value || '').toLowerCase().trim();
    const essbarkeit = document.getElementById('filter-essbarkeit').value;
    const von        = document.getElementById('filter-von').value;
    const bis        = document.getElementById('filter-bis').value;

    const gefunden = [];
    Object.keys(window.pilzDatenSpeicher).forEach(function(id) {
        const p = window.pilzDatenSpeicher[id];
        let zeigen = true;
        if (suchText   && !(p.notiz || '').toLowerCase().includes(suchText)) zeigen = false;
        if (essbarkeit && p.geniessbarkeit !== essbarkeit)                    zeigen = false;
        if (von && p.created_at && p.created_at.slice(0, 10) < von)          zeigen = false;
        if (bis && p.created_at && p.created_at.slice(0, 10) > bis)          zeigen = false;
        if (zeigen) gefunden.push({ id, p });
    });

    window._gefilterteIds = gefunden.map(function(f) { return f.id; });

    const ergebnis = document.getElementById('filter-ergebnis');
    if (!gefunden.length) {
        ergebnis.innerHTML = '<span style="color:#e74c3c; font-size:0.85em;">Keine Funde gefunden.</span>';
        return;
    }

    let html = `<button onclick="window.zeigeAlleGefiltert()" style="width:100%;padding:9px;background:#2577b4;color:white;border:none;border-radius:7px;font-weight:bold;cursor:pointer;font-size:0.88em;margin-bottom:10px;">📍 Alle ${gefunden.length} auf Karte zeigen</button>`;

    html += gefunden.map(function(f) {
        const p = f.p;
        const datum = p.created_at ? p.created_at.slice(0, 10) : '';
        const foto  = p.foto_url
            ? `<img src="${p.foto_url}" style="width:46px;height:46px;object-fit:cover;border-radius:6px;margin-right:10px;flex-shrink:0;">`
            : `<div style="width:46px;height:46px;background:#f0ece8;border-radius:6px;margin-right:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.3em;">🍄</div>`;
        const ikon  = _genIkon[p.geniessbarkeit] || '❓';
        const notiz = p.notiz ? p.notiz : '<i style="color:#bbb;">Ohne Notiz</i>';
        return `<div onclick="window.springeZuFund('${f.id}')" style="display:flex;align-items:center;padding:8px 2px;border-bottom:1px solid #f0f0f0;cursor:pointer;">
            ${foto}
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.85em;font-weight:bold;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ikon} ${notiz}</div>
                <div style="font-size:0.75em;color:#aaa;margin-top:2px;">${datum}</div>
            </div>
        </div>`;
    }).join('');

    ergebnis.innerHTML = html;
};

window.zeigeAlleGefiltert = function() {
    if (!map.hasLayer(fundstellenLayer)) map.addLayer(fundstellenLayer);
    const sichtbar = new Set(window._gefilterteIds.map(String));
    Object.keys(window.pilzMarkerSpeicher).forEach(function(id) {
        const marker = window.pilzMarkerSpeicher[id];
        if (sichtbar.has(String(id))) {
            if (!fundstellenLayer.hasLayer(marker)) fundstellenLayer.addLayer(marker);
        } else {
            fundstellenLayer.removeLayer(marker);
        }
    });
    window.toggleFilterPanel();
};

window.springeZuFund = function(id) {
    const p = window.pilzDatenSpeicher[id];
    const marker = window.pilzMarkerSpeicher[id];
    if (!p || !marker) return;
    if (!map.hasLayer(fundstellenLayer)) map.addLayer(fundstellenLayer);
    map.setView([p.lat, p.lng], 15);
    marker.openPopup();
    window.toggleFilterPanel();
};

window.filterZuruecksetzen = function() {
    document.getElementById('filter-name').value       = '';
    document.getElementById('filter-essbarkeit').value = '';
    document.getElementById('filter-von').value        = '';
    document.getElementById('filter-bis').value        = '';
    document.getElementById('filter-ergebnis').innerHTML = '';
    window._gefilterteIds = [];

    if (!map.hasLayer(fundstellenLayer)) map.addLayer(fundstellenLayer);
    Object.keys(window.pilzMarkerSpeicher).forEach(function(id) {
        const marker = window.pilzMarkerSpeicher[id];
        if (!fundstellenLayer.hasLayer(marker)) fundstellenLayer.addLayer(marker);
    });
};

window.ladeGespeicherteRouten = async function() {
    const liste = document.getElementById('routen-liste-panel');
    liste.innerHTML = '<span style="color:#aaa; font-size:0.88em;">⏳ Wird geladen…</span>';

    const { data, error } = await _supabase
        .from('wanderrouten')
        .select('id, name, distanz_km, hoehenmeter_auf, hoehenmeter_ab, anteil_nsg_prozent')
        .order('id', { ascending: false });

    if (error || !data || !data.length) {
        liste.innerHTML = '<span style="color:#aaa; font-size:0.88em;">Keine gespeicherten Routen vorhanden.</span>';
        return;
    }

    liste.innerHTML = '';
    data.forEach(function(r) {
        const div = document.createElement('div');
        div.className = 'routen-eintrag';
        div.id = `re-${r.id}`;
        div.innerHTML = `
            <div class="routen-eintrag-name">🗺️ ${r.name}</div>
            <div class="routen-eintrag-meta">
                📏 ${r.distanz_km} km &nbsp;·&nbsp;
                ↗ ${r.hoehenmeter_auf}m ↘ ${r.hoehenmeter_ab}m &nbsp;·&nbsp;
                🌿 ${r.anteil_nsg_prozent}% NSG
            </div>
            <div class="routen-eintrag-actions">
                <button class="btn-zeigen"         onclick="window.zeigeGespeicherteRoute(${r.id})">📍 Anzeigen</button>
                <button class="btn-loeschen-route" onclick="window.loescheGespeicherteRoute(${r.id})">🗑️ Löschen</button>
            </div>`;
        liste.appendChild(div);
    });
};

window.angezeigteTourDaten = null;

window.zeigeGespeicherteRoute = async function(id) {
    const btn = document.querySelector(`#re-${id} .btn-zeigen`);
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

    const [{ data, error }, { data: funde }] = await Promise.all([
        _supabase.from('wanderrouten').select('*').eq('id', id).single(),
        _supabase.from('pilze').select('id, notiz, geniessbarkeit').eq('route_id', id)
    ]);

    if (btn) { btn.textContent = '📍 Anzeigen'; btn.disabled = false; }
    if (error || !data || !data.koordinaten) return;

    // Aktiven Eintrag hervorheben
    document.querySelectorAll('.routen-eintrag').forEach(el => el.classList.remove('aktiv'));
    const eintrag = document.getElementById(`re-${id}`);
    if (eintrag) eintrag.classList.add('aktiv');

    if (window._gespeicherteRouteLinie) map.removeLayer(window._gespeicherteRouteLinie);
    const latlngs = data.koordinaten.map(c => L.latLng(c.lat, c.lng));
    window._gespeicherteRouteLinie = L.polyline(latlngs, {
        color: '#8e44ad', weight: 5, opacity: 0.85, dashArray: '10, 6'
    }).addTo(map);
    map.fitBounds(window._gespeicherteRouteLinie.getBounds(), { padding: [40, 40] });

    const dMin = data.dauer_min || 0;
    const dauerText = dMin > 0
        ? (Math.floor(dMin / 60) > 0 ? `${Math.floor(dMin / 60)}h ${dMin % 60}m` : `${dMin} Min.`)
        : null;

    window.angezeigteTourDaten = {
        name:      data.name,
        distanz:   data.distanz_km,
        aufstieg:  data.hoehenmeter_auf,
        abstieg:   data.hoehenmeter_ab,
        nsg_anteil: data.anteil_nsg_prozent,
        dauerText: dauerText,
        funde:     funde || []
    };
    window.routingStatus = 'gespeicherte_route';
    window.aktualisiereRoutenBar();

    window.toggleFilterPanel();
};

window.schliesseGespeicherteRoute = function() {
    if (window._gespeicherteRouteLinie) {
        map.removeLayer(window._gespeicherteRouteLinie);
        window._gespeicherteRouteLinie = null;
    }
    document.querySelectorAll('.routen-eintrag').forEach(el => el.classList.remove('aktiv'));
    window.angezeigteTourDaten = null;
    window.routingStatus = 'leer';
    window.aktualisiereRoutenBar();
};

// === 13. Live-Route aufzeichnen ===
window._aufzeichnungAktiv    = false;
window._aufzeichnungPunkte   = [];
window._aufzeichnungLinie    = null;
window._aufzeichnungWatchId  = null;
window._aufzeichnungStart    = null;
window._aufzeichnungTimer    = null;
window._aufzeichnungDistanz  = 0;
window._aufzeichnungFundeIds = [];

function _aufzeichnungBtnAktualisieren() {
    const btn = document.getElementById('aufzeichnung-btn');
    if (!btn) return;
    if (window._aufzeichnungAktiv) {
        btn.textContent = '⏺ Läuft…';
        btn.classList.add('aktiv');
    } else {
        btn.textContent = '⏺ Aufzeichnen';
        btn.classList.remove('aktiv');
    }
}

window.toggleAufzeichnung = function() {
    if (window._aufzeichnungAktiv) window.stoppeAufzeichnung();
    else window.starteAufzeichnung();
};

window.starteAufzeichnung = function() {
    if (!navigator.geolocation) { alert('GPS nicht verfügbar auf diesem Gerät.'); return; }

    window._aufzeichnungAktiv   = true;
    window._aufzeichnungPunkte  = [];
    window._aufzeichnungDistanz = 0;
    window._aufzeichnungStart   = Date.now();

    if (window._aufzeichnungLinie) map.removeLayer(window._aufzeichnungLinie);
    window._aufzeichnungLinie = L.polyline([], {
        color: '#e74c3c', weight: 5, opacity: 0.9
    }).addTo(map);

    window.routingStatus = 'aufzeichnung';
    window.aktualisiereRoutenBar();
    _aufzeichnungBtnAktualisieren();

    window._aufzeichnungWatchId = navigator.geolocation.watchPosition(
        function(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const alt = pos.coords.altitude || 0;

            if (window._aufzeichnungPunkte.length > 0) {
                const prev = window._aufzeichnungPunkte[window._aufzeichnungPunkte.length - 1];
                const distM = turf.distance(
                    turf.point([prev.lng, prev.lat]),
                    turf.point([lng, lat]),
                    { units: 'meters' }
                );
                if (distM < 10) return; // GPS-Rauschen filtern
                window._aufzeichnungDistanz += distM;
            }

            window._aufzeichnungPunkte.push({ lat, lng, alt });
            window._aufzeichnungLinie.addLatLng(L.latLng(lat, lng, alt));
            window.aktualisiereRoutenBar();
        },
        function(err) { console.warn('GPS-Fehler:', err.message); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Timer für Zeitanzeige (alle 10 Sek)
    window._aufzeichnungTimer = setInterval(function() {
        if (window.routingStatus === 'aufzeichnung') window.aktualisiereRoutenBar();
    }, 10000);
};

window.stoppeAufzeichnung = function() {
    if (window._aufzeichnungWatchId !== null) {
        navigator.geolocation.clearWatch(window._aufzeichnungWatchId);
        window._aufzeichnungWatchId = null;
    }
    clearInterval(window._aufzeichnungTimer);
    window._aufzeichnungTimer  = null;
    window._aufzeichnungAktiv  = false;
    _aufzeichnungBtnAktualisieren();

    if (window._aufzeichnungPunkte.length < 2) {
        window.verwerfAufzeichnung();
        return;
    }

    // Stats berechnen (identisch zu _verarbeiteRoute)
    const coords = window._aufzeichnungPunkte.map(p => L.latLng(p.lat, p.lng, p.alt));
    let aufstieg = 0, abstieg = 0;
    for (let i = 1; i < coords.length; i++) {
        const diff = (coords[i].alt || 0) - (coords[i-1].alt || 0);
        if (diff > 0) aufstieg += diff; else abstieg += Math.abs(diff);
    }

    const schutzGebieteGeoJSON = holeAlleSchutzgebieteGeoJSON();
    let schutzPunkte = 0;
    if (schutzGebieteGeoJSON.features.length > 0) {
        coords.forEach(p => {
            const pt = turf.point([p.lng, p.lat]);
            if (schutzGebieteGeoJSON.features.some(f => {
                const typ = f.geometry && f.geometry.type;
                return (typ === 'Polygon' || typ === 'MultiPolygon') && turf.booleanPointInPolygon(pt, f);
            })) schutzPunkte++;
        });
    }

    window.aktuelleTourDaten = {
        distanz:    (window._aufzeichnungDistanz / 1000).toFixed(2),
        dauer:      Math.round((Date.now() - window._aufzeichnungStart) / 60000),
        aufstieg:   Math.round(aufstieg),
        abstieg:    Math.round(abstieg),
        nsg_anteil: coords.length > 0 ? Math.round((schutzPunkte / coords.length) * 100) : 0,
        koordinaten: coords
    };

    // Aufzeichnungs-Polyline als aktive Route übernehmen
    if (window._routeLinie) map.removeLayer(window._routeLinie);
    window._routeLinie        = window._aufzeichnungLinie;
    window._aufzeichnungLinie = null;
    window._aufzeichnungPunkte = [];
    map.fitBounds(window._routeLinie.getBounds(), { padding: [40, 40] });

    // In bestehenden "route_fertig"-Zustand übergehen → Speichern-Button erscheint
    window.routingStatus = 'route_fertig';
    window.aktualisiereRoutenBar();
};

window.verwerfAufzeichnung = function() {
    if (window._aufzeichnungWatchId !== null) {
        navigator.geolocation.clearWatch(window._aufzeichnungWatchId);
        window._aufzeichnungWatchId = null;
    }
    clearInterval(window._aufzeichnungTimer);
    window._aufzeichnungTimer   = null;
    window._aufzeichnungAktiv    = false;
    window._aufzeichnungPunkte   = [];
    window._aufzeichnungDistanz  = 0;
    window._aufzeichnungFundeIds = [];
    if (window._aufzeichnungLinie) { map.removeLayer(window._aufzeichnungLinie); window._aufzeichnungLinie = null; }
    _aufzeichnungBtnAktualisieren();
    window.routingStatus = 'leer';
    window.aktualisiereRoutenBar();
};

window.loescheGespeicherteRoute = async function(id) {
    if (!confirm('Möchtest du diese Route wirklich löschen?')) return;
    const { error } = await _supabase.from('wanderrouten').delete().eq('id', id);
    if (!error) {
        const eintrag = document.getElementById(`re-${id}`);
        if (eintrag) eintrag.remove();
        if (window._gespeicherteRouteLinie) {
            map.removeLayer(window._gespeicherteRouteLinie);
            window._gespeicherteRouteLinie = null;
        }
    }
};
