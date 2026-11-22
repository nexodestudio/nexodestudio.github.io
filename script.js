(() => {
  const canvas = document.getElementById("glcanvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  if (!gl) {
    console.error("WebGL no está soportado en este navegador.");
    return;
  }

  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment Shader sin discontinuidad angular (sin costura en atan)
  const fragmentShaderSource = `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 5; i++) {
        v += amp * noise(p);
        p = rot * p * 2.04;
        amp *= 0.5;
      }
      return v;
    }

    float waterWaves(vec2 p, float t) {
      float w = 0.0;
      w += fbm(p * 2.2 + vec2(t * 0.22, -t * 0.16));
      w += 0.5 * fbm(p * 4.6 - vec2(t * 0.30, t * 0.24));
      return w;
    }

    vec2 rotate2D(vec2 v, float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c) * v;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

      // Paralaje sutil según la posición del cursor
      vec2 parallax = u_mouse * 0.14;
      vec2 p = uv + parallax;

      float t = u_time;
      float r = length(p);

      // Distorsión ondulatoria del agua en la superficie
      float eps = 0.015;
      vec2 waveCoord = p * (1.6 + r * 2.4);
      float h0 = waterWaves(waveCoord, t);
      float hx = waterWaves(waveCoord + vec2(eps, 0.0), t);
      float hy = waterWaves(waveCoord + vec2(0.0, eps), t);
      vec2 normal = vec2(hx - h0, hy - h0) / eps;

      vec2 refracted = p + normal * 0.045 * smoothstep(0.02, 0.55, r);
      float rr = length(refracted);

      // Núcleo luminoso blanco y ventana de Snell
      float sunCore = exp(-rr * rr * 34.0);
      float snellWindow = smoothstep(0.68, 0.04, rr);
      float innerHalo = exp(-rr * 3.8);

      // Cáusticas / ondas en la superficie
      float causticPattern = smoothstep(0.58, 0.95, h0);
      float surfaceRipples = causticPattern * smoothstep(0.78, 0.12, rr) * (0.45 + 0.55 * sin(rr * 26.0 - t * 2.2 + h0 * 6.0));

      // Rayos volumétricos continuos usando dirección unitaria (sin salto en atan)
      vec2 dir = p / max(r, 0.0001);
      vec2 dir1 = rotate2D(dir, t * 0.06);
      vec2 dir2 = rotate2D(dir, -t * 0.09);

      float rayNoise1 = noise(dir1 * 4.2 + vec2(r * 0.8 - t * 0.18));
      float rayNoise2 = noise(dir2 * 8.5 - vec2(r * 1.4 - t * 0.26));
      float rays = pow(max(0.0, rayNoise1 * 0.65 + rayNoise2 * 0.35), 2.4);
      rays *= smoothstep(0.04, 0.25, r) * smoothstep(0.95, 0.15, r);

      // Partículas suspendidas en el agua
      vec2 dustUV = uv * 9.0 + parallax * 1.8 + vec2(sin(t * 0.15) * 0.3, -t * 0.08);
      vec2 dustCell = floor(dustUV);
      vec2 dustFract = fract(dustUV) - 0.5;
      float rnd = hash(dustCell);
      vec2 offset = vec2(hash(dustCell + 11.3), hash(dustCell + 27.9)) - 0.5;
      float d = length(dustFract - offset * 0.6);
      float dust = smoothstep(0.06, 0.0, d) * step(0.86, rnd) * smoothstep(0.9, 0.1, r);

      // Paleta extraída del monito
      vec3 deepAbyss = vec3(0.043, 0.039, 0.075);
      vec3 midOcean  = vec3(0.106, 0.098, 0.169);
      vec3 shallow   = vec3(0.235, 0.220, 0.375);
      vec3 sunLight  = vec3(0.945, 0.945, 0.985);

      vec3 col = deepAbyss;
      col = mix(col, midOcean, snellWindow * 0.9);
      col = mix(col, shallow, innerHalo * 0.85);
      col += mix(shallow, sunLight, 0.45) * surfaceRipples * 0.58;
      col += mix(shallow, sunLight, 0.72) * rays * 0.58;
      col += sunLight * sunCore * 1.35;
      col += sunLight * dust * 0.35;

      // Viñeta abisal en los bordes
      float vignette = smoothstep(1.25, 0.20, length(uv));
      col *= mix(0.32, 1.0, vignette);

      // Mapeo tonal suave
      col = col / (1.0 + col * 0.32);
      col = pow(col, vec3(0.94));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Error compilando shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Error enlazando programa WebGL:", gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const posAttrib = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posAttrib);
  gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uMouse = gl.getUniformLocation(program, "u_mouse");

  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;

  window.addEventListener("pointermove", (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2.0;
    targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 2.0;
  });

  window.addEventListener("pointerleave", () => {
    targetMouseX = 0;
    targetMouseY = 0;
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  window.addEventListener("resize", resize);
  resize();

  const startTime = performance.now();

  function render(now) {
    const elapsed = (now - startTime) * 0.001;

    currentMouseX += (targetMouseX - currentMouseX) * 0.05;
    currentMouseY += (targetMouseY - currentMouseY) * 0.05;

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uMouse, currentMouseX, currentMouseY);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
