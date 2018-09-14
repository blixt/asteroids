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

ReactDOM.render(<Viewport run={true} world={world} />, document.getElementById('root'));
