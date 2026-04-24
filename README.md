# world-projection

An interactive 3D visualization of the Web Mercator projection (the coordinate projection used by Google Maps). 

[Live Demo](https://nordinbelkacemi.github.io/world-projection/)

## Overview

This project demonstrates how a 3D globe unwraps into a 2D map. 
- Uses **Three.js** and a custom WebGL shader to mathematically interpolate the geometry between a sphere, a cylinder, and a flat Mercator plane.
- Uses **D3.js** and **TopoJSON** to dynamically draw a vector map onto a canvas, which is then used as the WebGL texture. This mimics the flat, un-textured look of vector map layers.
- Supports dynamically rendering latitude and longitude grid lines in the fragment shader.

## Local setup

```bash
git clone https://github.com/nordinbelkacemi/world-projection.git
cd world-projection
npm install
npm run dev
```
