(() => {
  const VERTEX_SHADER = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
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

    float dustLayer(vec2 uv, float scale, float t, float density) {
      vec2 gv = uv * scale;
      vec2 id = floor(gv);
      vec2 f = fract(gv) - 0.5;
      float acc = 0.0;

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

      vec2 parallax = u_mouse * 0.11;
      vec2 p = uv + parallax;
      float t = u_time;
      float r = length(p);

      float c1 = causticsPattern(p * (1.15 + r * 0.55), t);
      float c2 = causticsPattern(p * 1.85 - parallax * 0.5, -t * 0.75 + 2.1);
      float caustics = clamp(c1 * 0.68 + c2 * 0.45, 0.0, 1.0);

      vec2 refracted = p + vec2(c1 - 0.5, c2 - 0.5) * 0.045 * smoothstep(0.05, 0.75, r);
      float rr = length(refracted);

      float snellWindow = smoothstep(0.88, 0.06, rr);
      float innerGlow = exp(-rr * rr * 4.2);
      float coreSun = exp(-rr * rr * 26.0);

      float rayWaveA = 0.5 + 0.5 * sin(refracted.x * 6.5 + refracted.y * 2.2 + t * 0.42);
      float rayWaveB = 0.5 + 0.5 * cos(refracted.x * 4.2 - refracted.y * 5.4 - t * 0.31);
      float rays = pow(clamp(rayWaveA * 0.55 + rayWaveB * 0.45, 0.0, 1.0), 2.5);
      rays *= smoothstep(0.04, 0.25, rr) * smoothstep(1.05, 0.15, rr) * (0.45 + 0.55 * caustics);

      float dustNear = dustLayer(uv + parallax * 1.7 + vec2(0.0, -t * 0.03), 4.2, t, 0.22);
      float dustFar  = dustLayer(uv + parallax * 1.1 + vec2(0.31, -t * 0.018), 7.5, t * 0.85 + 4.0, 0.18);
      float dust = (dustNear * 0.85 + dustFar * 0.55) * smoothstep(1.05, 0.12, r);

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

      float vignette = smoothstep(1.35, 0.22, length(uv));
      col *= mix(0.30, 1.0, vignette);

      col = col / (1.0 + col * 0.30);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(gl, type, source) {
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

  function initShaderBg(canvas) {
    if (!canvas) return null;

    const gl =
      canvas.getContext("webgl", { alpha: false, antialias: true }) ||
      canvas.getContext("experimental-webgl", { alpha: false, antialias: true });

    if (!gl) {
      console.error("WebGL no soportado.");
      return null;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Error enlazando programa:", gl.getProgramInfoLog(program));
      return null;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = null;

    function onPointerMove(e) {
      if (e.pointerType === "touch") return;
      targetX = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2.0;
      targetY = -(e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2.0;
    }

    function onPointerLeave() {
      targetX = 0;
      targetY = 0;
    }

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

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize);
    resize();

    const startTime = performance.now();

    function loop(now) {
      const elapsed = (now - startTime) * 0.001;
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, currentX, currentY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return {
      stop() {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("resize", resize);
      }
    };
  }

  window.ShaderBackground = { init: initShaderBg };
})();