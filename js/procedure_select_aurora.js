"use strict";

(() => {
  const canvas = document.getElementById("procedure-aurora");
  if (!canvas) return;

  const gl =
    canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false }) ||
    canvas.getContext("experimental-webgl");

  if (!gl) {
    canvas.style.display = "none";
    return;
  }

  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    vec3 auroraLayer(vec2 uv, float time, vec3 tint, float offset) {
      vec2 p = uv - 0.5;
      p.y += offset;

      float wave = sin(p.x * 3.0 + time * 0.25) * 0.05;
      wave += sin(p.x * 5.0 + time * 0.35) * 0.025;
      wave += cos(p.x * 2.0 + time * 0.2) * 0.035;

      float y = p.y - wave;
      float intensity = exp(-abs(y) * 18.0);
      return tint * intensity;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec3 color = vec3(0.01, 0.01, 0.02);

      color += auroraLayer(uv, u_time, vec3(0.08, 0.18, 0.35), 0.15) * 0.4;
      color += auroraLayer(uv, u_time + 1.5, vec3(0.12, 0.05, 0.22), -0.05) * 0.3;
      color += auroraLayer(uv, u_time + 3.0, vec3(0.05, 0.2, 0.16), 0.3) * 0.25;

      vec2 starUv = uv * 90.0;
      vec2 starId = floor(starUv);
      vec2 starFract = fract(starUv);
      float star = hash(starId);
      if (star > 0.995) {
        float twinkle = (sin(u_time * 1.2 + star * 10.0) * 0.4 + 0.6) * 0.25;
        float dist = length(starFract - 0.5);
        if (dist < 0.025) {
          color += vec3(0.3, 0.4, 0.55) * (1.0 - dist * 35.0) * twinkle;
        }
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[Aurora] Shader error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    canvas.style.display = "none";
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[Aurora] Program link error:", gl.getProgramInfoLog(program));
    canvas.style.display = "none";
    return;
  }

  const positionAttribute = gl.getAttribLocation(program, "a_position");
  const timeUniform = gl.getUniformLocation(program, "u_time");
  const resolutionUniform = gl.getUniformLocation(program, "u_resolution");

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      gl.viewport(0, 0, width, height);
    }
  }

  window.addEventListener("resize", resize);
  resize();

  function render(time) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttribute);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(timeUniform, time * 0.001);
    gl.uniform2f(resolutionUniform, canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
