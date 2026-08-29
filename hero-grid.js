/* Hero background: perspective grid receding to a horizon, with a sparse
   particle haze and damped pointer parallax.

   Loaded conditionally by index.html. It never runs on reduced-motion,
   small screens, save-data connections, or without WebGL, so the static
   hero stays the baseline experience rather than the fallback.

   Style note: matches the ES5-flavoured house style of the inline script. */
(function () {
  var canvas = document.getElementById("hero-canvas");
  if (!canvas || !window.THREE) return;

  var AMBER = 0xf2a94e;
  var SPACING = 4;          // world units between grid lines
  var HALF = 40;            // lines each side of centre
  var EXTENT = SPACING * HALF;
  var DRIFT = 1.9;          // units per second, toward the viewer

  var LITE = !!window.__gjLite;   // phones: fewer particles, lower DPR, softer
  var renderer, scene, camera, gridGroup, dust, clock;
  var running = false, visible = true, inView = true;
  var pointer = { x: 0, y: 0 };   // target, -1..1
  var eased = { x: 0, y: 0 };     // damped follower

  /* ---- grid ------------------------------------------------------- */
  /* Lines are built once and cycled along Z, so the field reads as
     infinite without ever reallocating geometry. */
  function buildGrid() {
    var pts = [];
    for (var i = -HALF; i <= HALF; i++) {
      var o = i * SPACING;
      pts.push(-EXTENT, 0, o, EXTENT, 0, o);   // across
      pts.push(o, 0, -EXTENT, o, 0, EXTENT);   // away
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));

    /* Fade by camera distance in the shader rather than with fog, so the
       far field dissolves into the page background instead of a fog colour. */
    var mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(AMBER) },
        uNear: { value: 30.0 },
        uFar: { value: 118.0 },
        uOpacity: { value: LITE ? 0.30 : 0.40 }
      },
      vertexShader: [
        "varying float vFade;",
        "uniform float uNear;",
        "uniform float uFar;",
        "void main() {",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  float d = -mv.z;",
        "  vFade = 1.0 - smoothstep(uNear, uFar, d);",
        "  vFade *= smoothstep(4.0, 22.0, d);", // kill the near field, which otherwise reads as slabs
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vFade;",
        "uniform vec3 uColor;",
        "uniform float uOpacity;",
        "void main() {",
        "  gl_FragColor = vec4(uColor, vFade * uOpacity);",
        "}"
      ].join("\n")
    });

    gridGroup = new THREE.Group();
    gridGroup.add(new THREE.LineSegments(geo, mat));
    scene.add(gridGroup);
  }

  /* ---- dust ------------------------------------------------------- */
  function buildDust() {
    var COUNT = LITE ? 80 : 240, pos = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * EXTENT * 1.4;
      pos[i * 3 + 1] = Math.random() * 30 + 2.0;
      pos[i * 3 + 2] = (Math.random() - 0.5) * EXTENT * 1.6;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));

    dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: new THREE.Color(0xffc25e),
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    scene.add(dust);
  }

  /* ---- lifecycle -------------------------------------------------- */
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1.25 : 1.75));
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible || !inView) return;   // burn no GPU off-screen or in a background tab

    var dt = Math.min(clock.getDelta(), 0.05);

    /* Cycle the grid toward the camera and wrap by one cell, so the motion
       is continuous and the seam is never visible. */
    gridGroup.position.z = (gridGroup.position.z + DRIFT * dt) % SPACING;

    var p = dust.geometry.attributes.position;
    for (var i = 1; i < p.array.length; i += 3) {
      p.array[i] -= dt * 0.28;
      if (p.array[i] < 2.0) p.array[i] = 32;
    }
    p.needsUpdate = true;

    // Damped parallax. Deliberately slow: the background should breathe, not track.
    eased.x += (pointer.x - eased.x) * 0.035;
    eased.y += (pointer.y - eased.y) * 0.035;
    camera.position.x = eased.x * 2.6;
    camera.position.y = 9.0 + eased.y * 0.9;
    camera.lookAt(0, 0.0, -30);

    renderer.render(scene, camera);
  }

  function init() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, alpha: true, antialias: true, powerPreference: "low-power"
      });
    } catch (e) { return; }          // context creation can still fail on old GPUs
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 320);
    camera.position.set(0, 9.0, 24);

    buildGrid();
    buildDust();

    clock = new THREE.Clock();
    resize();
    window.addEventListener("resize", resize);

    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden;
      clock.getDelta();             // drop the gap so it does not lurch on return
    });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        clock.getDelta();
      }, { threshold: 0 }).observe(canvas);
    }

    var hero = document.querySelector(".hero");
    if (hero && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      hero.addEventListener("pointermove", function (e) {
        pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
      });
      hero.addEventListener("pointerleave", function () { pointer.x = 0; pointer.y = 0; });
    }

    canvas.classList.add("is-live");   // fades the canvas up over the static glow
    running = true;
    frame();
  }

  init();
})();
