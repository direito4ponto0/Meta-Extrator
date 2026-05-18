import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix marker icons (CRA can't resolve leaflet's bundled assets)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function LocationMap({ gps }) {
  useEffect(() => {
    // Trigger map resize on mount
    setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
  }, []);

  if (!gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number") {
    return (
      <div data-testid="location-empty" className="border border-[var(--ma-border)] bg-white p-8 text-center">
        <p className="text-sm text-[var(--ma-text-secondary)]">
          Nenhuma coordenada GPS foi encontrada nos metadados deste arquivo.
        </p>
      </div>
    );
  }

  const { latitude, longitude } = gps;
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  return (
    <section data-testid="location-panel" className="border border-[var(--ma-border)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Geolocalização</h3>
        <span className="font-mono text-[10px] text-[var(--ma-text-secondary)]">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </span>
      </header>
      <div className="h-[360px] w-full" data-testid="location-map">
        <MapContainer center={[latitude, longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[latitude, longitude]}>
            <Popup>
              Lat: {latitude.toFixed(6)}<br />
              Lng: {longitude.toFixed(6)}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-[var(--ma-border)] px-6 py-3 text-xs">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
           className="font-medium text-[var(--ma-accent)] hover:underline">
          Abrir no Google Maps ↗
        </a>
        <a href={osmUrl} target="_blank" rel="noopener noreferrer"
           className="font-medium text-[var(--ma-accent)] hover:underline">
          Abrir no OpenStreetMap ↗
        </a>
      </div>
    </section>
  );
}
