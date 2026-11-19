// The story: four chained jobs from the fixer Marla Voss. Each mission is a
// list of steps — reach a place, clear a fight, escape the heat — with a beam
// of light marking the goal, dialogue on the radio and a cash reward at the end.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { spawnThugs, thugsAlive } from './combat.js';
import { addWanted, clearWanted } from './police.js';

export function createMissions(scene) {
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff4fa3,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 42, 12, 1, true), beamMat);
  beam.position.y = 21;
  beam.visible = false;
  scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  ring.visible = false;
  scene.add(ring);
  return {
    index: 0,
    step: 0,
    active: false,
    storyDone: false,
    cash: 0,
    beam,
    ring,
    pulse: 0,
  };
}

function currentStep(game) {
  const m = game.missions;
  if (!m.active || m.index >= MISSIONS.length) return null;
  return MISSIONS[m.index].steps[m.step];
}

function placeMarker(game) {
  const step = currentStep(game);
  const m = game.missions;
  if (!step) {
    m.beam.visible = false;
    m.ring.visible = false;
    return;
  }
  m.beam.visible = true;
  m.ring.visible = true;
  m.beam.position.x = step.x;
  m.beam.position.z = step.z;
  m.ring.position.x = step.x;
  m.ring.position.z = step.z;
}

/** Begin mission i: show its briefing and mark the first step. */
export function startMission(game, i) {
  const m = game.missions;
  m.index = i;
  m.step = 0;
  m.active = true;
  const def = MISSIONS[i];
  if (game.hud) {
    game.hud.showDialogue('Marla Voss', def.briefing, 7);
    game.hud.setObjective(def.title + ' — ' + def.steps[0].label);
  }
  placeMarker(game);
}

/** Put a mission on a given step without its briefing (screenshot staging). */
export function setMissionStep(game, index, step, cash) {
  const m = game.missions;
  m.index = index;
  m.step = step;
  m.active = true;
  m.storyDone = false;
  m.cash = cash;
  const def = MISSIONS[index];
  if (game.hud) game.hud.setObjective(`${def.title} — ${def.steps[step].label}`);
  placeMarker(game);
}

/** The label the HUD shows for the current objective. */
export function objectiveLabel(game) {
  const m = game.missions;
  if (m.storyDone) return 'Story complete — Vista Bay is yours. Free roam.';
  if (!m.active) return '';
  const def = MISSIONS[m.index];
  const step = def.steps[m.step];
  return `${def.title} — ${step.label}`;
}

function completeStep(game) {
  const m = game.missions;
  const def = MISSIONS[m.index];
  m.step += 1;
  if (game.audio) game.audio.chime();
  if (m.step >= def.steps.length) {
    // Mission complete: pay out, say so, and start the next job.
    m.cash += def.reward;
    if (game.hud) {
      game.hud.showToast(`Job complete — $${def.reward}`);
      game.hud.showDialogue('Marla Voss', def.done, 7);
    }
    game.saveBest();
    if (m.index + 1 >= MISSIONS.length) {
      m.active = false;
      m.storyDone = true;
      placeMarker(game);
      if (game.hud) game.hud.setObjective('Story complete — Vista Bay is yours. Free roam.');
      return;
    }
    startMission(game, m.index + 1);
    return;
  }
  const step = def.steps[m.step];
  if (game.hud) game.hud.setObjective(`${def.title} — ${step.label}`);
  if (step.kind === 'fight') {
    spawnThugs(game, step.x, step.z, 3);
    if (game.hud) game.hud.showDialogue('Marla Voss', '"There they are. Drop them all."', 4);
  }
  if (step.kind === 'escape') {
    // The heist heats up the moment the escape begins.
    addWanted(game, 3);
    if (game.hud) game.hud.showDialogue('Marla Voss', '"The whole city\'s coming for you — run!"', 4);
  }
  placeMarker(game);
}

export function updateMissions(game, dt) {
  const m = game.missions;
  m.pulse += dt;
  if (m.beam.visible) {
    m.beam.material.opacity = 0.22 + Math.sin(m.pulse * 3) * 0.08;
    m.ring.scale.setScalar(1 + Math.sin(m.pulse * 3) * 0.12);
  }
  const step = currentStep(game);
  if (!step || game.screen !== 'play') return;
  const player = game.player;
  const px = player.inCar && player.car ? player.car.x : player.x;
  const pz = player.inCar && player.car ? player.car.z : player.z;
  const dist = Math.hypot(step.x - px, step.z - pz);
  if (step.kind === 'reach') {
    if (dist < step.radius && (!step.needCar || player.inCar)) completeStep(game);
  } else if (step.kind === 'fight') {
    if (thugsAlive(game) === 0) completeStep(game);
  } else if (step.kind === 'escape') {
    if (dist < step.radius) {
      clearWanted(game);
      completeStep(game);
    }
  }
}
