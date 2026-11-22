(() => {
  const TEXTURE_URL = "./water.jpg";

  const canvas = document.getElementById("glcanvas");
  const fallbackEl = document.getElementById("fallback-msg");

  const gl =
    canvas.getContext("webgl", { alpha: false, antialias: true }) ||
    canvas.getContext("experimental-webgl", { alpha: false, antialias: true });

  function showStatus(text) {
    if (!fallbackEl) return;
    fallbackEl.textContent = text;
    fallbackEl.hidden = false;
  }

  if (!gl) {
    showStatus("WebGL no disponible en este navegador.");
    return;
  }

  const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec2 v_uv;

    uniform sampler2D u_tex;
    uniform float u_hasTex;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    void main() {
      float aspect = u_resolution.x / max(u_resolution.y, 1.0);
      vec2 centered = (v_uv - 0.5) * vec2(aspect, 1.0);

      // Paralaje sutil según puntero / movimiento
      vec2 parallax = u_mouse * 0.08;
      vec2 p = centered + parallax;

      float t = u_time;
      float r = length(p);

      // Coordenadas base escaladas para cubrir bien cualquier orientación (vertical u horizontal)
      vec2 baseUv = v_uv + parallax * 0.22;

      // Ondulación suave usando ondas armónicas continuas (sin cortes ni saltos)
      vec2 wave1 = vec2(
        sin(p.y * 5.2 + t * 0.75 + cos(p.x * 3.7 - t * 0.5)),
        cos(p.x * 4.8 - t * 0.68 + sin(p.y * 4.1 + t * 0.55))
      );

      vec2 wave2 = vec2(
        cos(p.x * 9.5 - p.y * 6.2 + t * 1.15),
        sin(p.y * 8.8 + p.x * 5.4 - t * 0.95)
      );

      vec2 warp = wave1 * 0.018 + wave2 * 0.008;

      // Muestreo de la imagen con dos capas desplazadas para dar profundidad y movimiento
      vec2 uvA = baseUv + warp + vec2(t * 0.015, -t * 0.012);
      vec2 uvB = baseUv * 1.18 - warp * 1.35 + vec2(-t * 0.011, t * 0.016) + vec2(0.37, 0.19);

      vec3 texA = texture2D(u_tex, fract(uvA)).rgb;
      vec3 texB = texture2D(u_tex, fract(uvB)).rgb;

      // Luminancia de la textura como mapa de relieve / cáusticas
      float lumA = dot(texA, vec3(0.299, 0.587, 0.114));
      float lumB = dot(texB, vec3(0.299, 0.587, 0.114));
      float relief = mix(lumA, lumB, 0.5);

      // Si no hay textura cargada todavía, usar ondas suaves como respaldo
      float fallbackRelief = 0.5 + 0.25 * sin(p.x * 6.0 + t * 0.8) * cos(p.y * 6.0 - t * 0.7);
      float pattern = mix(fallbackRelief, relief, u_hasTex);

      // Ventana de Snell / luz filtrándose desde arriba
      float snellGlow = exp(-r * r * 3.1);
      float coreLight = exp(-r * r * 22.0);
      float ringHighlight = smoothstep(0.55, 0.85, pattern) * exp(-r * 1.4);

      // Rayos direccionales suaves centrados en el haz de luz
      vec2 toCenter = p;
      float beamAngle = sin(toCenter.x * 7.0 + t * 0.45) * cos(toCenter.y * 5.5 - t * 0.35);
      float rays = smoothstep(0.15, 0.95, beamAngle) * exp(-r * 1.85) * (0.45 + 0.55 * pattern);

      // Paleta del personaje (índigo oscuro, pizarra violáceo, brillo apagado y luz blanca)
      vec3 deepAbyss = vec3(0.043, 0.039, 0.075);
      vec3 midSlate  = vec3(0.106, 0.098, 0.169);
      vec3 violetRim = vec3(0.235, 0.220, 0.375);
      vec3 whiteGlow = vec3(0.950, 0.950, 0.990);

      vec3 col = deepAbyss;
      col = mix(col, midSlate, clamp(snellGlow * 0.95 + pattern * 0.45, 0.0, 1.0));
      col = mix(col, violetRim, clamp(ringHighlight * 0.85 + snellGlow * 0.35, 0.0, 1.0));
      col += violetRim * rays * 0.65;
      col += mix(violetRim, whiteGlow, 0.55) * ringHighlight * 0.45;
      col += whiteGlow * coreLight * 1.25;

      // Viñeta en los bordes
      float distFromCenter = length((v_uv - 0.5) * vec2(1.15, 1.0));
      float vignette = smoothstep(1.05, 0.15, distFromCenter);
      col *= mix(0.25, 1.0, vignette);

      col = col / (1.0 + col * 0.28);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Error en shader:", gl.getShaderInfoLog(shader));
      showStatus("Error al compilar el shader.");
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
    console.error("Error enlazando programa:", gl.getProgramInfoLog(program));
    showStatus("Error al enlazar WebGL.");
    return;
  }

  gl.useProgram(program);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
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

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTex = gl.getUniformLocation(program, "u_tex");
  const uHasTex = gl.getUniformLocation(program, "u_hasTex");
  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uMouse = gl.getUniformLocation(program, "u_mouse");

  // Textura inicial de 1x1 píxel para evitar advertencias antes de que cargue la imagen
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([40, 38, 68, 255])
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.uniform1i(uTex, 0);
  gl.uniform1f(uHasTex, 0.0);

  let hasTexture = false;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    hasTexture = true;
    gl.uniform1f(uHasTex, 1.0);
  };
  img.onerror = () => {
    hasTexture = false;
    gl.uniform1f(uHasTex, 0.0);
    showStatus("No se encontró water.jpg en el repo; usando modo shader de respaldo.");
  };
  img.src = TEXTURE_URL;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  window.addEventListener("pointermove", (e) => {
    targetX = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2.0;
    targetY = -(e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2.0;
  });

  window.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  window.addEventListener("resize", resize);
  resize();

  const startTime = performance.now();

  function render(now) {
    const elapsed = (now - startTime) * 0.001;

    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1f(uHasTex, hasTexture ? 1.0 : 0.0);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uMouse, currentX, currentY);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
