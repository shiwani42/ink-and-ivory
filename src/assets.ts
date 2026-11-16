import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  // WebXR generic hand mesh (MIT, @webxr-input-profiles/assets), re-skinned as the master's ghost hand.
  'hand-left': {
    url: publicAssetUrl('models/generic-hand-left.glb'),
    type: AssetType.GLTF,
    name: 'Ghost Hand (left)',
    priority: 'critical',
  },
  'hand-right': {
    url: publicAssetUrl('models/generic-hand-right.glb'),
    type: AssetType.GLTF,
    name: 'Ghost Hand (right)',
    priority: 'critical',
  },
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
  'menu-panel': uikitml('menu.uikitml', 'Lesson Menu'),
  'caption-panel': uikitml('caption.uikitml', 'Caption Card'),
});
