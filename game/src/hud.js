// The HUD: a 2D canvas over the 3D view — minimap, health, cash, wanted
// stars and speed — plus the DOM overlays for dialogue, objectives, the start
// screen, the pause menu and the busted screen.
import { CITY, FONT, WANTED } from './config.js';

const MAP_SIZE = 190;
const MAP_MIN_X = -128;
const MAP_MAX_X = 128;
const MAP_MIN_Z = -128;
const MAP_MAX_Z = 216;

export function createHud() {
  const canvas = document.getElementById('hud');
  const ctx = canvas.getContext('2d');
  const dialogue = document.getElementById('dialogue');
  const dialogueName = document.getElementById('dialogue-name');
  const dialogueText = document.getElementById('dialogue-text');
  const objective = document.getElementById('objective');
  const toast = document.getElementById('toast');
  const crosshair = document.getElementById('crosshair');
  const screens = {
    title: document.getElementById('start-screen'),
    paused: document.getElementById('pause-menu'),
    over: document.getElementById('game-over'),
  };
  const hud = {
    canvas,
    ctx,
    dialogueUntil: 0,
    toastUntil: 0,
    flash: 0,
    time: 0,

    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
    },

    showDialogue(name, text, seconds) {
      dialogueName.textContent = name;
      dialogueText.textContent = text;
      dialogue.classList.add('show');
      this.dialogueUntil = this.time + seconds;
    },

    showToast(text, seconds = 3) {
      toast.textContent = text;
      toast.classList.add('show');
      this.toastUntil = this.time + seconds;
    },

    setObjective(text) {
      objective.textContent = text;
      objective.classList.toggle('show', text.length > 0);
    },

    showCrosshair(show) {
      crosshair.classList.toggle('show', show);
    },

    /** Show one overlay screen and hide the others. */
    showScreen(name) {
      for (const [key, el] of Object.entries(screens)) {
        el.classList.toggle('show', key === name);
      }
      if (name === 'play' || name === null) {
        for (const el of Object.values(screens)) el.classList.remove('show');
      }
    },

    setGameOver(title, line, stats) {
      document.getElementById('over-title').textContent = title;
      document.getElementById('over-line').textContent = line;
      document.getElementById('over-stats').textContent = stats;
    },

    setStartInfo(cash, best, hasSave) {
      document.getElementById('start-cash').textContent =
        best > 0 ? `Best cash: $${best.toLocaleString('en-US')}` : 'No jobs run yet — the city is waiting.';
      document.getElementById('continue-btn').style.display = hasSave ? '' : 'none';
      document.getElementById('start-cash-line').textContent = hasSave ? `Saved run: $${cash.toLocaleString('en-US')}` : '';
    },

    update(dt) {
      this.time += dt;
      this.flash += dt;
      if (this.time > this.dialogueUntil) dialogue.classList.remove('show');
      if (this.time > this.toastUntil) toast.classList.remove('show');
    },

    draw(game) {
      const { ctx } = this;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const player = game.player;
      const police = game.police;
      const toMapX = (x) => ((x - MAP_MIN_X) / (MAP_MAX_X - MAP_MIN_X)) * MAP_SIZE;
      const toMapY = (z) => ((z - MAP_MIN_Z) / (MAP_MAX_Z - MAP_MIN_Z)) * MAP_SIZE;
      const mapX = 12;
      const mapY = 12;

      // Minimap panel.
      ctx.save();
      ctx.fillStyle = 'rgba(8,14,22,0.82)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mapX - 6, mapY - 6, MAP_SIZE + 12, MAP_SIZE + 12, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(mapX, mapY, MAP_SIZE, MAP_SIZE);
      ctx.clip();
      // Sea and sand at the bottom of the map.
      ctx.fillStyle = '#1d4e6e';
      ctx.fillRect(mapX, mapY + toMapY(CITY.seaZ), MAP_SIZE, MAP_SIZE);
      ctx.fillStyle = '#c9b078';
      ctx.fillRect(mapX, mapY + toMapY(CITY.beachZ), MAP_SIZE, toMapY(CITY.seaZ) - toMapY(CITY.beachZ));
      // City ground.
      ctx.fillStyle = '#232a33';
      ctx.fillRect(mapX, mapY, MAP_SIZE, toMapY(CITY.beachZ));
      // Buildings.
      ctx.fillStyle = '#4a5566';
      for (const b of game.city.buildings) {
        ctx.fillRect(mapX + toMapX(b.minX), mapY + toMapY(b.minZ), toMapX(b.maxX) - toMapX(b.minX), toMapY(b.maxZ) - toMapY(b.minZ));
      }
      // Roads.
      ctx.strokeStyle = '#8a94a3';
      ctx.lineWidth = 3;
      for (const x of CITY.roadsX) {
        ctx.beginPath();
        ctx.moveTo(mapX + toMapX(x), mapY);
        ctx.lineTo(mapX + toMapX(x), mapY + toMapY(CITY.beachZ));
        ctx.stroke();
      }
      for (const z of CITY.roadsZ) {
        ctx.beginPath();
        ctx.moveTo(mapX, mapY + toMapY(z));
        ctx.lineTo(mapX + MAP_SIZE, mapY + toMapY(z));
        ctx.stroke();
      }
      // Pier.
      ctx.strokeStyle = '#c9a06a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(mapX + toMapX(CITY.pierX), mapY + toMapY(CITY.pierZ0));
      ctx.lineTo(mapX + toMapX(CITY.pierX), mapY + toMapY(CITY.pierZ1));
      ctx.stroke();
      // Mission marker: a pulsing pink diamond.
      if (game.missions.beam.visible) {
        const mx = mapX + toMapX(game.missions.beam.position.x);
        const my = mapY + toMapY(game.missions.beam.position.z);
        const r = 6 + Math.sin(this.flash * 5) * 2;
        ctx.fillStyle = '#ff4fa3';
        ctx.beginPath();
        ctx.moveTo(mx, my - r);
        ctx.lineTo(mx + r, my);
        ctx.lineTo(mx, my + r);
        ctx.lineTo(mx - r, my);
        ctx.closePath();
        ctx.fill();
      }
      // Pedestrians as white dots, traffic as amber, thugs as red.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const ped of game.peds) {
        if (!ped.down) ctx.fillRect(mapX + toMapX(ped.x) - 1, mapY + toMapY(ped.z) - 1, 2, 2);
      }
      ctx.fillStyle = '#e8c84a';
      for (const car of [...game.traffic, ...game.parked]) {
        ctx.fillRect(mapX + toMapX(car.x) - 2, mapY + toMapY(car.z) - 2, 4, 4);
      }
      ctx.fillStyle = '#ff3b30';
      for (const thug of game.combat.thugs) {
        if (!thug.dead) {
          ctx.beginPath();
          ctx.arc(mapX + toMapX(thug.x), mapY + toMapY(thug.z), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Police as flashing blue circles.
      const blink = Math.floor(this.flash * 3) % 2 === 0;
      ctx.fillStyle = blink ? '#3b82ff' : '#ff3b30';
      for (const car of police.cars) {
        ctx.beginPath();
        ctx.arc(mapX + toMapX(car.x), mapY + toMapY(car.z), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // The player: a white arrow pointing where they face.
      const px = mapX + toMapX(player.inCar && player.car ? player.car.x : player.x);
      const py = mapY + toMapY(player.inCar && player.car ? player.car.z : player.z);
      const heading = player.inCar && player.car ? player.car.heading : player.yaw;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * -1 + Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore();

      // Health bar under the minimap.
      const barX = mapX - 6;
      const barY = mapY + MAP_SIZE + 18;
      ctx.fillStyle = 'rgba(8,14,22,0.82)';
      ctx.fillRect(barX, barY, MAP_SIZE + 12, 16);
      ctx.fillStyle = player.health > 30 ? '#37c978' : '#e5484d';
      ctx.fillRect(barX + 2, barY + 2, (MAP_SIZE + 8) * Math.max(0, player.health / 100), 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`HEALTH ${Math.ceil(player.health)}`, barX + 6, barY + 12);

      // Cash and wanted stars, top right.
      ctx.textAlign = 'right';
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(`$${game.missions.cash.toLocaleString('en-US')}`, w - 16, 34);
      ctx.shadowBlur = 0;
      ctx.font = '26px sans-serif';
      for (let i = 0; i < WANTED.maxStars; i++) {
        ctx.fillStyle = i < police.stars ? '#ffd21f' : 'rgba(255,255,255,0.25)';
        ctx.fillText('★', w - 16 - i * 30, 68);
      }
      // Speed, bottom right, when driving.
      if (player.inCar && player.car) {
        const kmh = Math.round(Math.abs(player.car.speed) * 3.6);
        ctx.font = `bold 34px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${kmh}`, w - 16, h - 40);
        ctx.font = `bold 12px ${FONT}`;
        ctx.fillText('km/h', w - 16, h - 22);
        ctx.shadowBlur = 0;
      }
      // Mission title line under the objective, small.
      ctx.textAlign = 'left';
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('VISTA BAY', 14, h - 14);
    },
  };
  return hud;
}
