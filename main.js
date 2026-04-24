import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// --- SHADERS ---

const vertexShader = `
uniform float uTransition;
varying vec2 vUv;
varying vec3 vInterpolatedNormal;
varying vec3 vViewPosition;

const float PI = 3.14159265359;
const float R = 10.0;

void main() {
    vUv = uv;
    
    float u = uv.x;
    float v = uv.y;
    
    // Equirectangular mapping coordinates
    float lon = (u - 0.5) * 2.0 * PI;
    float lat = (v - 0.5) * PI;
    
    // 1. SPHERE POSITION
    vec3 posSphere;
    posSphere.x = R * cos(lat) * sin(lon);
    posSphere.y = R * sin(lat);
    posSphere.z = R * cos(lat) * cos(lon);
    vec3 normSphere = normalize(posSphere);
    
    // Web Mercator limit
    float latClamp = clamp(lat, -1.4844, 1.4844);
    float mercatorY = R * log(tan(PI/4.0 + latClamp/2.0));
    
    // 2. CYLINDER POSITION
    vec3 posCyl;
    posCyl.x = R * sin(lon);
    posCyl.y = mercatorY;
    posCyl.z = R * cos(lon);
    vec3 normCyl = normalize(vec3(posCyl.x, 0.0, posCyl.z));
    
    // 3. PLANE POSITION
    vec3 posPlane;
    posPlane.x = R * lon;
    posPlane.y = mercatorY;
    posPlane.z = 0.0;
    vec3 normPlane = vec3(0.0, 0.0, 1.0);
    
    // INTERPOLATION LOGIC
    vec3 finalPos;
    vec3 finalNorm;
    
    if (uTransition < 0.5) {
        float t = uTransition * 2.0;
        float easeT = t * t * (3.0 - 2.0 * t); 
        finalPos = mix(posSphere, posCyl, easeT);
        finalNorm = mix(normSphere, normCyl, easeT);
    } else {
        float t = (uTransition - 0.5) * 2.0;
        float easeT = t * t * (3.0 - 2.0 * t);
        finalPos = mix(posCyl, posPlane, easeT);
        finalNorm = mix(normCyl, normPlane, easeT);
    }
    
    finalNorm = normalize(finalNorm);
    
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    vInterpolatedNormal = normalize(normalMatrix * finalNorm);
    vViewPosition = -mvPosition.xyz;
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uShowGrid;
varying vec2 vUv;
varying vec3 vInterpolatedNormal;
varying vec3 vViewPosition;

void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    
    // LIGHTING: Since this is a vector map, keep it mostly flat but with slight 3D depth
    vec3 normal = normalize(vInterpolatedNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
    
    float diff = max(dot(normal, lightDir), 0.0);
    
    float rimDot = 1.0 - max(dot(viewDir, normal), 0.0);
    float rim = smoothstep(0.7, 1.0, rimDot);
    vec3 rimColor = vec3(1.0, 1.0, 1.0) * rim * 0.3;
    
    float ambient = 0.8; // High ambient for flat look
    float lighting = ambient + diff * 0.2;
    
    vec3 finalColor = texColor.rgb * lighting + rimColor;
    
    // GRID LINES OVERLAY
    if (uShowGrid > 0.5) {
        float latLines = 24.0;
        float lonLines = 36.0;
        
        float lonGrid = fract(vUv.x * lonLines);
        float latGrid = fract(vUv.y * latLines);
        
        float edgeLon = min(lonGrid, 1.0 - lonGrid);
        float edgeLat = min(latGrid, 1.0 - latGrid);
        
        float thickness = 0.02;
        float line = smoothstep(thickness, thickness - 0.01, edgeLon) + 
                     smoothstep(thickness, thickness - 0.01, edgeLat);
                     
        line = clamp(line, 0.0, 1.0);
        
        vec3 gridColor = vec3(0.0, 0.0, 0.0); // Dark grid for vector map
        finalColor = mix(finalColor, gridColor, line * 0.3); // 30% opacity
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- TEXTURE GENERATION ---

async function createVectorTexture() {
  const width = 4096;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  // Google Maps Vector Style Colors
  const waterColor = '#AADAFF';
  const landColor = '#CDE2B1'; 
  const bndColor = '#A0C28B';

  // Water background
  context.fillStyle = waterColor;
  context.fillRect(0, 0, width, height);

  try {
    const response = await fetch(import.meta.env.BASE_URL + 'world.json');
    if (!response.ok) throw new Error("Failed to load map data");
    const world = await response.json();
    const countries = topojson.feature(world, world.objects.countries);

    const projection = d3.geoEquirectangular()
      .translate([width / 2, height / 2])
      .scale(width / (2 * Math.PI));

    const path = d3.geoPath(projection, context);

    // Draw land
    context.fillStyle = landColor;
    context.beginPath();
    path(countries);
    context.fill();

    // Draw borders
    context.strokeStyle = bndColor;
    context.lineWidth = 1.5;
    context.stroke();
  } catch(e) {
    console.error("Error drawing vector map", e);
    // fallback error drawing
    context.fillStyle = '#ffcccc';
    context.fillRect(0, 0, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// --- MAIN SETUP ---

const init = async () => {
  const canvas = document.getElementById('glcanvas');
  
  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914);
  
  // Camera
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 40);
  
  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 15;
  controls.maxDistance = 100;
  
  // Create Vector Texture
  const vectorTex = await createVectorTexture();
  
  // Shader Material
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: vectorTex },
      uTransition: { value: 0.0 },
      uShowGrid: { value: 0.0 }
    },
    side: THREE.DoubleSide
  });
  
  const geometry = new THREE.PlaneGeometry(1, 1, 512, 256);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  // Window Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // UI INTERACTION
  const slider = document.getElementById('projection-slider');
  const label = document.getElementById('slider-val-label');
  const gridToggle = document.getElementById('grid-toggle');
  
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) / 100.0;
    material.uniforms.uTransition.value = val;
    
    if (val < 0.3) label.innerText = 'Sphere';
    else if (val < 0.7) label.innerText = 'Cylinder';
    else label.innerText = 'Plane';
  });
  
  gridToggle.addEventListener('change', (e) => {
    material.uniforms.uShowGrid.value = e.target.checked ? 1.0 : 0.0;
  });
  
  // Animation Loop
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  
  tick();
};

init();
