(() => {
  const canvas = document.getElementById("glcanvas");
  const gl =
    canvas.getContext("webgl", { alpha: false, antialias: true }) ||
    canvas.getContext("experimental-webgl", { alpha: false, antialias: true });

  if (!gl) {
    console.error("WebGL no está disponible en este navegador.");
    return;
  }

  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Shader autónomo: ventana de Snell, cáusticas armónicas continuas y partículas orgánicas dispersas
  const fragmentShaderSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec2 hash22(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    // Capa de partículas dispersas con posición, tamaño, brillo y deriva aleatoria por celda
    float dustLayer(vec2 uv, float scale, float t, float density) {
      vec2 gv = uv * scale;
      vec2 id = floor(gv);
      vec2 f = fract(gv) - 0.5;

      float acc = 0.0;

      // Revisar vecindad 3x3 para que las partículas no se corten en los bordes de celda
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 offs = vec2(float(x), float(y));
          vec2 cellId = id + offs;

          float rnd = hash12(cellId);
          if (rnd > density) continue;

          vec2 randPos = hash22(cellId + 19.37) - 0.5;
          vec2 drift = vec2(
            sin(t * (0.35 + rnd * 0.4) + rnd * 6.2831),
            cos(t * (0.28 + rnd * 0.35) + rnd * 12.566)
          ) * 0.24;

          vec2 pos = offs + randPos * 0.65 + drift;
          float d = length(f - pos);

          float radius = mix(0.025, 0.075, hash12(cellId + 7.13));
          float twinkle = 0.55 + 0.45 * sin(t * (1.2 + rnd * 2.0) + rnd * 18.0);
          float spot = smoothstep(radius, radius * 0.1, d);

          acc += spot * twinkle * (0.4 + 0.6 * rnd);
        }
      }

      return acc;
    }

    // Patrón orgánico de cáusticas / superficie del agua con ondas continuas
    float causticsPattern(vec2 p, float t) {
      vec2 q = p;
      float acc = 0.0;
      float amp = 0.55;
      float freq = 2.1;

      for (int i = 0; i < 4; i++) {
        float w1 = sin(q.x * freq + t * (0.45 + float(i) * 0.12) + cos(q.y * freq * 0.85 - t * 0.35));
        float w2 = cos(q.y * freq * 1.1 - t * (0.40 + float(i) * 0.10) + sin(q.x * freq * 0.92 + t * 0.30));
        float ridge = 1.0 - abs(w1 * 0.65 + w2 * 0.35);
        acc += pow(clamp(ridge, 0.0, 1.0), 3.0) * amp;

        q = mat2(0.80, 0.60, -0.60, 0.80) * q + vec2(0.37, -0.29);
        freq *= 1.65;
        amp *= 0.52;
      }

      return clamp(acc, 0.0, 1.0);
    }

    void main() {
      float minDim = max(min(u_resolution.x, u_resolution.y), 1.0);
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;

      // Paralaje suave con el puntero o tacto
      vec2 parallax = u_mouse * 0.11;
      vec2 p = uv + parallax;
      float t = u_time;

      float r = length(p);

      // Refracción suave de las olas vistas desde abajo
      float c1 = causticsPattern(p * (1.15 + r * 0.55), t);
      float c2 = causticsPattern(p * 1.85 - parallax * 0.5, -t * 0.75 + 2.1);
      float caustics = clamp(c1 * 0.68 + c2 * 0.45, 0.0, 1.0);

      vec2 refracted = p + vec2(c1 - 0.5, c2 - 0.5) * 0.045 * smoothstep(0.05, 0.75, r);
      float rr = length(refracted);

      // Ventana de Snell y núcleo luminoso superior
      float snellWindow = smoothstep(0.88, 0.06, rr);
      float innerGlow = exp(-rr * rr * 4.2);
      float coreSun = exp(-rr * rr * 26.0);

      // Rayos suaves filtrándose desde la superficie sin bordes duros
      float rayWaveA = 0.5 + 0.5 * sin(refracted.x * 6.5 + refracted.y * 2.2 + t * 0.42);
      float rayWaveB = 0.5 + 0.5 * cos(refracted.x * 4.2 - refracted.y * 5.4 - t * 0.31);
      float rays = pow(clamp(rayWaveA * 0.55 + rayWaveB * 0.45, 0.0, 1.0), 2.5);
      rays *= smoothstep(0.04, 0.25, rr) * smoothstep(1.05, 0.15, rr) * (0.45 + 0.55 * caustics);

      // Dos capas de partículas orgánicas dispersas (sin cuadrícula regular)
      float dustNear = dustLayer(uv + parallax * 1.7 + vec2(0.0, -t * 0.03), 4.2, t, 0.22);
      float dustFar  = dustLayer(uv + parallax * 1.1 + vec2(0.31, -t * 0.018), 7.5, t * 0.85 + 4.0, 0.18);
      float dust = (dustNear * 0.85 + dustFar * 0.55) * smoothstep(1.05, 0.12, r);

      // Paleta índigo / pizarra / violeta apagado / luz blanca
      vec3 deepAbyss = vec3(0.043, 0.039, 0.075);
      vec3 midSlate  = vec3(0.106, 0.098, 0.169);
      vec3 violetRim = vec3(0.235, 0.220, 0.375);
      vec3 whiteGlow = vec3(0.950, 0.950, 0.990);

      vec3 col = deepAbyss;
      col = mix(col, midSlate, clamp(snellWindow * 0.92 + caustics * 0.32, 0.0, 1.0));
      col = mix(col, violetRim, clamp(innerGlow * 0.72 + caustics * snellWindow * 0.55, 0.0, 1.0));
      col += mix(violetRim, whiteGlow, 0.45) * caustics * snellWindow * 0.42;
      col += mix(violetRim, whiteGlow, 0.65) * rays * 0.50;
      col += whiteGlow * coreSun * 1.25;
      col += whiteGlow * dust * 0.38;

      // Viñeta profunda en los bordes
      float vignette = smoothstep(1.35, 0.22, length(uv));
      col *= mix(0.30, 1.0, vignette);

      // Mapeo tonal suave
      col = col / (1.0 + col * 0.30);
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
  if (!vs || !fs) return;

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

  function updatePointer(clientX, clientY) {
    targetMouseX = (clientX / Math.max(window.innerWidth, 1) - 0.5) * 2.0;
    targetMouseY = -(clientY / Math.max(window.innerHeight, 1) - 0.5) * 2.0;
  }

  window.addEventListener("pointermove", (e) => {
    updatePointer(e.clientX, e.clientY);
  });

  window.addEventListener("pointerleave", () => {
    targetMouseX = 0;
    targetMouseY = 0;
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

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

    currentMouseX += (targetMouseX - currentMouseX) * 0.06;
    currentMouseY += (targetMouseY - currentMouseY) * 0.06;

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uMouse, currentMouseX, currentMouseY);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
