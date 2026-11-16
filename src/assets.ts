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
  // Writing set built in Blender (tools/blender/build_assets.py; textures CC0 Poly Haven).
  ...Object.fromEntries(
    ['brush', 'brush-rest', 'inkstone', 'water-dropper', 'seal-set', 'paperweight', 'tabletop', 'keyboard', 'grand-piano'].map((id) => [
      `model-${id}`,
      {
        url: publicAssetUrl(`models/${id.replace(/-/g, '_')}.glb`),
        type: AssetType.GLTF,
        name: id,
        priority: 'critical' as const,
      },
    ]),
  ),
  // Paper fibre and felt maps (ambientCG, CC0), downscaled to 512 px.
  'paper-normal': { url: publicAssetUrl('textures/paper_normal.jpg'), type: AssetType.Texture, priority: 'critical' },
  'paper-rough': { url: publicAssetUrl('textures/paper_rough.jpg'), type: AssetType.Texture, priority: 'critical' },
  'felt-color': { url: publicAssetUrl('textures/felt_color.jpg'), type: AssetType.Texture, priority: 'critical' },
  'felt-normal': { url: publicAssetUrl('textures/felt_normal.jpg'), type: AssetType.Texture, priority: 'critical' },
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
  'menu-panel': uikitml('menu.uikitml', 'Lesson Menu'),
  'caption-panel': uikitml('caption.uikitml', 'Caption Card'),
});
