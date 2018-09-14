import World from './lib/world';

interface Globals {
  context?: CanvasRenderingContext2D;
  deltaTime: number;
}

export const world = new World<Globals>({deltaTime: 0});

/* C O M P O N E N T S */

// Tag components:
const player = world.addComponent('player');

// Data components:
const friction = world.addComponent('friction', (amount: number) => ({amount}));

interface PolygonOptions {
  fillStyle?: string;
  lineWidth?: number;
  strokeStyle?: string;
}

const polygon = world.addComponent(
  'polygon',
  (options: PolygonOptions, ...points: [number, number][]) => ({
    options,
    points,
  }),
);

const position = world.addComponent('position', (x: number, y: number) => ({x, y}));

const velocity = world.addComponent('velocity', (vx: number, vy: number) => ({vx, vy}));

/* S Y S T E M S */

world.addSystem(
  'friction',
  [friction, velocity],
  (world, entities, frictions, velocities) => {
    const dt = world.globals.deltaTime;
    for (let i = 0; i < entities.length; i++) {
      const {amount} = frictions[i];
      const velocity = velocities[i];
      velocity.vx *= 1 - amount * dt;
      velocity.vy *= 1 - amount * dt;
    }
  },
);

// Move system.
world.addSystem(
  'move',
  [position, velocity],
  (world, entities, positions, velocities) => {
    const dt = world.globals.deltaTime;
    for (let i = 0; i < entities.length; i++) {
      const position = positions[i];
      const {vx, vy} = velocities[i];
      position.x += vx * dt;
      position.y += vy * dt;
    }
  },
);

// Clear the screen every frame.
world.addSystem('clearScreen', [], (world, entities) => {
  const ctx = world.globals.context!;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
});

world.addSystem('testing', [player, position], (world, entities, positions) => {
  console.log(positions);
});

// Draw all polygons on screen.
world.addSystem(
  'drawPolys',
  [polygon, position],
  (world, entities, polygons, positions) => {
    const ctx = world.globals.context!;
    for (let i = 0; i < entities.length; i++) {
      const {options, points} = polygons[i];
      const {x, y} = positions[i];
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (let j = 1; j < points.length; j++) {
        ctx.lineTo(...points[j]);
      }
      ctx.closePath();
      if (options.fillStyle) {
        ctx.fillStyle = options.fillStyle;
        ctx.fill();
      }
      if (options.strokeStyle) {
        if (options.lineWidth) ctx.lineWidth = options.lineWidth;
        ctx.strokeStyle = options.strokeStyle;
        ctx.stroke();
      }
      ctx.restore();
    }
  },
);

/* E N T I T Y   C R E A T I O N */

export function createAsteroid() {
  return world.entity().create();
}

export function createPlayer(x: number, y: number, {vx = 0, vy = 0} = {}) {
  return world
    .entity()
    .tagged(player)
    .with(friction, 0.04)
    .with(polygon, {strokeStyle: '#0f0'}, [0, -9], [-9, 9], [9, 9])
    .with(position, x, y)
    .with(velocity, vx, vy)
    .create();
}
