import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {createAsteroid, createPlayer, world} from './game';
import Viewport from './viewport';

import './index.css';

const size = {width: 270, height: 480};
world.globals.size = size;

// Create the player.
createPlayer(size.width / 2, size.height + 10, {vy: -10});

// Create some asteroids.
for (let i = 0; i < 10; i++) {
  createAsteroid();
}

// Handle input.
const handleKey = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      break;
    case 'ArrowLeft':
      world.globals.input.turnLeft = e.type === 'keydown';
      break;
    case 'ArrowRight':
      world.globals.input.turnRight = e.type === 'keydown';
      break;
    case 'ArrowUp':
      world.globals.input.accelerate = e.type === 'keydown';
      break;
    default:
      return;
  }
  e.preventDefault();
};

document.addEventListener('keydown', handleKey);
document.addEventListener('keyup', handleKey);

ReactDOM.render(<Viewport run={true} world={world} />, document.getElementById('root'));
