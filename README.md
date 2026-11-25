# Bombay Industrial and Special Economic Zones

Interactive map dashboard for the Mumbai Metropolitan Region (Bombay): industrial parks and SEZ perimeters, 8,236 demarcated plots with allotment status, notified SEZs, and connectivity / utilities layers.

**Live dashboard:** https://spkumar944.github.io/bombay-industrial-sez-dashboard/

## Data sources
- **Plots and park perimeters:** India Industrial Land Bank (DPIIT), https://indiaindustriallandbank.gov.in
- **Notified SEZs:** SEZ India register (Department of Commerce), as on 31.07.2026. Map positions are locality centres, not boundaries.
- **Roads, rail, stations, power lines, substations, water, airports, industrial land use:** © OpenStreetMap contributors (ODbL), via Geofabrik.

## Limits
IILB lists only parks that states have uploaded, so this is not every industrial plot in Mumbai. Allotment status is as recorded by the authorities and may lag reality. MIDC lease records and MMRDA project layers are not included.

## Run locally
```bash
python3 -m http.server 8791
# open http://localhost:8791/
```
Built with MapLibre GL. A product of AGT Intelligence.
