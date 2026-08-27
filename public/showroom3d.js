"use strict";

(() => {

  let currentScene = null;

  /*
   * HEAVY LUX 3D SHOWROOM
   *
   * Отдельный модуль.
   * Не зависит от Socket.IO и серверной логики.
   */

  function createShowroom(options = {}) {

    const container = options.container;

    if (!container) {
      console.error("Heavy Lux 3D: container not found");
      return null;
    }

    if (!window.THREE) {
      console.error("Heavy Lux 3D: THREE.js not loaded");
      container.innerHTML = `
        <div class="showroomError">
          Three.js не загрузился.
        </div>
      `;
      return null;
    }

    container.innerHTML = "";

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 420;

    /* SCENE */

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x050505);

    /* CAMERA */

    const camera = new THREE.PerspectiveCamera(
      38,
      width / height,
      0.1,
      100
    );

    camera.position.set(
      5.4,
      2.6,
      7
    );

    camera.lookAt(
      0,
      1,
      0
    );

    /* RENDERER */

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(width, height);

    renderer.shadowMap.enabled = true;

    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    /* LIGHTING */

    const ambient = new THREE.HemisphereLight(
      0xffffff,
      0x111111,
      1.6
    );

    scene.add(ambient);

    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        4
      );

    keyLight.position.set(
      4,
      7,
      5
    );

    keyLight.castShadow = true;

    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;

    scene.add(keyLight);

    const frontLight =
      new THREE.DirectionalLight(
        0xffffff,
        2.2
      );

    frontLight.position.set(
      -4,
      3,
      7
    );

    scene.add(frontLight);

    const rimLight =
      new THREE.DirectionalLight(
        0xcccccc,
        3
      );

    rimLight.position.set(
      -5,
      4,
      -6
    );

    scene.add(rimLight);

    /* FLOOR */

    const floorGeometry =
      new THREE.PlaneGeometry(
        30,
        30
      );

    const floorMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x0b0b0b,
        roughness: 0.35,
        metalness: 0.75
      });

    const floor =
      new THREE.Mesh(
        floorGeometry,
        floorMaterial
      );

    floor.rotation.x =
      -Math.PI / 2;

    floor.position.y = 0;

    floor.receiveShadow = true;

    scene.add(floor);

    /* BACK WALL */

    const wallGeometry =
      new THREE.PlaneGeometry(
        30,
        15
      );

    const wallMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x080808,
        roughness: 0.8
      });

    const wall =
      new THREE.Mesh(
        wallGeometry,
        wallMaterial
      );

    wall.position.set(
      0,
      7,
      -5
    );

    wall.rotation.x = 0;

    scene.add(wall);

    /* PLATFORM */

    const platformGeometry =
      new THREE.CylinderGeometry(
        3.7,
        3.7,
        0.18,
        96
      );

    const platformMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x171717,
        metalness: 0.9,
        roughness: 0.2
      });

    const platform =
      new THREE.Mesh(
        platformGeometry,
        platformMaterial
      );

    platform.position.y =
      0.09;

    platform.receiveShadow = true;
    platform.castShadow = true;

    scene.add(platform);

    /* PLATFORM RING */

    const ringGeometry =
      new THREE.TorusGeometry(
        3.2,
        0.025,
        12,
        128
      );

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffff
      });

    const ring =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      );

    ring.rotation.x =
      Math.PI / 2;

    ring.position.y =
      0.2;

    scene.add(ring);

    /* CAR */

    const car =
      createLuxurySUV();

    car.position.y =
      0.28;

    car.rotation.y =
      Math.PI * 0.18;

    scene.add(car);

    /* CONTROLS */

    let dragging = false;
    let previousX = 0;

    renderer.domElement.addEventListener(
      "pointerdown",
      event => {

        dragging = true;
        previousX = event.clientX;

        renderer.domElement.setPointerCapture(
          event.pointerId
        );

      }
    );

    renderer.domElement.addEventListener(
      "pointermove",
      event => {

        if (!dragging) return;

        const delta =
          event.clientX - previousX;

        previousX = event.clientX;

        car.rotation.y +=
          delta * 0.008;

      }
    );

    renderer.domElement.addEventListener(
      "pointerup",
      () => {
        dragging = false;
      }
    );

    renderer.domElement.addEventListener(
      "pointercancel",
      () => {
        dragging = false;
      }
    );

    /* AUTO ROTATION */

    let autoRotate = true;

    renderer.domElement.addEventListener(
      "pointerdown",
      () => {
        autoRotate = false;
      }
    );

    /* RESIZE */

    const resize = () => {

      const w =
        container.clientWidth || width;

      const h =
        container.clientHeight || height;

      camera.aspect =
        w / h;

      camera.updateProjectionMatrix();

      renderer.setSize(
        w,
        h
      );

    };

    window.addEventListener(
      "resize",
      resize
    );

    /* ANIMATION */

    let destroyed = false;

    function animate() {

      if (destroyed) return;

      requestAnimationFrame(
        animate
      );

      if (autoRotate) {

        car.rotation.y +=
          0.0025;

      }

      renderer.render(
        scene,
        camera
      );

    }

    animate();

    currentScene = {
      scene,
      camera,
      renderer,
      car,

      destroy() {

        destroyed = true;

        window.removeEventListener(
          "resize",
          resize
        );

        renderer.dispose();

        container.innerHTML = "";

      }

    };

    return currentScene;

  }


  /*
   * ПРОЦЕДУРНАЯ LUXURY SUV
   *
   * Это временная 3D-модель.
   *
   * Архитектура специально сделана так,
   * чтобы позднее заменить её на GLB.
   */

  function createLuxurySUV() {

    const group =
      new THREE.Group();

    /* MATERIALS */

    const bodyMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x171717,
        metalness: 0.92,
        roughness: 0.19
      });

    const blackMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x030303,
        metalness: 0.75,
        roughness: 0.18
      });

    const glassMaterial =
      new THREE.MeshPhysicalMaterial({
        color: 0x020202,
        metalness: 0.15,
        roughness: 0.08,
        transmission: 0.05,
        transparent: true,
        opacity: 0.78
      });

    const chromeMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xbcbcbc,
        metalness: 1,
        roughness: 0.14
      });

    const tireMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x020202,
        roughness: 0.8,
        metalness: 0.05
      });

    const wheelMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x737373,
        metalness: 1,
        roughness: 0.18
      });

    /* BODY */

    const bodyGeometry =
      new THREE.BoxGeometry(
        4.25,
        1.35,
        2.05
      );

    const body =
      new THREE.Mesh(
        bodyGeometry,
        bodyMaterial
      );

    body.position.y =
      1.35;

    body.castShadow = true;

    body.scale.set(
      1,
      1,
      1
    );

    group.add(body);

    /* LOWER BODY */

    const lowerGeometry =
      new THREE.BoxGeometry(
        4.45,
        0.48,
        2.14
      );

    const lower =
      new THREE.Mesh(
        lowerGeometry,
        blackMaterial
      );

    lower.position.y =
      0.82;

    lower.castShadow = true;

    group.add(lower);

    /* ROOF */

    const roofGeometry =
      new THREE.BoxGeometry(
        2.75,
        0.65,
        1.82
      );

    const roof =
      new THREE.Mesh(
        roofGeometry,
        bodyMaterial
      );

    roof.position.set(
      -0.05,
      2.22,
      0
    );

    roof.rotation.z =
      -0.01;

    roof.castShadow = true;

    group.add(roof);

    /* FRONT WINDOW */

    const windshieldGeometry =
      new THREE.BoxGeometry(
        0.75,
        0.56,
        1.84
      );

    const windshield =
      new THREE.Mesh(
        windshieldGeometry,
        glassMaterial
      );

    windshield.position.set(
      -1.05,
      2.2,
      0
    );

    windshield.rotation.z =
      -0.25;

    group.add(windshield);

    /* SIDE WINDOWS */

    [-0.05, 0.9].forEach(
      x => {

        const sideWindow =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              0.75,
              0.5,
              1.85
            ),
            glassMaterial
          );

        sideWindow.position.set(
          x,
          2.22,
          0
        );

        group.add(sideWindow);

      }
    );

    /* FRONT GRILLE */

    const grilleGeometry =
      new THREE.BoxGeometry(
        0.12,
        0.65,
        1.45
      );

    const grille =
      new THREE.Mesh(
        grilleGeometry,
        chromeMaterial
      );

    grille.position.set(
      -2.17,
      1.36,
      0
    );

    group.add(grille);

    /* GRILLE BARS */

    for (
      let i = -3;
      i <= 3;
      i++
    ) {

      const bar =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.025,
            0.5,
            1.42
          ),
          blackMaterial
        );

      bar.position.set(
        -2.245,
        1.36,
        i * 0.18
      );

      group.add(bar);

    }

    /* HEADLIGHTS */

    [-0.68, 0.68].forEach(
      z => {

        const light =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              0.08,
              0.28,
              0.42
            ),
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              emissive: 0xffffff,
              emissiveIntensity: 2
            })
          );

        light.position.set(
          -2.22,
          1.62,
          z
        );

        group.add(light);

      }
    );

    /* BUMPERS */

    const bumper =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          4.45,
          0.25,
          2.15
        ),
        blackMaterial
      );

    bumper.position.y =
      0.65;

    group.add(bumper);

    /* SIDE MIRRORS */

    [-1, 1].forEach(
      z => {

        const mirror =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              0.32,
              0.2,
              0.28
            ),
            blackMaterial
          );

        mirror.position.set(
          -0.75,
          1.95,
          z * 1.12
        );

        group.add(mirror);

      }
    );

    /* WHEELS */

    const wheelPositions = [
      [-1.42, 0.62, -1.06],
      [ 1.42, 0.62, -1.06],
      [-1.42, 0.62,  1.06],
      [ 1.42, 0.62,  1.06]
    ];

    wheelPositions.forEach(
      position => {

        const tire =
          new THREE.Mesh(
            new THREE.CylinderGeometry(
              0.55,
              0.55,
              0.32,
              48
            ),
            tireMaterial
          );

        tire.rotation.x =
          Math.PI / 2;

        tire.position.set(
          position[0],
          position[1],
          position[2]
        );

        tire.castShadow = true;

        group.add(tire);

        const rim =
          new THREE.Mesh(
            new THREE.CylinderGeometry(
              0.31,
              0.31,
              0.34,
              32
            ),
            wheelMaterial
          );

        rim.rotation.x =
          Math.PI / 2;

        rim.position.copy(
          tire.position
        );

        group.add(rim);

        const center =
          new THREE.Mesh(
            new THREE.CylinderGeometry(
              0.11,
              0.11,
              0.36,
              24
            ),
            chromeMaterial
          );

        center.rotation.x =
          Math.PI / 2;

        center.position.copy(
          tire.position
        );

        group.add(center);

      }
    );

    /* SIDE STEPS */

    [-1, 1].forEach(
      z => {

        const step =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              2.8,
              0.08,
              0.22
            ),
            chromeMaterial
          );

        step.position.set(
          0,
          0.55,
          z * 1.13
        );

        group.add(step);

      }
    );

    /* REAR SPOILER */

    const spoiler =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.35,
          0.12,
          1.9
        ),
        blackMaterial
      );

    spoiler.position.set(
      1.82,
      2.18,
      0
    );

    group.add(spoiler);

    return group;

  }


  /*
   * Открытие 3D-шоурума
   */

  window.openHeavyLux3DShowroom =
    function (
      vehicle = {}
    ) {

      const modal =
        document.createElement("div");

      modal.className =
        "showroomModal";

      const vehicleName =
        `${vehicle.brand || "Mercedes-Benz"} ${
          vehicle.model || "G-Class"
        }`;

      modal.innerHTML = `
        <div class="showroomWindow">

          <div class="showroomHeader">

            <div>
              <div class="showroomEyebrow">
                HEAVY MOTORS
              </div>

              <h2>
                ${escapeHTML(vehicleName)}
              </h2>

              <small>
                3D EXPERIENCE
              </small>
            </div>

            <button
              class="showroomClose"
              id="showroomClose"
            >
              ✕
            </button>

          </div>

          <div
            id="showroomCanvas"
            class="showroomCanvas"
          ></div>

          <div class="showroomInfo">

            <div>
              <span>МОДЕЛЬ</span>
              <b>${escapeHTML(vehicle.model || "G-Class")}</b>
            </div>

            <div>
              <span>КЛАСС</span>
              <b>LUXURY SUV</b>
            </div>

            <div>
              <span>HEAVY LUX</span>
              <b>EXCLUSIVE</b>
            </div>

          </div>

          <button
            class="primary wide"
            id="showroomSelect"
          >
            Выбрать автомобиль
          </button>

        </div>
      `;

      document.body.appendChild(
        modal
      );

      const canvas =
        modal.querySelector(
          "#showroomCanvas"
        );

      const showroom =
        createShowroom({
          container: canvas
        });

      modal.querySelector(
        "#showroomClose"
      ).onclick =
        () => {

          showroom?.destroy();

          modal.remove();

        };

      modal.querySelector(
        "#showroomSelect"
      ).onclick =
        () => {

          showroom?.destroy();

          modal.remove();

          if (
            typeof window.showroomVehicleSelected ===
            "function"
          ) {

            window.showroomVehicleSelected(
              vehicle
            );

          }

        };

      return modal;

    };


  function escapeHTML(value) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
    );

  }


})();
