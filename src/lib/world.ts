import EntityBuilder from './entitybuilder';

type Merge<T extends any[], I> = ((_: I, ...t: T) => any) extends ((...m: infer M) => any)
  ? M
  : never;
type Tuple<T> = (T[] & {'0': any}) | [];

export type EntityId = number;

interface Entity {
  id: EntityId;
  mask: number;
}

type FactoryFn<P extends any[], D> = (...properties: P) => D;

interface Component<D = any> {
  bit: number;
  factory?: FactoryFn<any[], D>;
  storage?: Map<EntityId, D>;
}

type StepFn<G, D extends any[][]> = (
  world: World<G>,
  entities: Entity[],
  ...data: D
) => void;

export interface ComponentId<P = any[], D = any> extends Symbol {}

interface System<G> {
  components: ComponentId[];
  mask: number;
  step: StepFn<G, any[][]>;
}

export interface SystemId extends Symbol {}

interface Modifier extends Symbol {}

const MAYBE: Modifier = Symbol('maybe');
const NOT: Modifier = Symbol('not');

type ModComponentId<P, D> = [Modifier, ComponentId<P, D>];
type AnyComponentId<P = any[], D = any> = ComponentId<P, D> | ModComponentId<P, D>;

// Use Maybe to also include entities that don't have this component. The data
// array will contain `undefined` for entities that do not have the component.
export function Maybe<P, D>(component: ComponentId<P, D>): ModComponentId<P, D | null> {
  return [MAYBE, component];
}

// Use Not to exclude all entities with this component.
export function Not<P>(component: ComponentId<P, any>): ModComponentId<P, void> {
  return [NOT, component];
}

// Infer a tuple of data lists from a tuple of typed ComponentIds.
type InferData<T extends any[]> = {
  0: [];
  1: ((...t: T) => any) extends ((d: AnyComponentId<any, infer D>, ...u: infer U) => any)
    ? (D extends void ? InferData<U> : Merge<InferData<U>, D[]>)
    : never;
}[T extends [any, ...any[]] ? 1 : 0];

export default class World<G> {
  components = new Map<ComponentId, Component>();
  entities: Entity[] = [];
  globals: G;
  systems = new Map<SystemId, System<G>>();

  private entitiesIndex = new Map<EntityId, Entity[]>();

  constructor(globals: G) {
    this.globals = globals;
  }

  addComponent<P extends any[], D = void>(name: string, factory?: FactoryFn<P, D>) {
    const component: Component<D> = {bit: 1 << this.components.size};
    if (factory) {
      component.factory = factory;
      component.storage = new Map();
    }
    const symbol: ComponentId<P, D> = Symbol(`${name} component`);
    this.components.set(symbol, component);
    return symbol;
  }

  addSystem<T extends Tuple<AnyComponentId>>(
    name: string,
    components: T,
    step: StepFn<G, InferData<T>>,
  ) {
    let mask = 0;
    const componentSymbols: ComponentId[] = [];
    for (let symbol of components) {
      let modifier: Modifier | undefined;
      if (Array.isArray(symbol)) {
        [modifier, symbol] = symbol;
      }
      const component = this.components.get(symbol);
      if (!component) throw Error(`invalid component ${symbol}`);
      // Only require this component in the default case (no modifier is set).
      if (!modifier) mask |= component.bit;
      // TODO: Handle NOT here.
      componentSymbols.push(symbol);
    }
    const symbol: SystemId = Symbol(`${name} system`);
    this.systems.set(symbol, {components: componentSymbols, mask, step});
    return symbol;
  }

  createEntity(componentEntries: Iterable<[ComponentId, any[]]>): EntityId {
    let mask = 0;
    // TODO: Not directly bound to indices in entities.
    // TODO: Reuse empty slots.
    const id: EntityId = this.entities.length;
    for (const [componentId, properties] of componentEntries) {
      const component = this.components.get(componentId);
      if (!component) {
        throw Error(`invalid component ${componentId}`);
      }
      mask |= component.bit;
      // The component may not have a data structure if it's only used as a tag.
      if (component.factory && component.storage) {
        component.storage.set(id, component.factory(...properties));
      }
    }
    const entity = {id, mask};
    this.entities.push(entity);
    // Update existing indexes.
    for (const [indexMask, indexList] of this.entitiesIndex) {
      if ((mask & indexMask) !== indexMask) continue;
      indexList.push(entity);
      console.log(
        'Added entity %d to index for mask %d (new count: %d)',
        id,
        indexMask,
        indexList.length,
      );
    }
    // Just expose the id of the entity object.
    return id;
  }

  entity() {
    return new EntityBuilder<G>(this);
  }

  hasComponent(entity: Entity, componentId: ComponentId): boolean {
    const component = this.components.get(componentId);
    if (!component) return false;
    return (entity.mask & component.bit) > 0;
  }

  step() {
    // ~ One small step for a system, a giant leap for World. ~
    // Loop through every system...
    for (const system of this.systems.values()) {
      // Get only the entities that have the component this system acts upon.
      const entities = this.entitiesByMask(system.mask);
      // Collect a list of data for each component (except tag components).
      const dataLists: any[][] = [];
      for (const componentId of system.components) {
        const component = this.components.get(componentId);
        if (!component) throw Error('internal state error');
        const storage = component.storage;
        if (!storage) {
          // This is a tag component so it has no data. No need to waste cycles.
          continue;
        }
        // Get the component data for the entities (in the correct order).
        const data = entities.map(e => {
          const value = storage.get(e.id);
          // The value may be undefined in case this system has a Maybe requirement.
          return value !== undefined ? value : null;
        });
        // Add it to the pile.
        dataLists.push(data);
      }
      system.step(this, entities, ...dataLists);
    }
  }

  private entitiesByMask(mask: number) {
    if (!mask) return this.entities;
    if (this.entitiesIndex.has(mask)) {
      return this.entitiesIndex.get(mask)!;
    }
    const entities = this.entities.filter(e => (e.mask & mask) === mask);
    this.entitiesIndex.set(mask, entities);
    console.log('Built index for mask %d (count: %d)', mask, entities.length);
    return entities;
  }
}
