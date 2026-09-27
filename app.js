// 1. Inisialisasi Peta
var map = L.map('map', {
    preferCanvas: true,
    minZoom: 9,
    maxZoom: 17
}).setView([-7.7543, 113.2159], 10);

// 2. Opsi Basemap
var esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 17
});
var esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 17
});
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 17
});

esriTopo.addTo(map);

var baseMaps = {
    "Esri Topography": esriTopo,
    "Esri Satellite": esriSatellite,
    "OpenStreetMap": osm
};
L.control.layers(baseMaps).addTo(map);

// 3. Layer Global
var wilayahLayer;                                   // Peta dasar wilayah (Choropleth)
var mangroveJatimLayer = L.layerGroup().addTo(map); // Penampung data mangrove grid (kuning)
var gridJatimLayer;                                 // Peta radar grid (tak terlihat)
var loadedGrids = new Set();                        // Memori kotak grid yang sudah diunduh

// 4. Gradasi Warna Wilayah
function getColor(luas) {
    return luas >= 500 ? '#00441b' : 
           luas >= 250 ? '#006d2c' :
           luas >= 100 ? '#238b45' :
           luas >= 50  ? '#41ab5d' :
           luas >= 25  ? '#74c476' :
           luas >= 10  ? '#a1d99b' :
           luas >  0   ? '#c7e9c0' : 
                         '#ffffff';  
}

// 5. Style Poligon Wilayah Dinamis
function styleWilayah(feature) {
    var luas = feature.properties.Luas_Mangrove || 0;
    var currentZoom = map.getZoom();

    if (currentZoom >= 14) {
        // ZOOM 14+: Hilangkan warna fill, sisa garis tepi abu-abu
        return {
            fillColor: getColor(luas),
            weight: 1,           
            color: '#999',       
            fillOpacity: 0       
        };
    } else {
        // ZOOM < 14: Warna fill muncul 60%, tanpa garis tepi
        return {
            fillColor: getColor(luas),
            weight: 0,
            fillOpacity: luas > 0 ? 0.4 : 0 
        };
    }
}

// 6. Tooltip Wilayah
function onEachFeature(feature, layer) {
    var luas = feature.properties.Luas_Mangrove || 0;
    var desa = feature.properties.WADMKD || "-";
    var kec = feature.properties.WADMKC || "-";
    var kab = feature.properties.WADMKK || "-";

    var lokasi = desa + " - " + kec + " - " + kab;
    if (luas > 0) {
        layer.bindTooltip("<b>Lokasi: " + lokasi + "</b><br>Luas Mangrove: " + luas.toFixed(4) + " Ha");
    }
}

// 7. FUNGSI RADAR: Memanggil Tile dari 2 Folder Berbeda (Desa & Grid Jatim)
function loadVisibleGridJatim() {
    if (map.getZoom() < 14 || !gridJatimLayer) return;

    var mapBounds = map.getBounds();

    gridJatimLayer.eachLayer(function(layer) {
        var tipe = layer.feature.properties.Type;
        var filename = layer.feature.properties.FileName;

        // Gunakan filename sebagai ID memori agar tidak ada file ganda yang diunduh berulang
        if (filename && !loadedGrids.has(filename) && mapBounds.intersects(layer.getBounds())) {
            loadedGrids.add(filename);

            // Cerdas Memilih Folder: Jika Desa arahkan ke data_mangrove, jika Grid arahkan ke data_mangrovejatim
            var folder = (tipe === "Desa") ? "data_mangrove" : "data_mangrovejatim";
            var pathTile = 'data/' + folder + '/' + encodeURIComponent(filename);
            
            fetch(pathTile)
                .then(response => { if(response.ok) return response.json(); })
                .then(data => {
                    if(data) {
                        var tileBaru = L.geoJSON(data, {
                            style: { 
                                // Cerdas Memilih Warna: Jika Desa beri warna HIJAU, jika Grid beri warna KUNING
                                color: tipe === "Desa" ? "#00ff00" : "#ffff00",       
                                weight: 1.5, 
                                fillColor: tipe === "Desa" ? "#00ff00" : "#ffff00",   
                                fillOpacity: 1.0 
                            }
                        });
                        mangroveJatimLayer.addLayer(tileBaru);
                    }
                }).catch(e => {}); 
        }
    });
}

// 8. KONTROL INTERAKSI LAYAR (Zoom & Geser)
map.on('zoomend', function() {
    // Selalu perbarui transparansi peta desa saat zoom
    if (wilayahLayer) {
        wilayahLayer.setStyle(styleWilayah);
    }

    if (map.getZoom() >= 14) {
        loadVisibleGridJatim(); // Panggil mangrove grid
    } else {
        // Bersihkan mangrove grid saat zoom out
        mangroveJatimLayer.clearLayers(); 
        loadedGrids.clear();
    }
});

map.on('moveend', function() {
    if (map.getZoom() >= 14) {
        loadVisibleGridJatim(); 
    }
});

// 9. Legenda 
var legend = L.control({position: 'bottomright'});
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend');
    var grades = [0, 0.1, 10, 25, 50, 100, 250, 500]; 
    var labels = ['<strong>Luas Mangrove (Ha)</strong><br>'];

    for (var i = 0; i < grades.length; i++) {
        var from = grades[i];
        var to = grades[i + 1];
        var textDisplay = '';

        if (from === 0 && to === 0.1) {
            textDisplay = '0 (Tidak Ada)';
        } else if (from === 0.1) {
            textDisplay = '0.1 &ndash; 10';
        } else {
            textDisplay = from + (to ? '&ndash;' + to : '+');
        }

        var legendColor = getColor(from + 0.1);
        var legendOpacity = from === 0 ? '0' : '0.4';
        var legendBorder = from === 0 ? '1px dashed #999' : 'none';

        labels.push('<i style="background:' + legendColor + '; opacity:' + legendOpacity + '; border:' + legendBorder + ';"></i> ' + textDisplay);
    }
    div.innerHTML = labels.join('<br>');
    return div;
};
legend.addTo(map);

// 10. Memuat Data Wilayah Dasar (Peta Desa)
console.log("Memuat data wilayah...");
fetch('data/Wilker_STBD_mangrove.geojson') 
    .then(response => response.json())
    .then(data => {
        wilayahLayer = L.geoJSON(data, {
            style: styleWilayah,
            onEachFeature: onEachFeature
        }).addTo(map);
        console.log("Data wilayah berhasil dimuat!");
    })
    .catch(error => console.error("Gagal memuat GeoJSON Wilayah:", error));

// 11. Memuat Peta Radar Transparan (Untuk Tiling)
console.log("Memuat radar grid...");
fetch('data/indeks_grid_jatim.geojson')
    .then(response => {
        if (!response.ok) throw new Error("File indeks grid tidak ditemukan!");
        return response.json();
    })
    .then(data => {
        gridJatimLayer = L.geoJSON(data, {
            style: { opacity: 0, fillOpacity: 0 } // Sengaja dibuat tembus pandang
        }).addTo(map);
        
        console.log("Radar Grid berhasil diaktifkan!");
        // Antisipasi jika pengguna me-refresh halaman saat kondisi zoom sudah 14+
        loadVisibleGridJatim(); 
    })
    .catch(error => console.error("Gagal memuat Radar Grid:", error));
