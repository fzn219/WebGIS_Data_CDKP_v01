// 1. Inisialisasi Peta
var map = L.map('map', {
    preferCanvas: true,
    minZoom: 9,
    maxZoom: 17
}).setView([-7.7543, 113.2159], 10);

// 2. Tiga Opsi Basemap Baru
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

// Set basemap default (Esri Topography)
esriTopo.addTo(map);

var baseMaps = {
    "Esri Topography": esriTopo,
    "Esri Satellite": esriSatellite,
    "OpenStreetMap": osm
};
L.control.layers(baseMaps).addTo(map);

// 3. Layer Kosong untuk Mangrove Desa
var mangroveLayer = L.layerGroup().addTo(map);

// 4. Gradasi Warna
function getColor(luas) {
    return luas >= 500 ? '#00441b' : 
           luas >= 250 ? '#006d2c' :
           luas >= 100 ? '#238b45' :
           luas >= 50  ? '#41ab5d' :
           luas >= 25  ? '#74c476' :
           luas >= 10  ? '#a1d99b' :
           luas >  0   ? '#c7e9c0' : 
                         '#ffffff';  // Putih untuk nilai 0
}

// 5. Style Poligon (Transparansi diatur berdasarkan luasan)
function styleWilayah(feature) {
    var luas = feature.properties.Luas_Mangrove || 0;
    return {
        fillColor: getColor(luas),
        weight: 0,
        // Transparansi 60% (opacity 0.4) jika ada mangrove, Transparansi 100% (opacity 0) jika 0
        fillOpacity: luas > 0 ? 0.4 : 0 
    };
}

// 6. Interaksi Sorot & Klik Poligon
function onEachFeature(feature, layer) {
    var luas = feature.properties.Luas_Mangrove || 0;
    var desa = feature.properties.WADMKD || "-";
    var kec = feature.properties.WADMKC || "-";
    var kab = feature.properties.WADMKK || "-";

    // Format lokasi (Desa - Kecamatan - Kabupaten) dan 4 desimal
    var lokasi = desa + " - " + kec + " - " + kab;
    var luasFormat = luas.toFixed(4);

    // Tooltip interaktif
    if (luas > 0) {
        layer.bindTooltip("<b>Lokasi: " + lokasi + "</b><br>Luas Mangrove: " + luasFormat + " Ha");
    }

    layer.on('click', function(e) {
        mangroveLayer.clearLayers();
        if (luas > 0) {
            var pathMangrove = 'data/data_mangrove/' + desa + '.geojson';
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
                .catch(error => console.log("Data spesifik belum ada untuk: " + desa));
        }
    });
}

// 7. Menambahkan Keterangan Indeks Warna (Legend)
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

        // Tampilan khusus di legenda: jika 0, kotak warna transparan dengan garis batas
        var legendColor = getColor(from + 0.1);
        var legendOpacity = from === 0 ? '0' : '0.4';
        var legendBorder = from === 0 ? '1px dashed #999' : 'none';

        labels.push(
            '<i style="background:' + legendColor + '; opacity:' + legendOpacity + '; border:' + legendBorder + ';"></i> ' + textDisplay
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
    })
    .catch(error => console.error("Gagal memuat GeoJSON:", error));
