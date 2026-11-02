import {
  Scene, Color3, Color4, Vector3, ArcRotateCamera, HemisphericLight,
  DirectionalLight, PointLight, SpotLight, MeshBuilder, TransformNode,
  PBRMaterial, StandardMaterial, DynamicTexture, ShadowGenerator,
  GlowLayer, DefaultRenderingPipeline, Texture, CubeTexture, Scalar
} from '@babylonjs/core';

const c3 = (hex) => Color3.FromHexString(hex);
const vec = (x, y, z) => new Vector3(x, y, z);

function pbr(scene, name, color, metallic = 0.5, roughness = 0.4, emissive = null) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = c3(color);
  material.metallic = metallic;
  material.roughness = roughness;
  material.environmentIntensity = 0.8;
  if (emissive) {
    material.emissiveColor = c3(emissive);
    material.emissiveIntensity = 1.2;
  }
  return material;
}


function attachWornMetalPbr(material, scene, scale = 1.7) {
  const base = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/metal_plate_02/metal_plate_02';
  const load = (suffix) => {
    const texture = new Texture(`${base}_${suffix}_2k.jpg`, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE,
      () => {},
      (message, exception) => console.warn(`Poly Haven metal map unavailable (${suffix}); procedural material fallback remains active.`, message || exception)
    );
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.uScale = scale;
    texture.vScale = scale;
    texture.anisotropicFilteringLevel = 8;
    return texture;
  };
  material.albedoTexture = load('diff');
  material.bumpTexture = load('nor_gl');
  material.metallicTexture = load('arm');
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.roughness = 0.48;
  material.metallic = 0.82;
  return material;
}

function makeFloorTexture(scene) {
  const texture = new DynamicTexture('arena-surface-detail', { width: 1024, height: 1024 }, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#182126';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 18000; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const a = Math.random() * 0.16;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(164,190,187,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, Math.random() * 4 + 1, Math.random() * 2 + 1);
  }
  ctx.strokeStyle = 'rgba(124,164,163,.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 16; i += 1) {
    const p = i * 64;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(1024, p); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(83,191,177,.22)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i += 1) {
    const p = 110 + i * 270;
    ctx.strokeRect(p, p, 1024 - p * 2, 1024 - p * 2);
  }
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = 2.8;
  texture.vScale = 2.8;
  return texture;
}


function makeNormalTexture(scene) {
  const size = 256;
  const texture = new DynamicTexture('micro-machined-normal', { width: size, height: size }, scene, false);
  const ctx = texture.getContext();
  const image = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const hash = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      heights[i] = hash(x, y) * 0.22
        + Math.sin(x * 0.19 + Math.sin(y * 0.11) * 2.5) * 0.12
        + Math.cos(y * 0.23 + Math.sin(x * 0.07) * 1.8) * 0.1;
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const left = heights[y * size + Math.max(0, x - 1)];
      const right = heights[y * size + Math.min(size - 1, x + 1)];
      const up = heights[Math.max(0, y - 1) * size + x];
      const down = heights[Math.min(size - 1, y + 1) * size + x];
      let nx = (left - right) * 3.4;
      let ny = (up - down) * 3.4;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length;
      const o = i * 4;
      image.data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      image.data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      image.data[o + 2] = Math.round((nz / length * 0.5 + 0.5) * 255);
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = 5;
  texture.vScale = 5;
  texture.level = 0.58;
  return texture;
}

function addShadow(mesh, shadowGenerator, receive = true) {
  mesh.receiveShadows = receive;
  shadowGenerator.addShadowCaster(mesh, true);
  return mesh;
}

export function createWorld(engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.018, 0.027, 0.035, 1);
  scene.ambientColor = c3('#263b3d');
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = c3('#0b151b');
  scene.fogDensity = 0.006;
  scene.collisionsEnabled = false;

  const camera = new ArcRotateCamera('combat-camera', -Math.PI / 2, 1.02, 23, vec(0, 0, 0), scene);
  camera.lowerRadiusLimit = 18;
  camera.upperRadiusLimit = 25;
  camera.lowerBetaLimit = 0.88;
  camera.upperBetaLimit = 1.15;
  camera.wheelPrecision = 1000;
  camera.panningSensibility = 0;
  camera.inertia = 0.82;
  scene.activeCamera = camera;

  const ambient = new HemisphericLight('ambient-fill', vec(0, 1, 0), scene);
  ambient.intensity = 0.56;
  ambient.diffuse = c3('#9eb9b6');
  ambient.groundColor = c3('#11171b');

  const sun = new DirectionalLight('key-light', vec(-0.55, -1, 0.38), scene);
  sun.position = vec(10, 18, -8);
  sun.intensity = 2.25;
  sun.diffuse = c3('#d2e4df');

  const rim = new SpotLight('cyan-rim', vec(-9, 10, 7), vec(0.7, -0.8, -0.4), Math.PI / 2.5, 2, scene);
  rim.intensity = 110;
  rim.diffuse = c3('#4bb9b0');
  const warm = new PointLight('amber-practical', vec(7, 4, -7), scene);
  warm.intensity = 65;
  warm.range = 18;
  warm.diffuse = c3('#df8b4d');

  const shadowGenerator = new ShadowGenerator(2048, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 24;
  shadowGenerator.setDarkness(0.32);
  shadowGenerator.bias = 0.0005;
  shadowGenerator.normalBias = 0.025;

  const floorMat = pbr(scene, 'brushed-titanium-floor', '#8b9998', 0.82, 0.42);
  floorMat.albedoTexture = makeFloorTexture(scene);
  floorMat.bumpTexture = makeNormalTexture(scene);
  floorMat.useAmbientOcclusionFromMetallicTextureRed = false;
  const floor = MeshBuilder.CreateGround('arena-floor', { width: 42, height: 42, subdivisions: 2 }, scene);
  floor.material = floorMat;
  floor.receiveShadows = true;
  floor.isPickable = true;

  const darkMetal = pbr(scene, 'obsidian-alloy', '#202c31', 0.92, 0.26);
  const wornMetal = attachWornMetalPbr(pbr(scene, 'polyhaven-worn-industrial-steel', '#8b9998', 0.82, 0.42), scene, 1.8);
  const midMetal = pbr(scene, 'titanium-ceramic', '#657575', 0.72, 0.31);
  const ceramic = pbr(scene, 'bone-ceramic', '#b5b7a9', 0.24, 0.3);
  const blackCeramic = pbr(scene, 'black-ceramic', '#10191e', 0.48, 0.2);
  const cyan = pbr(scene, 'phase-emission', '#143a3b', 0.3, 0.18, '#4cebd3');
  const amber = pbr(scene, 'amber-emission', '#4b2816', 0.25, 0.22, '#ff9b48');
  const red = pbr(scene, 'breach-emission', '#471b20', 0.2, 0.25, '#ff493d');

  const platform = MeshBuilder.CreateCylinder('central-reactor-plinth', { diameter: 15.2, height: 0.42, tessellation: 96 }, scene);
  platform.position.y = 0.12;
  platform.material = wornMetal;
  addShadow(platform, shadowGenerator);

  const outerRing = MeshBuilder.CreateTorus('outer-inlay-ring', { diameter: 18.8, thickness: 0.16, tessellation: 128 }, scene);
  outerRing.position.y = 0.34;
  outerRing.material = midMetal;
  const innerRing = MeshBuilder.CreateTorus('inner-phase-circuit', { diameter: 12.4, thickness: 0.08, tessellation: 128 }, scene);
  innerRing.position.y = 0.36;
  innerRing.material = cyan;

  const track = MeshBuilder.CreateTorus('outer-energy-track', { diameter: 24.5, thickness: 0.12, tessellation: 128 }, scene);
  track.position.y = 0.16;
  track.material = cyan;

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const x = Math.cos(angle) * 12.25;
    const z = Math.sin(angle) * 12.25;
    const rail = MeshBuilder.CreateBox(`radial-track-${i}`, { width: 0.16, height: 0.12, depth: 4.1 }, scene);
    rail.position = vec(x * 0.79, 0.2, z * 0.79);
    rail.rotation.y = -angle;
    rail.material = i % 3 === 0 ? amber : cyan;
  }

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 17.2;
    const z = Math.sin(angle) * 17.2;
    const pillar = MeshBuilder.CreateCylinder(`perimeter-pylon-${i}`, { diameterTop: 0.7, diameterBottom: 1.2, height: 5.8, tessellation: 8 }, scene);
    pillar.position = vec(x, 2.9, z);
    pillar.rotation.y = angle;
    pillar.material = darkMetal;
    addShadow(pillar, shadowGenerator);
    const cap = MeshBuilder.CreateCylinder(`pylon-cap-${i}`, { diameter: 1.05, height: 0.22, tessellation: 8 }, scene);
    cap.position = vec(x, 5.75, z);
    cap.material = midMetal;
    const lightStrip = MeshBuilder.CreateBox(`pylon-light-${i}`, { width: 0.09, height: 3.2, depth: 0.08 }, scene);
    lightStrip.position = vec(x, 3, z);
    lightStrip.material = i % 2 === 0 ? cyan : amber;
    const practical = new PointLight(`pylon-light-source-${i}`, vec(x, 4.8, z), scene);
    practical.intensity = 18;
    practical.range = 7;
    practical.diffuse = i % 2 === 0 ? c3('#56d6c5') : c3('#dc8a49');
  }

  for (let i = 0; i < 4; i += 1) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const x = Math.cos(angle) * 8.8;
    const z = Math.sin(angle) * 8.8;
    const ruin = MeshBuilder.CreateBox(`broken-bulkhead-${i}`, { width: 2.8, height: 2.2, depth: 1.15 }, scene);
    ruin.position = vec(x, 1.1, z);
    ruin.rotation.y = angle + 0.25;
    ruin.rotation.z = (i % 2 ? 1 : -1) * 0.08;
    ruin.material = i % 2 ? wornMetal : midMetal;
    addShadow(ruin, shadowGenerator);
    const seam = MeshBuilder.CreateBox(`bulkhead-seam-${i}`, { width: 2.3, height: 0.045, depth: 0.04 }, scene);
    seam.position = vec(x, 1.5, z);
    seam.rotation.y = ruin.rotation.y;
    seam.material = cyan;
  }

  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const radius = 14.7 + Math.sin(i * 3.7) * 0.8;
    const shard = MeshBuilder.CreatePolyhedron(`fracture-shard-${i}`, { type: 1, size: randRange(0.35, 0.75) }, scene);
    shard.position = vec(Math.cos(angle) * radius, randRange(0.3, 1.4), Math.sin(angle) * radius);
    shard.rotation = vec(randRange(0, 1), angle, randRange(0, 1));
    shard.material = i % 3 === 0 ? amber : (i % 3 === 1 ? cyan : darkMetal);
    addShadow(shard, shadowGenerator, false);
  }

  let environmentPromise = Promise.resolve(false);
  try {
    const env = CubeTexture.CreateFromPrefilteredData('https://assets.babylonjs.com/environments/environmentSpecular.env', scene);
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.7;
    environmentPromise = new Promise(resolve => {
      env.onLoadObservable.addOnce(() => {
        try { scene.createDefaultSkybox(env, true, 120, 0.22, false); } catch (error) { console.warn('Optional skybox could not be created.', error); }
        resolve(true);
      });
      env.onError = () => resolve(false);
      setTimeout(() => resolve(false), 7000);
    });
  } catch (error) {
    console.warn('Environment probe unavailable; direct lighting remains active.', error);
  }

  const glow = new GlowLayer('controlled-emissive-glow', scene, { blurKernelSize: 48 });
  glow.intensity = 0.48;
  const pipeline = new DefaultRenderingPipeline('cinematic-pipeline', true, scene, [camera]);
  pipeline.samples = 4;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.82;
  pipeline.bloomWeight = 0.22;
  pipeline.bloomKernel = 64;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.contrast = 1.18;
  pipeline.imageProcessing.exposure = 1.12;

  const materials = { darkMetal, midMetal, wornMetal, ceramic, blackCeramic, cyan, amber, red };
  return { scene, camera, floor, shadowGenerator, glow, pipeline, materials, environmentPromise, lights: { ambient, sun, rim, warm } };
}

function randRange(a, b) { return a + Math.random() * (b - a); }

export function createPlayerVisual(scene, shadowGenerator, materials) {
  const root = new TransformNode('player-root', scene);
  const body = MeshBuilder.CreateCapsule('runner-body', { height: 1.65, radius: 0.36, tessellation: 16, subdivisions: 4 }, scene);
  body.parent = root; body.position.y = 1.08; body.material = materials.blackCeramic;
  const chest = MeshBuilder.CreateBox('runner-chest-plate', { width: 0.82, height: 0.66, depth: 0.44 }, scene);
  chest.parent = root; chest.position = vec(0, 1.27, -0.03); chest.material = materials.ceramic;
  const abdomen = MeshBuilder.CreateBox('runner-abdominal-armor', { width: 0.58, height: 0.34, depth: 0.4 }, scene);
  abdomen.parent = root; abdomen.position = vec(0, 0.83, -0.02); abdomen.material = materials.darkMetal;
  const helmet = MeshBuilder.CreateSphere('runner-helmet', { diameter: 0.62, segments: 24 }, scene);
  helmet.parent = root; helmet.position = vec(0, 1.98, 0); helmet.material = materials.darkMetal;
  const visor = MeshBuilder.CreateBox('runner-visor', { width: 0.48, height: 0.12, depth: 0.43 }, scene);
  visor.parent = root; visor.position = vec(0, 2.02, -0.12); visor.material = materials.cyan;
  const core = MeshBuilder.CreateSphere('runner-reactor', { diameter: 0.23, segments: 20 }, scene);
  core.parent = root; core.position = vec(0, 1.28, -0.255); core.material = materials.cyan;
  const shoulders = [];
  for (const side of [-1, 1]) {
    const shoulder = MeshBuilder.CreatePolyhedron(`runner-shoulder-${side}`, { type: 1, size: 0.42 }, scene);
    shoulder.parent = root; shoulder.position = vec(side * 0.52, 1.54, 0); shoulder.scaling = vec(1.1, 0.8, 1.15); shoulder.material = materials.midMetal;
    shoulders.push(shoulder);
    const arm = MeshBuilder.CreateCapsule(`runner-arm-${side}`, { height: 0.95, radius: 0.15, tessellation: 12 }, scene);
    arm.parent = root; arm.position = vec(side * 0.55, 1.02, 0.02); arm.rotation.z = side * -0.16; arm.material = materials.blackCeramic;
    const thigh = MeshBuilder.CreateCapsule(`runner-leg-${side}`, { height: 0.88, radius: 0.17, tessellation: 12 }, scene);
    thigh.parent = root; thigh.position = vec(side * 0.2, 0.38, 0); thigh.material = materials.darkMetal;
    const knee = MeshBuilder.CreateSphere(`runner-knee-${side}`, { diameter: 0.3, segments: 12 }, scene);
    knee.parent = root; knee.position = vec(side * 0.2, 0.24, -0.04); knee.material = materials.midMetal;
  }
  const backpack = MeshBuilder.CreateBox('runner-reactor-pack', { width: 0.62, height: 0.8, depth: 0.34 }, scene);
  backpack.parent = root; backpack.position = vec(0, 1.26, 0.33); backpack.material = materials.darkMetal;
  const rifleBody = MeshBuilder.CreateBox('runner-prism-repeater', { width: 0.22, height: 0.24, depth: 0.72 }, scene);
  rifleBody.parent = root; rifleBody.position = vec(0.67, 1.02, -0.42); rifleBody.rotation.x = -0.08; rifleBody.material = materials.midMetal;
  const rifleBarrel = MeshBuilder.CreateCylinder('runner-repeater-barrel', { height: 0.62, diameter: 0.105, tessellation: 12 }, scene);
  rifleBarrel.parent = root; rifleBarrel.position = vec(0.67, 1.03, -0.99); rifleBarrel.rotation.x = Math.PI / 2; rifleBarrel.material = materials.darkMetal;
  const muzzle = MeshBuilder.CreateCylinder('runner-muzzle-emitter', { height: 0.12, diameter: 0.16, tessellation: 16 }, scene);
  muzzle.parent = root; muzzle.position = vec(0.67, 1.03, -1.29); muzzle.rotation.x = Math.PI / 2; muzzle.material = materials.cyan;
  const blade = MeshBuilder.CreateBox('runner-phase-edge', { width: 0.09, height: 1.25, depth: 0.08 }, scene);
  blade.parent = root; blade.position = vec(0.7, 0.95, -0.1); blade.rotation.z = -0.28; blade.material = materials.cyan; blade.isVisible = false;
  root.metadata = { core, visor, shoulders, blade, rifleBody, rifleBarrel, muzzle };
  for (const mesh of [body, chest, abdomen, helmet, visor, core, backpack, rifleBody, rifleBarrel, muzzle, ...shoulders]) {
    mesh.isPickable = false;
    if (mesh !== core && mesh !== visor) addShadow(mesh, shadowGenerator, true);
  }
  return root;
}

export function createEnemyVisual(scene, shadowGenerator, materials, type = 'ravager') {
  const root = new TransformNode(`enemy-${type}-root`, scene);
  const boss = type === 'choir' || type === 'herald';
  const scale = type === 'bulwark' ? 1.25 : type === 'stalker' ? 0.84 : boss ? (type === 'choir' ? 2.2 : 1.65) : 1;
  const body = MeshBuilder.CreateCapsule(`enemy-${type}-carapace`, { height: boss ? 2.4 : 1.35, radius: boss ? 0.8 : 0.42, tessellation: 16, subdivisions: 3 }, scene);
  body.parent = root; body.position.y = boss ? 1.65 : 0.93; body.scaling.x = type === 'bulwark' ? 1.2 : 1;
  body.material = type === 'arbalist' ? materials.blackCeramic : materials.darkMetal;
  const core = MeshBuilder.CreateSphere(`enemy-${type}-core`, { diameter: boss ? 0.8 : 0.34, segments: 20 }, scene);
  core.parent = root; core.position = vec(0, boss ? 1.72 : 0.98, -0.32); core.material = materials.red;
  const head = MeshBuilder.CreatePolyhedron(`enemy-${type}-helm`, { type: 1, size: boss ? 0.72 : 0.38 }, scene);
  head.parent = root; head.position = vec(0, boss ? 2.65 : 1.62, 0); head.material = materials.midMetal;
  const appendages = [];
  const count = boss ? 6 : type === 'bulwark' ? 4 : 2;
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const level = Math.floor(i / 2);
    const limb = MeshBuilder.CreateBox(`enemy-${type}-blade-${i}`, {
      width: boss ? 0.2 : 0.14,
      height: boss ? 1.55 : type === 'bulwark' ? 0.85 : 0.68,
      depth: boss ? 0.22 : 0.17
    }, scene);
    limb.parent = root;
    limb.position = vec(side * (boss ? 1.05 + level * 0.12 : 0.46), (boss ? 1.4 : 0.92) - level * 0.12, -0.02);
    limb.rotation.z = side * (boss ? 0.52 + level * 0.13 : 0.35);
    limb.material = i % 2 === 0 ? materials.midMetal : materials.darkMetal;
    appendages.push(limb);
  }
  const halo = MeshBuilder.CreateTorus(`enemy-${type}-halo`, { diameter: boss ? 3.6 : 1.2, thickness: boss ? 0.12 : 0.055, tessellation: 64 }, scene);
  halo.parent = root; halo.position.y = boss ? 2.4 : 1.4; halo.rotation.x = Math.PI / 2.4; halo.material = materials.red;
  if (type === 'stalker') {
    const finA = MeshBuilder.CreateBox('stalker-fin-a', { width: 0.12, height: 1.2, depth: 0.22 }, scene);
    finA.parent = root; finA.position = vec(-0.42, 1.28, 0.1); finA.rotation.z = -0.65; finA.material = materials.amber;
    const finB = finA.clone('stalker-fin-b'); finB.position.x = 0.42; finB.rotation.z = 0.65;
  }
  root.scaling = vec(scale, scale, scale);
  root.metadata = { core, halo, appendages, boss };
  for (const mesh of [body, core, head, halo, ...appendages]) {
    mesh.isPickable = false;
    if (mesh !== core && mesh !== halo) addShadow(mesh, shadowGenerator, true);
  }
  return root;
}

export function createProjectileVisual(scene, materials, friendly = true, scale = 1) {
  const root = MeshBuilder.CreateSphere(friendly ? 'phase-round' : 'breach-round', { diameter: friendly ? 0.22 : 0.3, segments: 12 }, scene);
  root.material = friendly ? materials.cyan : materials.red;
  root.scaling = vec(scale, scale, scale);
  root.isPickable = false;
  const trail = MeshBuilder.CreateCylinder('round-trail', { height: 0.9, diameterTop: 0.015, diameterBottom: 0.12, tessellation: 8 }, scene);
  trail.parent = root; trail.position.z = 0.42; trail.rotation.x = Math.PI / 2;
  trail.material = friendly ? materials.cyan : materials.amber;
  return root;
}

export function createTelegraph(scene, materials, radius = 2.5, color = 'red') {
  const ring = MeshBuilder.CreateTorus('attack-telegraph', { diameter: radius * 2, thickness: 0.07, tessellation: 64 }, scene);
  ring.position.y = 0.08;
  ring.material = color === 'amber' ? materials.amber : materials.red;
  ring.isPickable = false;
  return ring;
}

export function createImpact(scene, materials, position, color = 'cyan', count = 8) {
  const material = color === 'red' ? materials.red : color === 'amber' ? materials.amber : materials.cyan;
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = MeshBuilder.CreateSphere('impact-fragment', { diameter: randRange(0.055, 0.13), segments: 6 }, scene);
    mesh.position = position.clone();
    mesh.material = material;
    mesh.isPickable = false;
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
    particles.push({ mesh, velocity: vec(Math.cos(angle) * randRange(1.2, 3.8), randRange(0.5, 2.8), Math.sin(angle) * randRange(1.2, 3.8)), life: randRange(0.24, 0.52), maxLife: 0.52 });
  }
  return particles;
}

export function createXpOrb(scene, materials, position, value = 1) {
  const root = new TransformNode('echo-shard-root', scene);
  const shard = MeshBuilder.CreatePolyhedron('echo-shard', { type: 1, size: 0.18 }, scene);
  shard.parent = root; shard.material = materials.cyan; shard.rotation.z = 0.3;
  const halo = MeshBuilder.CreateTorus('echo-shard-ring', { diameter: 0.48, thickness: 0.025, tessellation: 32 }, scene);
  halo.parent = root; halo.material = materials.amber; halo.rotation.x = Math.PI / 2;
  root.position = position.clone(); root.position.y = 0.38;
  root.metadata = { value };
  return root;
}
