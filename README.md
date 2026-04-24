# 🌍 Web Mercator Projection Visualizer

A stunning, interactive 3D visualization that demonstrates exactly how a 3D Earth projection unfolds onto a 2D plane using the **Web Mercator** projection mapping (the standard projection used by Google Maps).

## 🚀 Live Demo

**[View the Live Visualizer here](https://nordinbelkacemi.github.io/world-projection/)**

## ✨ Features

- **Geometry Interpolation**: Experience how cartographers convert a 3D globe into a 2D plane. A custom WebGL shader smoothly interpolates mesh vertices through an exact mathematical formula: `Sphere` -> `Cylinder` -> Mercator `Plane`.
- **Dynamic Vector Topography**: Uses **D3.js** and **TopoJSON** to dynamically paint a minimal vector world map onto a WebGL Texture on the fly. This produces clean, Google Maps-style flat colors without the noise or baked-in lighting of satellite/raster imagery.
- **Precision Guidelines**: Toggle latitude and longitude guidelines drawn dynamically in a custom fragment shader to give infinite visual crispness at any zoom level.

## 🛠️ Built With

- [Vite](https://vitejs.dev/) - Blazing fast build tool
- [Three.js](https://threejs.org/) - WebGL rendering engine
- [D3 Geo](https://d3js.org/) & [TopoJSON](https://github.com/topojson/topojson) - Equirectangular Canvas drawing

---

## 💻 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/nordinbelkacemi/world-projection.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server locally:
   ```bash
   npm run dev
   ```

4. Production deployment (automatically targets `gh-pages` branch):
   ```bash
   npm run build
   ```
