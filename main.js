  let canvas = document.getElementById('canvas');
  const width = canvas.width;
  const height = canvas.height;

  // Colors
  const black = new THREE.Color('black');
  const white = new THREE.Color('white');

  // Scene
  const scene = new THREE.Scene();

  // import stats for fps
  const stats = new Stats();
  const canvasContainer = document.getElementById('container');
  canvasContainer.appendChild(stats.dom);

  // audio
  var audioListener = new THREE.AudioListener();
  var audio = new THREE.Audio(audioListener);

  // AudioLoader
  var audioLoader = new THREE.AudioLoader();
  audioLoader.load('rainstorm.mp3', function(buffer) {
      audio.setBuffer(buffer);
      audio.setLoop(false);
      audio.setVolume(0.5);
  });


  function loadFile(filename) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.FileLoader();

      loader.load(filename, (data) => {
        resolve(data);
      });
    });
  }


  // Shader chunks
  loadFile('shaders/utils.glsl').then((utils) => {
    THREE.ShaderChunk['utils'] = utils;

    
  // Create Renderer
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
  camera.position.set(0, 0.5, 2);
  camera.rotation.set(2, 0.1, 3);

  camera.add(audioListener);

  const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true, alpha: true});
  renderer.setSize(width, height);
  renderer.autoClear = false;

  // Light direction
  const light = [0.7, 0.1, -1.2];
  scene.add(light);

  // mouse control system
  const controls = new THREE.TrackballControls(camera,canvas);
  controls.screen.width = width;
  controls.screen.height = height;

  // Ray caster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  // Target Mesh
  const targetgeometry = new THREE.PlaneGeometry(2, 2);
  for (let vertex of targetgeometry.vertices) {
    vertex.z = - vertex.y;
    vertex.y = 0.;
  }
  const targetmesh = new THREE.Mesh(targetgeometry);
  scene.add(targetmesh);

  // Textures cube
  const cubetextureloader = new THREE.CubeTextureLoader();
  const textureCube = cubetextureloader.load([
    './assets/px.png', './assets/nx.png',
    './assets/py.png', './assets/ny.png',
    './assets/pz.png', './assets/nz.png',
  ]);

  // pool texurres
  const textureloader = new THREE.TextureLoader();
  const tiles = textureloader.load('./assets/walls.jpg');

  


  class WaterSimulation {

    constructor() {
      this._camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 100);
      // water wave range 
      this._geometry = new THREE.PlaneBufferGeometry(2, 2);

      this._textureA = new THREE.WebGLRenderTarget(256, 256, {type: THREE.FloatType});
      this._textureB = new THREE.WebGLRenderTarget(256, 256, {type: THREE.FloatType});
      this.texture = this._textureA;

      const shadersPromises = [
        loadFile('shaders/simulation/vertex.glsl'),
        loadFile('shaders/simulation/drop_fragment.glsl'),
        loadFile('shaders/simulation/normal_fragment.glsl'),
        loadFile('shaders/simulation/update_fragment.glsl'),
      ];


      this.loaded = Promise.all(shadersPromises)
          .then(([vertexShader, dropFragmentShader, normalFragmentShader, updateFragmentShader]) => {
        const dropMaterial = new THREE.RawShaderMaterial({
          uniforms: {
              center: { value: [0, 0] },
              radius: { value: 0 },
              strength: { value: 0 },
              texture: { value: null },
          },
          vertexShader: vertexShader,
          fragmentShader: dropFragmentShader,
        });

        const normalMaterial = new THREE.RawShaderMaterial({
          uniforms: {            
              texture: { value: null },
          },
          vertexShader: vertexShader,
          fragmentShader: normalFragmentShader,
        });

        const updateMaterial = new THREE.RawShaderMaterial({
          uniforms: {
              texture: { value: null },
          },
          vertexShader: vertexShader,
          fragmentShader: updateFragmentShader,
        });

        this._dropMesh = new THREE.Mesh(this._geometry, dropMaterial);
        this._normalMesh = new THREE.Mesh(this._geometry, normalMaterial);
        this._updateMesh = new THREE.Mesh(this._geometry, updateMaterial);
      });
    }
    
    resetWaves() {
      const gl = renderer.getContext();
      const previousRenderTarget = renderer.getRenderTarget(); 

      // restore cur color
      const currentClearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
      
      
      const clearColor = new Float32Array([0, 0, 0, 0]); // RGBA，0 transparent
      this.clearTexture(this._textureA, clearColor);
      this.clearTexture(this._textureB, clearColor);
  
      // make sure to get back to the prev texture
      this.texture = this._textureA;
      
      // reset the audio once click reset button
      if (audio.isPlaying) {
        audio.stop();
      }
      
      gl.clearColor(currentClearColor[0], currentClearColor[1], currentClearColor[2], currentClearColor[3]);

      
      renderer.setRenderTarget(previousRenderTarget);

      console.log("Waves have been reset.");
    }
    
    clearTexture(texture, clearColor) {
        const gl = renderer.getContext();
        renderer.setRenderTarget(texture);
        gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
        gl.clear(gl.COLOR_BUFFER_BIT); 
    }
    

    // Add a drop in the range of -1, 1
    addDrop(renderer, x, y, radius, strength) {
      this._dropMesh.material.uniforms['center'].value = [x, y];
      this._dropMesh.material.uniforms['radius'].value = radius;
      this._dropMesh.material.uniforms['strength'].value = strength;
      this._render(renderer, this._dropMesh);
    }

    stepSimulation(renderer) {
      this._render(renderer, this._updateMesh);
    }

    updateNormals(renderer) {
      this._render(renderer, this._normalMesh);
    }

    _render(renderer, mesh) {
      // Swap textures
      const oldTexture = this.texture;
      const newTexture = this.texture === this._textureA ? this._textureB : this._textureA;

      mesh.material.uniforms['texture'].value = oldTexture.texture;

      renderer.setRenderTarget(newTexture);

      // TODO Camera is useless here, what should be done?
      renderer.render(mesh, this._camera);

      this.texture = newTexture;
    }

  }



  class Water {
    constructor() {
      this.geometry = new THREE.PlaneBufferGeometry(2, 2, 200, 200);

      const shadersPromises = [
        loadFile('shaders/water/vertex.glsl'),
        loadFile('shaders/water/fragment.glsl')
      ];

      this.loaded = Promise.all(shadersPromises)
          .then(([vertexShader, fragmentShader]) => {
        this.material = new THREE.RawShaderMaterial({
          uniforms: {
              light: { value: light },
              tiles: { value: tiles },
              sky: { value: textureCube },
              water: { value: null },
              underwater: { value: false },
          },
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
      });
    }

    draw(renderer, waterTexture) {
      this.material.uniforms['water'].value = waterTexture;
      

      this.material.side = THREE.FrontSide;
      this.material.uniforms['underwater'].value = true;
      renderer.render(this.mesh, camera);

      this.material.side = THREE.BackSide;
      this.material.uniforms['underwater'].value = false;
      renderer.render(this.mesh, camera);
    }

  }


  class Pool {
    constructor() {
      this._geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -1, -1, -1,
        -1, -1, 1,
        -1, 1, -1,
        -1, 1, 1,
        1, -1, -1,
        1, 1, -1,
        1, -1, 1,
        1, 1, 1,
        -1, -1, -1,
        1, -1, -1,
        -1, -1, 1,
        1, -1, 1,
        -1, 1, -1,
        -1, 1, 1,
        1, 1, -1,
        1, 1, 1,
        -1, -1, -1,
        -1, 1, -1,
        1, -1, -1,
        1, 1, -1,
        -1, -1, 1,
        1, -1, 1,
        -1, 1, 1,
        1, 1, 1
      ]);
      const indices = new Uint32Array([
        0, 1, 2,
        2, 1, 3,
        4, 5, 6,
        6, 5, 7,
        12, 13, 14,
        14, 13, 15,
        16, 17, 18,
        18, 17, 19,
        20, 21, 22,
        22, 21, 23
      ]);

      this._geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      this._geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      const shadersPromises = [
        loadFile('shaders/pool/vertex.glsl'),
        loadFile('shaders/pool/fragment.glsl')
      ];

      this.loaded = Promise.all(shadersPromises)
          .then(([vertexShader, fragmentShader]) => {
        this._material = new THREE.RawShaderMaterial({
          uniforms: {
              light: { value: light },
              tiles: { value: tiles },
              water: { value: null },
          },
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
        });
        this._material.side = THREE.FrontSide;

        this._mesh = new THREE.Mesh(this._geometry, this._material);
      });
    }

    draw(renderer, waterTexture) {
      this._material.uniforms['water'].value = waterTexture;
      renderer.render(this._mesh, camera);
    }
  }



  const waterSimulation = new WaterSimulation();
  const water = new Water();
  let pool = new Pool();


  // Main rendering loop
  function animate() {
    stats.begin();

    // test the performance for complex computation
    // let dummy = 0;
    // for (let i = 0; i < 100000000; i++) {
    //     dummy += Math.sqrt(i);
    // }

    waterSimulation.stepSimulation(renderer);
    waterSimulation.updateNormals(renderer);

    const waterTexture = waterSimulation.texture.texture;

    renderer.setRenderTarget(null);
    renderer.setClearColor(black, 0.5);
    renderer.clear();

    water.draw(renderer, waterTexture);
    pool.draw(renderer, waterTexture);


    controls.update();

    window.requestAnimationFrame(animate);

    stats.end();
  }
  

  let isMouseDown = false;  

  function onMouseDown(event) {
    isMouseDown = true;  
    onMouseMove(event);  
  }

  function onMouseUp(event) {
    isMouseDown = false;  
  }

  function onMouseMove(event) {
    if (!isMouseDown) return;  

    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * 2 / width - 1;
    mouse.y = - (event.clientY - rect.top) * 2 / height + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(targetmesh);

    for (let intersect of intersects) {
      waterSimulation.addDrop(renderer, intersect.point.x, intersect.point.z, 0.03, 0.04);
    }
  }

  

  

  const loaded = [waterSimulation.loaded, water.loaded, pool.loaded];

  Promise.all(loaded).then(() => {
    /**
     * add some random drops
     */
    const addRandomDropsButton = document.getElementById('addDropsButton');
    if (addRandomDropsButton) {
        addRandomDropsButton.addEventListener('click', function() {                    
            // add random 10 drops water genearte waves
            for (var i = 0; i < 5; i++) {
                waterSimulation.addDrop(
                    renderer, Math.random() * 2 - 1, Math.random() * 2 - 1, 0.002, 0.2
                );
            }
        });
    } else {
        console.log('Add Random Drops Button not found');
    }

    /**
     * simulate rainstorm effects
     */
    const rainstormButton = document.getElementById('rainstormButton');
    if (rainstormButton) {
        rainstormButton.addEventListener('click', function() {
            // rainstorm simulate
            for (var i = 0; i < 100; i++) {  
                waterSimulation.addDrop(
                    renderer, Math.random() * 2 - 1, Math.random() * 2 - 1, 0.002, 2.0                    
                );
            }
            if (!audio.isPlaying) {
              audio.play();
            }
        });
    } else {
        console.log('Rainstorm Button not found');
    }

    /**
     * reset all the effects
     */
    const resetWavesButton = document.getElementById('resetWavesButton');
    if (resetWavesButton) {
        resetWavesButton.addEventListener('click', function() {
            waterSimulation.resetWaves();  
        });
    } else {
        console.log('Reset Waves Button not found');
    }


    animate();
  });


  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);
});




