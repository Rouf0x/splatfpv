import { PostEffect, ShaderUtils, SEMANTIC_POSITION } from 'playcanvas';

// Slight fisheye/barrel distortion on the FPV view — a recognizable "action
// cam" lens signature that a raw pinhole projection doesn't have.
//
// (An earlier version of this also did a cheap feedback-style motion blur —
// blending each frame with a history buffer of the previous one. Dropped:
// repeatedly re-blending through an 8-bit render target compounds
// quantization error frame over frame, which showed up as visible color
// banding/blockiness — a real per-frame cost for very little "blur" payoff.
// A proper velocity-based blur would need a motion-vector buffer the gsplat
// renderer doesn't provide, so this stays fisheye-only.)
const FISHEYE_FRAG = /* glsl */`
  uniform sampler2D uColorBuffer;
  uniform float uStrength;
  uniform vec2 uTexelSize;
  varying vec2 vUv0;

  void main() {
    vec2 centered = vUv0 * 2.0 - 1.0;
    float r2 = dot(centered, centered);
    // Corners (r2 == 2.0) push out furthest — normalize by that same factor
    // so the most-distorted sample never lands past the source frame edge.
    // Without this, barrel distortion pulls in pixels from outside the
    // original frame, which don't exist, leaving black wedges at the
    // corners instead of a fisheye image that fills the screen.
    float zoom = 1.0 + uStrength * 2.0;
    vec2 distorted = centered * (1.0 + uStrength * r2) / zoom;
    vec2 uv = clamp(distorted * 0.5 + 0.5, 0.0, 1.0);

    // The distortion isn't uniform: it stretches (magnifies) the center but
    // compresses (minifies) the edges — the same output-pixel step covers
    // more source texels out there. Plain bilinear sampling has no mipmap
    // chain to fall back on for that minified region, so the gsplat
    // renderer's high-frequency detail aliases into blocky/shimmering
    // artifacts near the frame edges. Counter it with a small 4-tap box
    // blur whose radius grows with r2, so it only kicks in where
    // minification is actually happening and the center stays sharp.
    vec2 o = uTexelSize * (uStrength * r2 * 3.0);
    vec3 color = texture2D(uColorBuffer, clamp(uv + vec2(o.x, o.y), 0.0, 1.0)).rgb
               + texture2D(uColorBuffer, clamp(uv + vec2(-o.x, o.y), 0.0, 1.0)).rgb
               + texture2D(uColorBuffer, clamp(uv + vec2(o.x, -o.y), 0.0, 1.0)).rgb
               + texture2D(uColorBuffer, clamp(uv + vec2(-o.x, -o.y), 0.0, 1.0)).rgb;
    color *= 0.25;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class FisheyeEffect extends PostEffect {
  constructor(device) {
    super(device);
    this.needsDepthBuffer = false;

    // Kept subtle by design — this is meant to read as "camera", not warp
    // the scene.
    this.strength = 0.16;

    this.shader = ShaderUtils.createShader(device, {
      uniqueName: 'FisheyeShader',
      attributes: { aPosition: SEMANTIC_POSITION },
      vertexGLSL: PostEffect.quadVertexShader,
      fragmentGLSL: FISHEYE_FRAG,
    });
  }

  render(inputTarget, outputTarget, rect) {
    const scope = this.device.scope;
    const colorBuffer = inputTarget.colorBuffer;
    scope.resolve('uColorBuffer').setValue(colorBuffer);
    scope.resolve('uStrength').setValue(this.strength);
    scope.resolve('uTexelSize').setValue([1 / colorBuffer.width, 1 / colorBuffer.height]);
    this.drawQuad(outputTarget, this.shader, rect);
  }
}

// attach()/detach() are exposed separately rather than adding the effect
// once at creation time, so the caller can keep them in lockstep with the
// camera's own enabled state (see cameras.js's setActive) — PlayCanvas's
// PostEffectQueue destroys its offscreen render target on the camera's
// onDisable() but does not recreate it on the next onEnable(), so leaving
// an effect attached across a disable/enable cycle renders into a stale
// target on re-enable.
export function attachFisheye(app, cameraEntity) {
  const effect = new FisheyeEffect(app.graphicsDevice);
  let attached = false;

  function attach() {
    if (attached) return;
    cameraEntity.camera.postEffects.addEffect(effect);
    attached = true;
  }

  function detach() {
    if (!attached) return;
    cameraEntity.camera.postEffects.removeEffect(effect);
    attached = false;
  }

  return { effect, attach, detach };
}
