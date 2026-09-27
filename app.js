// 1. Inisialisasi Peta - Titik tengah Probolinggo & Batasan Zoom
var map = L.map('map', {
    preferCanvas: true,
    minZoom: 9,  // Limit zoom out diperketat
    maxZoom: 17  // Limit zoom in diperdalam
}).setView([-7.7543, 113.2159], 10); // Default zoom fokus di Probolinggo (sekitar 20% luasan)

// 2. Tiga Opsi Basemap Profesional
var positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CartoDB',
    maxZoom: 17
});

var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 17
});

var darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CartoDB',
    maxZoom: 17
});

// Set basemap default (Carto Positron paling bagus untuk peta Choropleth)
positron.addTo(map);

// Tambahkan Kontrol Panel untuk mengganti Basemap
var baseMaps = {
    "Peta Terang (Positron)": positron,
    "Satelit (Esri)": satellite,
    "Peta Gelap (Dark Matter)": darkMatter
};
L.control.layers(baseMaps).addTo(map);

// 3. Layer Kosong untuk Mangrove Desa (Fase 2 nantinya)
var mangroveLayer = L.layerGroup().addTo(map);

// 4. Gradasi Warna (Digandakan menjadi 8 kelas untuk detail presisi)
function getColor(luas) {
    return luas >= 500 ? '#00441b' : // Hijau sangat pekat
           luas >= 250 ? '#006d2c' :
           luas >= 100 ? '#238b45' :
           luas >= 50  ? '#41ab5d' :
           luas >= 25  ? '#74c476' :
           luas >= 10  ? '#a1d99b' :
           luas >  0   ? '#c7e9c0' : // Hijau sangat muda
                         '#f7fcf5';  // 0 Ha / Sangat pudar
}

// 5. Style Poligon (Tanpa outline, transparansi diperkecil)
function styleWilayah(feature) {
    return {
        fillColor: getColor(feature.properties.Luas_Mangrove),
        weight: 0,           // OUTLINE DIHILANGKAN
        fillOpacity: 0.95    // FILL LEBIH PEKAT (mendekati 1)
    };
}

// 6. Interaksi Sorot & Klik Poligon
function onEachFeature(feature, layer) {
    var namaDesa = feature.properties.WADMKD; 
    var luas = feature.properties.Luas_Mangrove;

    layer.bindTooltip("<b>Desa: " + namaDesa + "</b><br>Luas Mangrove: " + luas + " Ha");

    layer.on('click', function(e) {
        mangroveLayer.clearLayers();
        if (luas > 0) {
            var pathMangrove = 'data/data_mangrove/' + namaDesa + '.geojson';
            fetch(pathMangrove)
                .then(response => {
                    if(!response.ok) throw new Error("File tidak ditemukan");
                    return response.json();
                })
                .then(data => {
                    var mangroveBaru = L.geoJSON(data, {
                        style: { color: "#ff0000", weight: 2, fillColor: "#ff0000", fillOpacity: 0.8 }
                    });
                    mangroveLayer.addLayer(mangroveBaru);
                    map.fitBounds(mangroveBaru.getBounds());
                })
                .catch(error => console.log("Data spesifik belum ada untuk: " + namaDesa));
        }
    });
}

// 7. Menambahkan Keterangan Indeks Warna (Legend)
var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend');
    // Batas bawah setiap kelas (sama seperti fungsi getColor)
    var grades = [0, 0.1, 10, 25, 50, 100, 250, 500]; 
    var labels = ['<strong>Luas Mangrove (Ha)</strong><br>'];

    for (var i = 0; i < grades.length; i++) {
        var from = grades[i];
        var to = grades[i + 1];

        // Format penulisan teks di legenda
        var textDisplay = '';
        if (from === 0 && to === 0.1) {
            textDisplay = '0 (Tidak Ada)';
        } else if (from === 0.1) {
            textDisplay = '0.1 &ndash; 10';
        } else {
            textDisplay = from + (to ? '&ndash;' + to : '+');
        }

        labels.push(
            '<i style="background:' + getColor(from + 0.1) + '"></i> ' + textDisplay
        );
    }
    div.innerHTML = labels.join('<br>');
    return div;
};
legend.addTo(map);

// 8. Memanggil Data GeoJSON Batas Wilayah
console.log("Memuat data wilayah...");
fetch('data/Wilker_STBD_mangrove.geojson') 
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleWilayah,
            onEachFeature: onEachFeature
        }).addTo(map);
        console.log("Data berhasil dimuat!");
        // (Perintah fitBounds dihapus agar peta tetap terpusat di Probolinggo sesuai setingan setView)
    })
    .catch(error => console.error("Gagal memuat GeoJSON:", error));
