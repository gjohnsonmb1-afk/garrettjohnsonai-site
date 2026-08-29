/* Protocol section background: four pulses expanding across a tilted ground
   plane, staggered and looping. It is the same four calls going out to every
   tool, which is what the section is about.

   Shares the hero's ground-plane language so the two read as one system, and
   reuses the Three.js the hero already loaded, so the marginal cost is this
   file rather than another library.

   One plane, one shader, one draw call. The rings are computed per-pixel
   rather than built as geometry. */
(function () {
  var canvas = document.getElementById("protocol-canvas");
  if (!canvas || !window.THREE) return;

  var renderer, scene, camera, mat, clock;
  var running = false, visible = true, inView = false;

  function build() {
    var geo = new THREE.PlaneGeometry(120, 120, 1, 1);

    mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: new THREE.Color(0xf2a94e) },
        uOpacity: { value: 0.13 }
      },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec2 vUv;",
        "uniform float uTime;",
        "uniform vec3 uColor;",
        "uniform float uOpacity;",
        "",
        "const float PULSES = 4.0;",   // one per call in the protocol
        "const float PERIOD = 7.0;",   // seconds for a pulse to cross the plane
        "",
        "void main() {",
        "  vec2 p = vUv - 0.5;",
        "  float d = length(p);",
        "",
        "  float acc = 0.0;",
        "  for (float i = 0.0; i < PULSES; i += 1.0) {",
        // stagger each pulse by a quarter of the cycle
        "    float phase = fract(uTime / PERIOD + i / PULSES);",
        "    float r = phase * 0.52;",
        // thin ring, softened as it grows so the edge never turns hard
        "    float w = 0.0018 + phase * 0.004;",
        "    float ring = smoothstep(w, 0.0, abs(d - r));",
        // fade in off the origin, then out toward the rim
        "    ring *= smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.55, 1.0, phase));",
        "    acc += ring;",
        "  }",
        "",
        // vignette so the plane dissolves instead of ending at an edge
        "  acc *= 1.0 - smoothstep(0.08, 0.36, d);",
        "  gl_FragColor = vec4(uColor, clamp(acc, 0.0, 1.0) * uOpacity);",
        "}"
      ].join("\n")
    });

    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;   // lay it flat, matching the hero floor
    scene.add(mesh);
  }

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible || !inView) return;

    mat.uniforms.uTime.value += Math.min(clock.getDelta(), 0.05);
    renderer.render(scene, camera);
  }

  function init() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, alpha: true, antialias: true, powerPreference: "low-power"
      });
    } catch (e) { return; }
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    camera.position.set(0, 34, 74);
    camera.lookAt(0, 0, 0);

    build();
    clock = new THREE.Clock();
    resize();
    window.addEventListener("resize", resize);

    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden;
      clock.getDelta();
    });

    /* Only runs while the section is on screen. Unlike the hero, this one
       starts out of view, so it costs nothing until scrolled to. */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        clock.getDelta();
      }, { threshold: 0 }).observe(canvas);
    } else {
      inView = true;
    }

    canvas.classList.add("is-live");
    running = true;
    frame();
  }

  init();
})();
