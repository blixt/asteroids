// From https://github.com/jeffThompson/CollisionDetection
// Part of: http://www.jeffreythompson.org/collision-detection/

type PVector = [number, number];

// POLYGON/POLYGON
export function polyPoly(p1: PVector[], p2: PVector[]) {
  // go through each of the vertices, plus the next
  // vertex in the list
  let next = 0;
  for (let current = 0; current < p1.length; current++) {
    // get next vertex in list
    // if we've hit the end, wrap around to 0
    next = current + 1;
    if (next === p1.length) next = 0;

    // get the PVectors at our current position
    // this makes our if statement a little cleaner
    const [vcx, vcy] = p1[current]; // c for "current"
    const [vnx, vny] = p1[next]; // n for "next"

    // now we can use these two points (a line) to compare
    // to the other polygon's vertices using polyLine()
    if (polyLine(p2, vcx, vcy, vnx, vny)) return true;

    // optional: check if the 2nd polygon is INSIDE the first
    if (polyPoint(p1, p2[0][0], p2[0][1])) return true;
  }

  return false;
}

// POLYGON/LINE
function polyLine(vertices: PVector[], x1: number, y1: number, x2: number, y2: number) {
  // go through each of the vertices, plus the next
  // vertex in the list
  let next = 0;
  for (let current = 0; current < vertices.length; current++) {
    // get next vertex in list
    // if we've hit the end, wrap around to 0
    next = current + 1;
    if (next === vertices.length) next = 0;

    // get the PVectors at our current position
    // extract X/Y coordinates from each
    const [x3, y3] = vertices[current];
    const [x4, y4] = vertices[next];

    // do a Line/Line comparison
    // if true, return 'true' immediately and
    // stop testing (faster)
    if (lineLine(x1, y1, x2, y2, x3, y3, x4, y4)) return true;
  }

  // never got a hit
  return false;
}

// LINE/LINE
function lineLine(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  // calculate the direction of the lines
  const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
  const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));

  // if uA and uB are between 0-1, lines are colliding
  return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
}

// POLYGON/POINT
// used only to check if the second polygon is
// INSIDE the first
function polyPoint(vertices: PVector[], px: number, py: number) {
  let collision = false;

  // go through each of the vertices, plus the next
  // vertex in the list
  let next = 0;
  for (let current = 0; current < vertices.length; current++) {
    // get next vertex in list
    // if we've hit the end, wrap around to 0
    next = current + 1;
    if (next === vertices.length) next = 0;

    // get the PVectors at our current position
    // this makes our if statement a little cleaner
    const [vcx, vcy] = vertices[current]; // c for "current"
    const [vnx, vny] = vertices[next]; // n for "next"

    // compare position, flip 'collision' variable
    // back and forth
    if (((vcy > py && vny < py) || (vcy < py && vny > py)) && px < ((vnx - vcx) * (py - vcy)) / (vny - vcy) + vcx) {
      collision = !collision;
    }
  }

  return collision;
}
