import { Engine, WebGPUEngine } from '@babylonjs/core';
import { Game } from './game.js';
import { AudioDirector } from './audio.js';
import { InputController } from './input.js';
import { GameUI } from './ui.js';
import './styles.css';

const canvas = document.getElementById('renderCanvas');
const boot = document.getElementById('boot');
const uiRoot = document.getElementById('ui-root');
let game = null;
let engine = null;
let rendererName = 'INITIALIZING';

async function createEngine(targetCanvas) {
  if ('gpu' in navigator) {
    let candidate = null;
    try {
      const supported = await WebGPUEngine.IsSupportedAsync;
      if (supported) {
        candidate = new WebGPUEngine(targetCanvas, {
          antialias: true,
          adaptToDeviceRatio: true,
          powerPreference: 'high-performance'
        });
        await candidate.initAsync();
        return { engine: candidate, rendererName: 'WEBGPU' };
      }
    } catch (error) {
      console.warn('WebGPU initialization failed; switching to WebGL2.', error);
      candidate?.dispose();
    }
  }

  const fallback = new Engine(targetCanvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
    powerPreference: 'high-performance'
  }, true);
  if (fallback.webGLVersion < 2) {
    fallback.dispose();
    throw new Error('当前浏览器没有可用的 WebGPU 或 WebGL2 图形设备。请使用最新版 Chrome / Edge，并开启硬件加速。');
  }
  return { engine: fallback, rendererName: 'WEBGL2 FALLBACK' };
}

function showBootError(error) {
  boot.innerHTML = `
    <div class="boot-error">
      <div class="boot-mark">NULL<span>//</span>ASCENT</div>
      <h2>图形设备初始化失败</h2>
      <p>${String(error?.message || error)}</p>
      <small>请使用最新版 Chrome / Edge，确认浏览器硬件加速已开启。</small>
      <button id="reload-game">重新尝试</button>
    </div>`;
  document.getElementById('reload-game')?.addEventListener('click', () => location.reload());
}

async function bootGame() {
  try {
    const result = await createEngine(canvas);
    engine = result.engine;
    rendererName = result.rendererName;
    engine.setHardwareScalingLevel(1);
    const audio = new AudioDirector();
    const input = new InputController(canvas);
    const ui = new GameUI(uiRoot, {
      start: () => game?.start(),
      pause: () => game?.pause(),
      resume: () => game?.resume(),
      abandon: () => game?.abandon(),
      restart: () => game?.restart(),
      menu: () => game?.menu(),
      volume: value => game?.setVolume(value),
      music: value => game?.setMusic(value),
      sfx: value => game?.setSfx(value),
      quality: value => game?.applyQuality(value)
    });
    game = new Game(engine, canvas, ui, audio, input, rendererName);
    boot.classList.add('boot-hidden');
    window.setTimeout(() => boot.remove(), 650);
    engine.runRenderLoop(() => {
      if (!engine || engine.isDisposed) return;
      const delta = Math.min(0.04, engine.getDeltaTime() / 1000);
      game?.update(delta);
      game?.scene.render();
    });
    window.addEventListener('resize', () => engine?.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game?.started && !game.paused) game.pause();
    });
    window.addEventListener('beforeunload', () => game?.dispose(), { once: true });
  } catch (error) {
    console.error('NULL//ASCENT boot failed:', error);
    showBootError(error);
  }
}

bootGame();
