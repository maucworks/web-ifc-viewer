# IFC Viewer

Browser-based IFC viewer built for MAUC Works. Diagnostic tool to inspect geometry and spatial structure produced by IfcOpenShell authoring scripts.

**Live: [maucworks.github.io/web-ifc-viewer](https://maucworks.github.io/web-ifc-viewer/)**

![IFC Viewer](res/Screenshot%202026-05-02%20at%2016.20.20.png)

## Stack

- [`web-ifc`](https://github.com/IFCjs/web-ifc) `0.0.77` — direct WASM pipeline, no abstraction layer
- [`three`](https://threejs.org) `0.184` — rendering
- [`vite`](https://vitejs.dev) `5.4` — dev server and build

## Features

- Direct `IfcAPI.StreamAllMeshes` geometry pipeline
- Spatial hierarchy tree — `IfcRelAggregates` + `IfcRelContainedInSpatialStructure`, lazy collapsible
- Click-to-select with orange highlight and element info panel
- Raycasting from 3D viewport to tree selection
- Property sets and quantities via on-demand `GetLine()`
- Frame all `A` / frame selection `F` — also in viewer toolbar
- Hideable side panel with animated slide

## Usage

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), click **Load IFC** and select an `.ifc` file.

## Notes

- `COORDINATE_TO_ORIGIN: false` — model stays on IFC world coordinates
- Model is reopened from memory for on-demand property queries after initial geometry load
- IFC type constants hardcoded as numbers — named exports from the web-ifc browser build are class constructors, not numeric type codes
