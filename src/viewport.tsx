import * as React from 'react';

import {GameWorld} from './game';

interface ViewportProps {
  run: boolean;
  world: GameWorld;
}

export default class Viewport extends React.Component<ViewportProps> {
  private ref = React.createRef<HTMLCanvasElement>();
  private running = false;

  constructor(props: ViewportProps) {
    super(props);
    this.frame = this.frame.bind(this);
  }

  componentDidMount() {
    if (!this.ref.current) return;
    const context = this.ref.current.getContext('2d');
    if (!context) return;
    // Handle retina screens.
    const dpr = window.devicePixelRatio || 1;
    context.scale(dpr, dpr);
    this.props.world.globals.context = context;
    if (this.props.run) {
      this.running = true;
      this.frame(0);
    }
  }

  componentDidUpdate() {
    if (this.props.run && !this.running) {
      this.running = true;
      this.frame(0);
    }
  }

  componentWillUnmount() {
    this.props.world.globals.context = undefined;
    this.running = false;
  }

  render() {
    const {width, height} = this.props.world.globals.size;
    // Handle retina screens.
    const dpr = window.devicePixelRatio || 1;
    return (
      <div className="viewport">
        <canvas
          ref={this.ref}
          width={width * dpr}
          height={height * dpr}
          style={{width, height}}
        />
      </div>
    );
  }

  private frame(ts: number) {
    this.props.world.globals.deltaTime = 1;
    this.props.world.step();
    if (this.running) {
      // TODO: Fix corner cases where this causes multiple rAF per frame.
      requestAnimationFrame(this.frame);
    }
  }
}
