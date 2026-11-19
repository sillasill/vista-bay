// Vista Bay: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between four screens:
// title, play, paused and busted.
//
// ?seed=N fixes the city, traffic and pedestrians. ?shot=1-chase|2-street|
// 3-mission|4-start (with &seed=N) stages that scene instead of running the
// loop, paints it a few times and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { BEST_KEY, CAR, CITY, CONTROLS_TEXT, MISSIONS, SAVE_KEY, STEP, STORY_INTRO } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_JUMP, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createCar, driveCar, randomCarColor, syncCar } from './vehicles.js';
import { createPlayer, enterCar, exitCar, hurtPlayer, syncPlayer, updatePlayerOnFoot } from './player.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, knockDownPed, updatePedestrians } from './pedestrians.js';
import { addWanted, createPolice, updatePolice } from './police.js';
import { createCombat, punch, shoot, updateThugs, updateTracers } from './combat.js';
import { createMissions, objectiveLabel, setMissionStep, startMission, updateMissions } from './missions.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('gl');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);

const rng = createRandom(seed);
const city = buildCity(scene, rng);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const player = createPlayer(scene, 0, 70);
const traffic = createTraffic(scene, rng, city);
const peds = createPedestrians(scene, rng);
const police = createPolice();
const combat = createCombat(scene);
const missions = createMissions(scene);

// Parked cars on the roadside. The first is the blue getaway sedan for Job 1.
const parked = [
  createCar(scene, 6.5, -20, 0, 0x2a6ec2, 'parked'),
  createCar(scene, 2.6, -60, Math.PI, 0xe8c84a, 'parked'),
  createCar(scene, -47.6, 10, Math.PI / 2, 0x4a9e5c, 'parked'),
  createCar(scene, 47.6, -30, -Math.PI / 2, 0xd8d8d8, 'parked'),
  createCar(scene, -92.6, 70, 0, 0xc23b3b, 'parked'),
];
for (const car of parked) syncCar(car);

const game = {
  rng,
  scene,
  camera,
  renderer,
  city,
  input,
  audio,
  hud,
  player,
  traffic,
  peds,
  police,
  combat,
  missions,
  parked,
  screen: 'title',
  time: 0,
  best: 0,
  shotCam: null,
  saveBest: null,
  onBusted: null,
};

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ cash: missions.cash, mission: missions.index, step: missions.step, best: game.best }),
    );
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

game.best = readBest();
game.saveBest = () => {
  if (missions.cash > game.best) game.best = missions.cash;
  try {
    window.localStorage.setItem(BEST_KEY, String(game.best));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
  writeSave();
};

function announce(message) {
  status.textContent = message;
}

/** Show the busted screen and save the run. */
game.onBusted = (title) => {
  if (game.screen !== 'play') return;
  game.screen = 'over';
  game.saveBest();
  audio.fail();
  audio.engine(0, false);
  input.unlock();
  const line =
    title === 'BUSTED'
      ? 'The Vista Bay police finally caught up with Rico Santana.'
      : 'Rico Santana got caught in the crossfire on the streets of Vista Bay.';
  hud.setGameOver(title, line, `Cash $${missions.cash.toLocaleString('en-US')} · Best $${game.best.toLocaleString('en-US')} · ${objectiveLabel(game)}`);
  hud.showScreen('over');
  announce(`${title}. ${line}`);
};

function resetWorld() {
  player.x = 0;
  player.z = 70;
  player.y = 0;
  player.vy = 0;
  player.health = 100;
  player.yaw = Math.PI;
  player.camYaw = Math.PI;
  player.camPitch = -0.12;
  if (player.inCar) {
    player.inCar = false;
    player.car = null;
    player.mesh.visible = true;
  }
  syncPlayer(player);
  police.stars = 0;
  police.heat = 0;
  for (const car of police.cars) scene.remove(car.mesh);
  police.cars = [];
  for (const thug of combat.thugs) scene.remove(thug.mesh);
  combat.thugs = [];
  for (const car of parked) {
    car.speed = 0;
    car.kind = 'parked';
    car.stolen = false;
    syncCar(car);
  }
  // Put the getaway sedan back where Job 1 expects it.
  parked[0].x = 6.5;
  parked[0].z = -20;
  parked[0].heading = 0;
  syncCar(parked[0]);
}

function startGame(fromSave) {
  resetWorld();
  const save = fromSave ? readSave() : null;
  missions.cash = 0;
  missions.storyDone = false;
  if (save && Number.isInteger(save.mission) && save.mission >= 0 && save.mission < 4) {
    // Resume the saved mission on its saved step, with its saved cash.
    setMissionStep(game, save.mission, save.step || 0, save.cash || 0);
    if (game.hud) game.hud.showDialogue('Marla Voss', MISSIONS[save.mission].briefing, 7);
  } else {
    startMission(game, 0);
  }
  game.screen = 'play';
  hud.showScreen('play');
  audio.unlock();
  announce(`Playing. ${objectiveLabel(game)}`);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hud.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

/** Third-person camera: behind the player on foot, behind the car while driving. */
function updateCamera(dt) {
  if (game.shotCam) {
    camera.position.copy(game.shotCam.pos);
    camera.lookAt(game.shotCam.look);
    return;
  }
  if (game.screen === 'title') {
    const a = game.time * 0.03;
    camera.position.set(Math.sin(a) * 120, 46, Math.cos(a) * 120 + 20);
    camera.lookAt(0, 2, 20);
    return;
  }
  const target = new THREE.Vector3();
  if (player.inCar && player.car) {
    const car = player.car;
    // The camera chases the car's heading; the mouse can look around briefly.
    const targetYaw = car.heading + game.camOffset;
    game.camYaw = game.camYaw + (targetYaw - game.camYaw) * Math.min(1, dt * 4);
    game.camOffset *= Math.max(0, 1 - dt * 0.7);
    const fx = Math.sin(game.camYaw);
    const fz = Math.cos(game.camYaw);
    camera.position.set(car.x - fx * 11, 3.8, car.z - fz * 11);
    target.set(car.x + fx * 8, 1.4, car.z + fz * 8);
  } else {
    const fx = Math.sin(player.camYaw);
    const fz = Math.cos(player.camYaw);
    const height = Math.max(1.4, 2.7 - player.camPitch * 5);
    camera.position.set(player.x - fx * 6.4, player.y + height, player.z - fz * 6.4);
    target.set(player.x + fx * 3, player.y + 1.5, player.z + fz * 3);
  }
  camera.lookAt(target);
}

/** One fixed step of the world. */
function step(dt) {
  game.time += dt;
  if (game.screen === 'title') {
    updateTraffic(game, dt);
    updatePedestrians(game, dt);
    updateCamera(dt);
    return;
  }
  if (game.screen !== 'play') return;

  const actions = input.takeActions();
  const mouse = input.takeMouse();
  if (actions & ACTION_PAUSE) {
    game.screen = 'paused';
    hud.showScreen('paused');
    input.unlock();
    announce('Paused.');
    return;
  }
  player.camYaw -= mouse.dx * 0.0028;
  player.camPitch = Math.max(-0.7, Math.min(0.45, player.camPitch - mouse.dy * 0.0022));
  game.camOffset = (game.camOffset || 0) - mouse.dx * 0.0028;

  if (player.inCar && player.car) {
    const car = player.car;
    const move = input.move();
    const drive = {
      throttle: move.f,
      steer: -move.s,
      brake: false,
      handbrake: false,
    };
    if (input.shooting()) drive.handbrake = false;
    // Space is the handbrake while driving.
    if (actions & ACTION_JUMP) drive.handbrake = true;
    driveCar(car, drive, dt, city.collide);
    clampCar(car);
    // Bumping traffic or a cruiser slows both cars down.
    for (const other of [...traffic, ...police.cars]) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.x -= nx * push;
        car.z -= nz * push;
        other.x += nx * push;
        other.z += nz * push;
        car.speed *= 0.8;
        other.speed *= 0.8;
        syncCar(other);
      }
    }
    // Running a pedestrian over draws the police.
    for (const ped of peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4 && Math.abs(car.speed) > 3) {
        knockDownPed(ped);
        addWanted(game, 1);
        audio.crash();
        hud.showToast('You hit a pedestrian — the cops noticed.');
      }
    }
    if (actions & ACTION_ENTER) exitCar(player, city);
    audio.engine(Math.abs(car.speed) / CAR.maxSpeed, true);
  } else {
    const move = input.move();
    updatePlayerOnFoot(player, move, input.sprint(), (actions & ACTION_JUMP) !== 0, dt, city);
    if (actions & ACTION_ENTER) {
      const car = enterCar(player, [...parked, ...traffic, ...police.cars]);
      if (car) {
        audio.click();
        if (!car.stolen) {
          car.stolen = true;
          addWanted(game, 1);
          hud.showToast('You stole a car — the cops noticed.');
        }
      }
    }
    if (actions & ACTION_PUNCH) punch(game);
    if (input.shooting()) shoot(game);
    audio.engine(0, false);
  }

  updateTraffic(game, dt);
  updatePedestrians(game, dt);
  updatePolice(game, dt);
  updateThugs(game, dt);
  updateTracers(game, dt);
  updateMissions(game, dt);
  audio.siren(police.stars > 0, dt);
  hud.update(dt);
  updateCamera(dt);

  if (player.health <= 0 && game.screen === 'play') game.onBusted(police.stars > 0 ? 'BUSTED' : 'WASTED');
}

/** Keep the player's car inside the drivable world. */
function clampCar(car) {
  car.x = Math.max(CITY.min, Math.min(CITY.max, car.x));
  if (car.z > CITY.seaZ) {
    const onPier = Math.abs(car.x - CITY.pierX) < CITY.pierHalf - 0.6;
    car.z = onPier ? Math.min(CITY.pierZ1 - 2, car.z) : CITY.seaZ;
  }
  if (car.z < CITY.min) car.z = CITY.min;
}

function render() {
  renderer.render(scene, camera);
  if (game.screen !== 'title') {
    hud.draw(game);
    hud.showCrosshair(game.screen === 'play' && !player.inCar);
  } else {
    hud.showCrosshair(false);
  }
}

/** Fill in the title screen and show it. */
function showTitle() {
  const save = readSave();
  hud.setStartInfo(save ? save.cash || 0 : 0, game.best, !!save);
  document.getElementById('story-text').textContent = STORY_INTRO;
  document.getElementById('controls-text').textContent = CONTROLS_TEXT;
  hud.showScreen('title');
}

function runGame() {
  showTitle();
  announce('Vista Bay. Press Enter or click Start to play.');
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === 'title' || game.screen === 'play') {
      while (accumulator >= STEP && (game.screen === 'title' || game.screen === 'play')) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // The paused and busted screens still paint behind their menus.
    if (game.screen !== 'title') updateCamera(0);
    render();
  }

  // Buttons on the overlays.
  document.getElementById('start-btn').addEventListener('click', () => {
    audio.unlock();
    startGame(false);
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    audio.unlock();
    startGame(true);
  });
  document.getElementById('resume-btn').addEventListener('click', () => {
    game.screen = 'play';
    hud.showScreen('play');
    audio.unlock();
  });
  document.getElementById('save-btn').addEventListener('click', () => {
    writeSave();
    hud.showToast('Progress saved.');
  });
  document.getElementById('load-btn').addEventListener('click', () => {
    startGame(true);
  });
  document.getElementById('restart-btn').addEventListener('click', () => {
    startGame(false);
  });
  document.getElementById('quit-btn').addEventListener('click', () => {
    game.screen = 'title';
    const save = readSave();
    hud.setStartInfo(save ? save.cash || 0 : 0, game.best, !!save);
    hud.showScreen('title');
  });
  document.getElementById('again-btn').addEventListener('click', () => {
    startGame(false);
  });
  document.getElementById('title-btn').addEventListener('click', () => {
    game.screen = 'title';
    const save = readSave();
    hud.setStartInfo(save ? save.cash || 0 : 0, game.best, !!save);
    hud.showScreen('title');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      hud.showScreen('paused');
      announce('Paused.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' && game.screen === 'title') startGame(false);
    else if (event.code === 'KeyR' && game.screen === 'over') startGame(false);
    else if ((event.code === 'KeyP' || event.code === 'Escape') && game.screen === 'paused') {
      game.screen = 'play';
      hud.showScreen('play');
    }
  });

  requestAnimationFrame(frame);
}

function runShot(name) {
  game.camYaw = Math.PI;
  game.camOffset = 0;
  stageShot(name, game);
  if (game.screen === 'title') showTitle();
  hud.update(1 / 60);
  let painted = 0;
  function paint() {
    hud.update(1 / 60);
    updateCamera(0);
    render();
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  // The camera needs one frame to settle before the first paint.
  updateCamera(0);
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
