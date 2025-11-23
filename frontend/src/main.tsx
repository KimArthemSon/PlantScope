import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useEffect } from "react";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


 function BarangayList() {
  useEffect(() => {
    const fetchBarangays = async () => {
      const query = `
        [out:json];
        area["name"="Ormoc"]["admin_level"="4"];
        ( 
          node["place"="suburb"](area);
          node["place"="village"](area);
        );
        out center;
      `;

      const url =
        "https://overpass-api.de/api/interpreter?data=" +
        encodeURIComponent(query);

      try {
        const res = await fetch(url);
        const json = await res.json();

        console.log("=== Barangays in Ormoc City ===");
        json.elements.forEach((b: any) => {
          console.log({
            name: b.tags.name,
            lat: b.lat,
            lon: b.lon,
          });
        });
      } catch (err) {
        console.error("Error fetching barangays:", err);
      }
    };

    fetchBarangays();
  }, []);

  return <div>Check console for barangay list.</div>;
}