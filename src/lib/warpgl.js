/**
 * A deliberately tiny WebGL image renderer — one quad, one shader — for the
 * cinematic hero treatment: slow breathing warp, pointer drift, scroll
 * parallax, vignette. ~3KB instead of shipping a 3D library for one plane.
 *
 * Contract with the caller:
 *   - the <img> stays in the DOM underneath (SEO, LCP, no-JS, reduced-motion);
 *     the canvas fades in over it only after the texture is ready
 *   - devicePixelRatio is capped at 1.75
 *   - rendering pauses entirely when the canvas leaves the viewport
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uPlane;     // canvas size in px
uniform vec2 uImage;     // texture size in px
uniform float uTime;
uniform vec2 uPointer;   // -0.5..0.5, eased on the JS side
uniform float uScroll;   // -1..1 progress of section through viewport
uniform float uAmp;      // master amplitude, 0 disables

// object-fit: cover in shader form
vec2 cover(vec2 uv) {
  float pr = uPlane.x / uPlane.y;
  float ir = uImage.x / uImage.y;
  vec2 s = pr > ir ? vec2(1.0, ir / pr) : vec2(pr / ir, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  vec2 uv = vUv;
  // parallax: image drifts against scroll, pointer adds a slow off-axis lean
  vec2 drift = vec2(uPointer.x * 0.018, uScroll * 0.06 + uPointer.y * 0.012) * uAmp;
  // breathing warp: two low-frequency sine fields, barely-there
  float w = sin(uv.y * 4.2 + uTime * 0.32) * 0.0035
          + sin(uv.x * 3.1 - uTime * 0.21) * 0.0028;
  uv += vec2(w, w * 0.6) * uAmp;
  // scale up slightly so drift never reveals edges
  uv = (uv - 0.5) * 0.94 + 0.5;
  vec3 c = texture2D(uTex, cover(uv + drift)).rgb;
  // gentle vignette keeps type legible at the edges
  float d = distance(vUv, vec2(0.5, 0.42));
  c *= 1.0 - smoothstep(0.55, 1.05, d) * 0.55;
  gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
  }
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} image  already-loading img element to mirror
 * @returns {{destroy(): void, setScroll(p: number): void} | null} null if WebGL is unavailable
 */
export function createWarp(canvas, image) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(program, n);
  const uPlane = U("uPlane"), uImage = U("uImage"), uTime = U("uTime");
  const uPointer = U("uPointer"), uScroll = U("uScroll"), uAmp = U("uAmp");

  const texture = gl.createTexture();
  let imageSize = [1, 1];
  let ready = false;

  const upload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    imageSize = [image.naturalWidth, image.naturalHeight];
    ready = true;
  };
  if (image.complete && image.naturalWidth > 0) upload();
  else image.addEventListener("load", upload, { once: true });

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const resize = () => {
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = e.clientX / window.innerWidth - 0.5;
    pointer.ty = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let scroll = 0;
  let visible = true;
  let raf = 0;
  const start = performance.now();

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(canvas);

  function frame(now) {
    raf = 0;
    if (!visible) return;
    resize();
    if (ready) {
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      gl.uniform2f(uPlane, canvas.width, canvas.height);
      gl.uniform2f(uImage, imageSize[0], imageSize[1]);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uScroll, scroll);
      gl.uniform1f(uAmp, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setScroll(p) {
      scroll = p;
    },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      gl.deleteTexture(texture);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
