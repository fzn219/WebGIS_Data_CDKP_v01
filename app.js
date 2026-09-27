// 1. Inisialisasi Peta
var map = L.map('map', {
    preferCanvas: true,
    minZoom: 9,
    maxZoom: 17
}).setView([-7.7543, 113.2159], 10);

// 2. Tiga Opsi Basemap
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

// 3. Layer Kosong untuk Mangrove & Wilayah
var mangroveLayer = L.layerGroup().addTo(map);
var wilayahLayer; // Variabel global untuk menyimpan data batas desa

// DAFTAR MEMORI: Menyimpan nama desa yang sudah di-load agar tidak dipanggil berulang kali
var loadedDesa = new Set(); 

// 4. Gradasi Warna
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

// 5. Style Poligon Dinamis (Berubah berdasarkan level Zoom)
function styleWilayah(feature) {
    var luas = feature.properties.Luas_Mangrove || 0;
    var currentZoom = map.getZoom();

    if (currentZoom >= 14) {
        // MODE ZOOM IN: Transparansi 100% (hilang), munculkan garis batas tipis
        return {
            fillColor: getColor(luas),
            weight: 1,           // Garis batas muncul
            color: '#999',       // Warna garis batas abu-abu
            fillOpacity: 0       // Warna fill hilang
        };
    } else {
        // MODE ZOOM OUT (Default Fase 1.1): Tidak ada batas, warna muncul (60%)
        return {
            fillColor: getColor(luas),
            weight: 0,
            fillOpacity: luas > 0 ? 0.4 : 0 
        };
    }
}

// 6. Tooltip (Hanya memunculkan Info, fungsi Klik dihapus)
function onEachFeature(feature, layer) {
    var luas = feature.properties.Luas_Mangrove || 0;
    var desa = feature.properties.WADMKD || "-";
    var kec = feature.properties.WADMKC || "-";
    var kab = feature.properties.WADMKK || "-";

    var lokasi = desa + " - " + kec + " - " + kab;
    var luasFormat = luas.toFixed(4);

    if (luas > 0) {
        layer.bindTooltip("<b>Lokasi: " + lokasi + "</b><br>Luas Mangrove: " + luasFormat + " Ha");
    }
    // layer.on('click') dihapus karena sekarang otomatis!
}

// 7. FUNGSI RADAR LAYAR: Memunculkan visual mangrove murni berdasarkan sorotan layar
function loadVisibleMangroves() {
    // Jangan lakukan apa-apa jika zoom di bawah 14
    if (map.getZoom() < 14 || !wilayahLayer) return;

    var mapBounds = map.getBounds(); // Ambil kotak koordinat layar saat ini

    wilayahLayer.eachLayer(function(layer) {
        var desa = layer.feature.properties.WADMKD;

        // Jika poligon desa masuk ke dalam sorotan layar dan belum dimuat
        if (desa && !loadedDesa.has(lokasiID) && mapBounds.intersects(layer.getBounds())) {
            loadedDesa.add(lokasiID); 

            // Pastikan format ini SAMA PERSIS dengan nama file dari ArcPy Anda
            // Gunakan spasi sebelum dan sesudah tanda strip
            var namaFile = desa + " – " + kec + " – " + kab + ".geojson"; 
            
            // Encode agar spasi dan tanda baca aman untuk link URL
            var pathMangrove = 'data/data_mangrove/' + encodeURIComponent(namaFile);
            
            console.log("🔍 Mencari mangrove: " + pathMangrove);

            fetch(pathMangrove)
            .then(response => {
                    // Jika file ada, ubah ke JSON. Jika tidak ada (desa tanpa mangrove), abaikan.
                    if(response.ok) return response.json();
                })
                .then(data => {
                    if(data) {
                        // Tampilkan murni sebagai visual Hijau Terang
                        var mangroveBaru = L.geoJSON(data, {
                            style: { 
                                color: "#00ff00",       // Garis batas Hijau Terang
                                weight: 1.5, 
                                fillColor: "#00ff00",   // Isi poligon Hijau Terang
                                fillOpacity: 0.8 
                            }
                        });
                        mangroveLayer.addLayer(mangroveBaru);
                    }
                })
                .catch(error => {
                    // Abaikan diam-diam jika data/file mangrove untuk desa ini memang tidak ada
                });
        }
    });
}

// 8. KONTROL INTERAKSI LAYAR (Zoom & Geser)
map.on('zoomend', function() {
    var currentZoom = map.getZoom();
    
    // Perbarui tampilan warna/garis desa setiap kali zoom selesai
    if (wilayahLayer) {
        wilayahLayer.setStyle(styleWilayah);
    }

    if (currentZoom >= 14) {
        // Tembakkan radar untuk memanggil mangrove jika zoom 14+
        loadVisibleMangroves();
    } else {
        // Jika di zoom out (<14), bersihkan peta dari warna merah dan reset memori!
        mangroveLayer.clearLayers();
        loadedDesa.clear();
    }
});

map.on('moveend', function() {
    // Tembakkan radar saat layar digeser, HANYA jika sedang di zoom 14+
    if (map.getZoom() >= 14) {
        loadVisibleMangroves();
    }
});

// 9. Legenda (Tetap sama)
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

// 10. Memanggil Data GeoJSON Batas Wilayah (Tetap sama)
console.log("Memuat data wilayah...");
fetch('data/Wilker_STBD_mangrove.geojson') 
    .then(response => response.json())
    .then(data => {
        wilayahLayer = L.geoJSON(data, {
            style: styleWilayah,
            onEachFeature: onEachFeature
        }).addTo(map);
        console.log("Data berhasil dimuat!");
        
        // Cek darurat barangkali layar pengguna sudah di level 14 saat pertama buka
        loadVisibleMangroves();
    })
    .catch(error => console.error("Gagal memuat GeoJSON:", error));
