import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { CalligraphySystem } from './calligraphy-system.js';
import { XrPerfSystem } from './common/xr-perf.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(XrPerfSystem);
  world.registerSystem(CalligraphySystem);
});
