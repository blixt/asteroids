import {createAsteroid, createPlayer, world} from './game';

import './index.css';

const canvas = document.querySelector('canvas')!;
const context = canvas.getContext('2d')!;

(() => {
  const rect = canvas.getBoundingClientRect();
  // Set the world size based on the canvas size.
  world.globals.size = {width: rect.width, height: rect.height};
  // Handle retina screens.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  context.scale(dpr, dpr);
})();

// Make the canvas context accessible by the draw system.
world.globals.context = context;

// Create the player.
createPlayer(world.globals.size.width / 2, world.globals.size.height + 10, {vy: -10});

// Create some asteroids.
for (let i = 0; i < 10; i++) {
  createAsteroid();
}

function frame(ts: number) {
  world.globals.deltaTime = 1;
  world.step();
  requestAnimationFrame(frame);
}

frame(0);
