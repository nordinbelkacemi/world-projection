import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    
    // We clamp the latitude for the Mercator projection to avoid infinite y values.
    // Web Mercator cuts off at approx +/- 85.0511 degrees (~1.4844 radians).
    float latClamp = clamp(lat, -1.4844, 1.4844);
    float mercatorY = R * log(tan(PI/4.0 + latClamp/2.0));
    
    // 2. CYLINDER POSITION
    vec3 posCyl;
    posCyl.x = R * sin(lon);
    posCyl.y = mercatorY;
    posCyl.z = R * cos(lon);
    vec3 normCyl = normalize(vec3(posCyl.x, 0.0, posCyl.z));
    
    // 3. PLANE POSITION (Unrolled Cylinder)
    vec3 posPlane;
    posPlane.x = R * lon;
    posPlane.y = mercatorY;
    posPlane.z = 0.0;
    vec3 normPlane = vec3(0.0, 0.0, 1.0);
    
    // INTERPOLATION LOGIC
    vec3 finalPos;
    vec3 finalNorm;
    
    // uTransition goes from 0.0 (Sphere) to 0.5 (Cylinder) to 1.0 (Plane)
    if (uTransition < 0.5) {
        float t = uTransition * 2.0;
        // Apply easing for smoother visual transition
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
    
    // Compute variables for fragment shader lighting
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
    
    // FAKE LIGHTING SETUP
    // A nice rim light + directional light setup makes it pop visually.
    vec3 normal = normalize(vInterpolatedNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
    
    // Diffuse component
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Rim lighting component
    float rimDot = 1.0 - max(dot(viewDir, normal), 0.0);
    float rim = smoothstep(0.6, 1.0, rimDot);
    vec3 rimColor = vec3(0.0, 0.6, 1.0) * rim * 0.8;
    
    // Ambient so we can see the dark side slightly
    float ambient = 0.4;
    float lighting = ambient + diff * 0.6;
    
    vec3 finalColor = texColor.rgb * lighting + rimColor;
    
    // GRID LINES OVERLAY
    if (uShowGrid > 0.5) {
        float latLines = 24.0; // Lines from pole to pole
        float lonLines = 36.0; // Lines around equator
        
        float lonGrid = fract(vUv.x * lonLines);
        float latGrid = fract(vUv.y * latLines);
        
        // Use derivatives for crisp lines or simple smoothing
        float edgeLon = min(lonGrid, 1.0 - lonGrid);
        float edgeLat = min(latGrid, 1.0 - latGrid);
        
        float thickness = 0.03;
        float line = smoothstep(thickness, thickness - 0.01, edgeLon) + 
                     smoothstep(thickness, thickness - 0.01, edgeLat);
                     
        line = clamp(line, 0.0, 1.0);
        
        vec3 gridColor = vec3(0.0, 0.8, 1.0);
        finalColor = mix(finalColor, gridColor, line * 0.5);
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- MAIN SETUP ---

const init = () => {
  const canvas = document.getElementById('glcanvas');
  
  // Scene
  const scene = new THREE.Scene();
  // We can leave background transparent or add a nebula/stars, but simple dark is elegant
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
  
  // Texture Loading
  const textureLoader = new THREE.TextureLoader();
  const earthTex = textureLoader.load(import.meta.env.BASE_URL + 'earth.jpg');
  earthTex.colorSpace = THREE.SRGBColorSpace;
  
  // Shader Material
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: earthTex },
      uTransition: { value: 0.0 },
      uShowGrid: { value: 0.0 }
    },
    side: THREE.DoubleSide
  });
  
  // High density plane geometry for perfectly smooth bending (512x256 segments)
  const geometry = new THREE.PlaneGeometry(1, 1, 512, 256);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  // Window Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // --- UI INTERACTION ---
  const slider = document.getElementById('projection-slider');
  const label = document.getElementById('slider-val-label');
  const gridToggle = document.getElementById('grid-toggle');
  
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) / 100.0;
    material.uniforms.uTransition.value = val;
    
    // Update Label
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
