import World, {ComponentId, EntityId} from './world';

export default class EntityBuilder<G> {
  private components? = new Map<ComponentId, any[]>();
  private world?: World<G>;

  constructor(world: World<G>) {
    this.world = world;
  }

  create(): EntityId {
    if (!this.components || !this.world) throw Error('invalid builder use');
    const id = this.world.createEntity(this.components.entries());
    this.components = undefined;
    this.world = undefined;
    return id;
  }

  tagged(...components: ComponentId[]) {
    for (const component of components) this.with(component);
    return this;
  }

  with<P extends any[]>(component: ComponentId<P, any>, ...properties: P) {
    if (!this.components || !this.world) throw Error('invalid builder use');
    this.components.set(component, properties);
    return this;
  }
}
