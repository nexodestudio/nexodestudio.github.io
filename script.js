const fragmentShaderSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += amp * noise(p);
        p = rot * p * 2.02;
        amp *= 0.5;
      }
      return v;
    }

    float waterWaves(vec2 p, float t) {
      float w = 0.0;
      w += fbm(p * 1.9 + vec2(t * 0.18, -t * 0.14));
      w += 0.5 * fbm(p * 3.8 - vec2(t * 0.24, t * 0.19));
      return w;
    }

    vec2 rotate2D(vec2 v, float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c) * v;
    }

    void main() {
      float minDim = max(min(u_resolution.x, u_resolution.y), 1.0);
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;

      vec2 parallax = u_mouse * 0.12;
      vec2 p = uv + parallax;
      float t = u_time;

      float r = length(p);

      // Olas suaves de la superficie
      float eps = 0.02;
      vec2 waveCoord = p * (1.45 + r * 1.8);
      float h0 = waterWaves(waveCoord, t);
      float hx = waterWaves(waveCoord + vec2(eps, 0.0), t);
      float hy = waterWaves(waveCoord + vec2(0.0, eps), t);
      vec2 normal = clamp(vec2(hx - h0, hy - h0) / eps, -2.0, 2.0);

      vec2 refracted = p + normal * 0.032 * smoothstep(0.02, 0.6, r);
      float rr = length(refracted);

      // Ventana de Snell y núcleo luminoso
      float sunCore = exp(-rr * rr * 28.0);
      float snellWindow = smoothstep(0.75, 0.05, rr);
      float innerHalo = exp(-rr * 3.2);

      // Ondas de superficie más suaves
      float surfaceRipples = smoothstep(0.45, 0.92, h0) * smoothstep(0.85, 0.15, rr);

      // Rayos volumétricos continuos y suaves (con fbm en lugar de ruido duro)
      vec2 dir = p / max(r, 0.001);
      vec2 dir1 = rotate2D(dir, t * 0.05);
      vec2 dir2 = rotate2D(dir, -t * 0.07);

      float rayFbm1 = fbm(dir1 * 2.4 + vec2(r * 0.6 - t * 0.14));
      float rayFbm2 = fbm(dir2 * 4.2 - vec2(r * 0.9 - t * 0.20));
      float rays = pow(clamp(rayFbm1 * 0.65 + rayFbm2 * 0.35, 0.0, 1.0), 2.2);
      rays *= smoothstep(0.05, 0.28, r) * smoothstep(1.0, 0.18, r);

      // Partículas suaves
      vec2 dustUV = uv * 7.5 + parallax * 1.5 + vec2(sin(t * 0.12) * 0.25, -t * 0.07);
      vec2 dustCell = floor(dustUV);
      vec2 dustFract = fract(dustUV) - 0.5;
      float rnd = hash(dustCell);
      vec2 offset = vec2(hash(dustCell + 11.3), hash(dustCell + 27.9)) - 0.5;
      float d = length(dustFract - offset * 0.5);
      float dust = smoothstep(0.08, 0.0, d) * step(0.88, rnd) * smoothstep(0.95, 0.15, r);

      // Paleta del personaje (índigo oscuro, pizarra violáceo y blanco)
      vec3 deepAbyss = vec3(0.043, 0.039, 0.075);
      vec3 midOcean  = vec3(0.106, 0.098, 0.169);
      vec3 shallow   = vec3(0.235, 0.220, 0.375);
      vec3 sunLight  = vec3(0.945, 0.945, 0.985);

      vec3 col = deepAbyss;
      col = mix(col, midOcean, snellWindow * 0.88);
      col = mix(col, shallow, innerHalo * 0.82);
      col += mix(shallow, sunLight, 0.4) * surfaceRipples * 0.45;
      col += mix(shallow, sunLight, 0.68) * rays * 0.52;
      col += sunLight * sunCore * 1.25;
      col += sunLight * dust * 0.3;

      float vignette = smoothstep(1.3, 0.22, length(uv));
      col *= mix(0.35, 1.0, vignette);

      col = col / (1.0 + col * 0.32);
      col = pow(max(col, vec3(0.0)), vec3(0.94));

      gl_FragColor = vec4(col, 1.0);
    }
  `;
