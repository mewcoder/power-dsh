// Fixed homepage measurements, cross-checked against Tim5613/dsh-homepage-glass
// a9bb39e7 and the current deepseek.com pattern. This is a specialized, independently
// written value-noise renderer; no upstream shader or skin DOM code is bundled.
const vertexSource = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const fragmentSource = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_cssSize;
uniform vec2 u_driftA;
uniform vec2 u_driftB;
uniform vec2 u_phase;

float lattice(vec2 point) {
  return fract(sin(point.x * 12.9898 + point.y * 78.233) * 43758.5453123);
}
float valueField(vec2 point) {
  vec2 origin = floor(point);
  vec2 local = fract(point);
  vec2 weight = local * local * (3.0 - 2.0 * local);
  vec4 corners = vec4(lattice(origin), lattice(origin + vec2(1.0, 0.0)),
                      lattice(origin + vec2(0.0, 1.0)), lattice(origin + vec2(1.0)));
  return dot(corners, vec4((1.0 - weight.x) * (1.0 - weight.y),
                          weight.x * (1.0 - weight.y),
                          (1.0 - weight.x) * weight.y, weight.x * weight.y));
}
void main() {
  // scale=.5 -> .0035 CSS pixels per field unit; rotation=-5 degrees.
  vec2 p = (gl_FragCoord.xy / u_resolution - 0.5) * u_cssSize * 0.0035;
  float angle = -0.0872664626;
  p = vec2(cos(angle) * p.x - sin(angle) * p.y,
           sin(angle) * p.x + cos(angle) * p.y) + vec2(0.5, 1.15);

  float direction = valueField(p + u_driftA) * 6.28318530718;
  float distance = valueField(p * 2.0 - u_driftB) * 0.8;
  p += distance * vec2(cos(direction), sin(direction));
  // swirl=12/50, eight passes, evaluated in sequence on both axes.
  for (int pass = 1; pass <= 8; pass++) {
    float order = float(pass);
    float phaseX = order * 1.5 * p.y;
    p.x += 0.24 / order * (u_phase.y * cos(phaseX) - u_phase.x * sin(phaseX));
    float phaseY = order * p.x;
    p.y += 0.24 / order * (u_phase.y * cos(phaseY) - u_phase.x * sin(phaseY));
  }

  // checks scale=10/100 and proportion=.5. Softness=1 blends BLUE -> WHITE -> WHITE.
  // Both broad transitions matter: one sharp blue-alpha contour does not match.
  float coverage = 0.5 + 0.5 * sin(p.x * 0.85) * cos(p.y * 0.85);
  float blueShare = (1.0 - smoothstep(0.0, 0.7, coverage))
                  * (1.0 - smoothstep(0.3, 1.0, coverage));
  // Express the opaque RGB pattern + its original mask/base as an equivalent
  // transparent layer over white, so the additive slot never paints white over text.
  float fromTop = 1.0 - gl_FragCoord.y / u_resolution.y;
  float mask = fromTop < 0.0898
    ? mix(252.0 / 255.0, 232.0 / 255.0, fromTop / 0.0898)
    : (232.0 / 255.0) * (1.0 - fromTop) / (1.0 - 0.0898);
  float patternAlpha = blueShare * mask;
  float baseAlpha = (1.0 - fromTop) * (1.0 - mask);
  float alpha = patternAlpha + baseAlpha;
  vec3 blue = vec3(138.0, 163.0, 214.0) / 255.0;
  vec3 base = vec3(156.0, 193.0, 231.0) / 255.0;
  vec3 ink = (blue * patternAlpha + base * baseAlpha) / max(alpha, 0.00001);
  gl_FragColor = vec4(ink, alpha);
}
`;

/** Bounded phases preserve the current homepage's .07-unit/second initial drift. */
export function samplePatternMotion(seconds: number) {
  const tau = Math.PI * 2;
  const drift = (period: number): readonly [number, number] => {
    const angle = ((seconds % period) + period) % period / period * tau;
    const radius = .07 * period / tau;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return [radius * (sine + cosine - 1), radius * (sine + 1 - cosine)];
  };
  const phase = ((seconds % 90) + 90) % 90 / 90 * tau;
  return { a: drift(420), b: drift(460), phase: [Math.sin(phase), Math.cos(phase)] as const };
}

export interface PatternRenderer { draw(seconds: number, cssWidth: number, cssHeight: number): void; dispose(): void; }

/** Own every GPU allocation; unsupported or rejected shaders leave the CSS artwork. */
export function createPatternRenderer(canvas: HTMLCanvasElement): PatternRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  if (!vertex) return null;
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!fragment) { gl.deleteShader(vertex); return null; }
  const program = gl.createProgram();
  if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); return null; }
  const disposeShaders = () => { gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); };
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { disposeShaders(); return null; }
  const buffer = gl.createBuffer();
  if (!buffer) { disposeShaders(); return null; }
  const position = gl.getAttribLocation(program, 'a_position');
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const size = gl.getUniformLocation(program, 'u_cssSize');
  const driftA = gl.getUniformLocation(program, 'u_driftA');
  const driftB = gl.getUniformLocation(program, 'u_driftB');
  const phase = gl.getUniformLocation(program, 'u_phase');
  const dispose = () => { gl.deleteBuffer(buffer); disposeShaders(); };
  if (position < 0 || [resolution, size, driftA, driftB, phase].some(location => location === null)) { dispose(); return null; }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  return {
    draw(seconds, cssWidth, cssHeight) {
      const motion = samplePatternMotion(seconds);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(size, Math.max(1, cssWidth), Math.max(1, cssHeight));
      gl.uniform2f(driftA, ...motion.a);
      gl.uniform2f(driftB, ...motion.b);
      gl.uniform2f(phase, ...motion.phase);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose,
  };
}
