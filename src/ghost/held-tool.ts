import {
  AssetManager,
  Box3,
  Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Vector3,
} from '@iwsdk/core';

/** The writing tool: a brush for Japanese and Chinese, a broad-edge dip pen for English. */
export type ToolKind = 'brush' | 'pen';

/**
 * A brush or dip pen held in a hand, for the master's ghost hand and for the
 * learner's own. Its tip sits where the ink lands (the fingertip still does the
 * touching, so the real desk keeps giving the touch), and its shaft runs back
 * through the web between thumb and index finger, the way a pen is held. A
 * brush is held more upright, as in East Asian calligraphy.
 *
 * The models come from the desk set (tools/blender/build_assets.py): lying
 * along +X with the tip at +X. Each is re-pivoted so the tip is the origin and
 * the shaft runs along +Y.
 */
export class HeldTool {
  readonly root = new Group();
  kind: ToolKind = 'brush';
  private readonly tools: Record<ToolKind, Object3D>;
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly up = new Vector3(0, 1, 0);
  private readonly dir = new Vector3();
  private opacityNow = -1;

  constructor(private readonly ghostly: boolean) {
    this.tools = { brush: this.make('model-brush'), pen: this.make('model-dip-pen') };
    this.root.add(this.tools.brush, this.tools.pen);
    this.root.visible = false;
    this.setKind('brush');
  }

  private make(id: string): Object3D {
    const gltf = AssetManager.getGLTF(id);
    const pivot = new Group();
    if (!gltf) return pivot;
    const model = gltf.scene.clone(true);
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as MeshStandardMaterial).clone();
      if (this.ghostly) {
        mat.transparent = true;
        mat.depthWrite = false;
      }
      m.material = mat;
      m.renderOrder = this.ghostly ? 4 : 3;
      this.materials.push(mat);
    });
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const tipX = box.max.x;
    const axisY = (box.min.y + box.max.y) / 2;
    // Rotate -90 degrees about Z: (x, y) -> (y, -x), so the tip (+X) points down
    // and the shaft runs up +Y; then move the tip to the origin.
    model.rotation.z = -Math.PI / 2;
    model.position.set(-axisY, tipX, 0);
    pivot.add(model);
    return pivot;
  }

  setKind(kind: ToolKind): void {
    this.kind = kind;
    this.tools.brush.visible = kind === 'brush';
    this.tools.pen.visible = kind === 'pen';
  }

  /**
   * Place the tool: tip at `tip` (world), shaft toward `web` (world: between
   * the thumb and index finger). `opacity` applies to a ghostly tool.
   */
  place(tip: Vector3, web: Vector3, opacity = 1): void {
    this.dir.subVectors(web, tip);
    if (this.dir.lengthSq() < 1e-8) this.dir.copy(this.up);
    this.dir.normalize();
    // A brush is held nearly upright; a pen lies back along the hand.
    if (this.kind === 'brush') this.dir.lerp(this.up, 0.6).normalize();
    else this.dir.lerp(this.up, 0.15).normalize();
    this.root.position.copy(tip);
    this.root.quaternion.setFromUnitVectors(this.up, this.dir);
    if (this.ghostly && Math.abs(opacity - this.opacityNow) > 0.01) {
      this.opacityNow = opacity;
      for (const m of this.materials) m.opacity = opacity;
    }
  }
}
