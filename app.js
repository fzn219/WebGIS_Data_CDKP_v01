// Inisialisasi Peta
var map = L.map('map', {
    preferCanvas: true,
    minZoom: 8,
    maxZoom: 15
}).setView([-7.6, 113.2], 8);

// Menambahkan Basemap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15,
    attribution: '© OpenStreetMap | Cabang Dinas Kelautan dan Perikanan'
}).addTo(map);

var mangroveLayer = L.layerGroup().addTo(map);

// Gradasi Warna berdasarkan Luas_Mangrove
function getColor(luas) {
    return luas > 100 ? '#005a32' : 
           luas > 50  ? '#238b45' : 
           luas > 10  ? '#74c476' : 
           luas > 0   ? '#bae4b3' : 
                        '#f7fcf5';  
}

function styleWilayah(feature) {
    return {
        fillColor: getColor(feature.properties.Luas_Mangrove),
        weight: 1,
        opacity: 1,
        color: '#666',
        fillOpacity: 0.7
    };
}

// Interaksi saat poligon desa disorot dan diklik
function onEachFeature(feature, layer) {
    var namaDesa = feature.properties.WADMKD; 
    var luas = feature.properties.Luas_Mangrove;

    layer.bindTooltip("<b>Desa: " + namaDesa + "</b><br>Luas Mangrove: " + luas + " Ha");

    layer.on('click', function(e) {
        mangroveLayer.clearLayers();

        if (luas > 0) {
            // Path pemanggilan disesuaikan dengan folder baru: data/data_mangrove/
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
                    
                    // Zoom otomatis ke poligon mangrove yang muncul
                    map.fitBounds(mangroveBaru.getBounds());
                })
                .catch(error => console.log("Data mangrove tidak ditemukan untuk desa: " + namaDesa));
        }
    });
}

// Memanggil file batas wilayah dari folder data/
// Pastikan nama file Anda sudah diubah menjadi 'batas_wilayah.geojson'
fetch('data/batas_wilayah.geojson') 
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleWilayah,
            onEachFeature: onEachFeature
        }).addTo(map);
    });
