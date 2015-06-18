/* jshint devel:true */

'use strict';
$.urlParam = function(name) {
  var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
  if (!results) { return 0; }
  return results[1] || 0;
};

var CARDBOARD = $.urlParam('cardboard');
var camera, scene, renderer;
var effect, controls;
var element, container, stats;

var clock = new THREE.Clock();

//oimo var
var ToRad = Math.PI / 180;
var world = null;
var bodys = [];
var mats = [];
var geos = [];
var meshs = [];
var grounds = [];
var MAX_SPHERES = 400;

init();
animate();

function setupStats() {
  var st = document.createElement('div');
  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';

  document.body.appendChild(st);
  st.appendChild(stats.domElement);
}

function clearMesh() {
  var i = meshs.length;
  while (i--) {
    scene.remove(meshs[ i ]);
  }
  i = grounds.length;
  while (i--) {
    scene.remove(grounds[ i ]);
  }
  grounds = [];
  meshs = [];
}

function addStaticBox(size, position, rotation) {
  var mesh = new THREE.Mesh(geos.box, mats.ground);
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0] * ToRad, rotation[1] * ToRad, rotation[2] * ToRad);
  scene.add(mesh);
  grounds.push(mesh);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

function basicTexture(n) {
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  var ctx = canvas.getContext('2d');
  var color;
  if (n === 0) { color = '#FFFFFF'; }// sphere58AA80
  if (n === 1) {color = '#61686B'; }// sphere sleep
  if (n === 2) {color = '#AA6538'; }// box
  if (n === 3) { color = '#61686B'; }// box sleep
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.2);';//colors[1];
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  var tx = new THREE.Texture(canvas);
  tx.needsUpdate = true;
  return tx;
}

function init() {

  setupStats();

  $('#cboard').click(function(e) {
    if(!CARDBOARD) {
      document.location.href = document.location.pathname + '?cardboard=' + 1;
    }else {
      document.location.href = document.location.pathname;
    }
  })

  if (device.mobile() || device.tablet()) {
    MAX_SPHERES = 150;
  }

  renderer = new THREE.WebGLRenderer();
  element = renderer.domElement;
  container = document.getElementById('mycanvas');
  container.appendChild(element);

  effect = new THREE.StereoEffect(renderer);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, 1, $(container).width() / $(container).height(), 2000);

  camera.position.set(0, 20, 0);
  scene.add(camera);

  controls = new THREE.OrbitControls(camera, element);
  controls.rotateUp(Math.PI / 4);
  controls.target.set(
    camera.position.x + 0.1,
    camera.position.y,
    camera.position.z
  );
  controls.noZoom = true;
  controls.noPan = true;

  function setOrientationControls(e) {
    if (!e.alpha) {
      return;
    }

    controls = new THREE.DeviceOrientationControls(camera, true);
    controls.connect();
    controls.update();
    MAX_SPHERES = 150;

    element.addEventListener('click', fullscreen, false);

    window.removeEventListener('deviceorientation', setOrientationControls, true);
  }
  window.addEventListener('deviceorientation', setOrientationControls, true);

  var light = new THREE.HemisphereLight(0x777777, 0x000000, 0.8);
  scene.add(light);

  var texture = THREE.ImageUtils.loadTexture(
    'images/test.png'
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat = new THREE.Vector2(50, 50);
  texture.anisotropy = renderer.getMaxAnisotropy();

  var material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: 0xffffff,
    shininess: 20,
    shading: THREE.FlatShading,
    map: texture
  });

  var geometry = new THREE.PlaneBufferGeometry(400, 400);

  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.rotation.x = -Math.PI / 2;

  // scene.add(mesh);

  // geometrys
  geos.sphere = new THREE.BufferGeometry();
  geos.sphere.fromGeometry(new THREE.SphereGeometry(1, 16, 10));
  geos.box = new THREE.BufferGeometry();
  geos.box.fromGeometry(new THREE.BoxGeometry(1, 1, 1));

  mats.sph = new THREE.MeshBasicMaterial({wireframe: true, name:'sph'});
  mats.sph = new THREE.MeshLambertMaterial({wireframe: true, name:'sph'});
  mats.box = new THREE.MeshPhongMaterial({map: basicTexture(2), name:'box'});
  mats.ssph = new THREE.MeshLambertMaterial({map: basicTexture(1), name:'ssph'});
  mats.sbox = new THREE.MeshLambertMaterial({map: basicTexture(3), name:'sbox'});
  mats.ground = new THREE.MeshLambertMaterial({color: 0x3D4143});

  setupPreloader();
  initOimoPhysics();
  populate(1);

  window.addEventListener('resize', resize, false);
  setTimeout(resize, 1);
}

function setupPreloader() {

  var parts = 50;
  var lesphere = new THREE.Mesh(
    new THREE.SphereGeometry(500, parts, parts),
    new THREE.MeshBasicMaterial({wireframe: true, wireframeLinewidth:1, transparent:true, overdraw:true})
  );
  lesphere.material.transparent = true;
  lesphere.material.opacity = 1;
  // create the particle variables
  var particles = new THREE.Geometry(),
      pMaterial = new THREE.PointCloudMaterial({
        sizeAttenuation: true,
        size: 2,
        transparent: true

      });

  // now create the individual particles
  for (var p = 0; p < lesphere.geometry.vertices.length; p++) {

    // create a particle with random
    // position values, -250 -> 250
    var pX = lesphere.geometry.vertices[p].x,
        pY = lesphere.geometry.vertices[p].y,
        pZ = lesphere.geometry.vertices[p].z,
        particle =  new THREE.Vector3(pX, pY, pZ);

    // add it to the geometry
    particles.vertices.push(particle);
  }

  // create the particle system
  var preloader = new THREE.PointCloud(
      particles,
      pMaterial);

  // add it to the scene
  scene.add(preloader);
}

function resize() {
  var width = container.offsetWidth;
  var height = container.offsetHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  effect.setSize(width, height);
}

function render(dt) {
  if (CARDBOARD) {
    effect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
  camera.updateProjectionMatrix();
  controls.update(dt);
  stats.update();
}

function animate() {
  requestAnimationFrame(animate);
  render(clock.getDelta());
}

function fullscreen() {
  if (container.requestFullscreen) {
    container.requestFullscreen();
  } else if (container.msRequestFullscreen) {
    container.msRequestFullscreen();
  } else if (container.mozRequestFullScreen) {
    container.mozRequestFullScreen();
  } else if (container.webkitRequestFullscreen) {
    container.webkitRequestFullscreen();
  }
}

//----------------------------------
//  OIMO PHYSICS
//----------------------------------
function initOimoPhysics() {
  // world setting:( TimeStep, BroadPhaseType, Iterations )
  // BroadPhaseType can be 
  // 1 : BruteForce
  // 2 : Sweep and prune , the default 
  // 3 : dynamic bounding volume tree
  world = new OIMO.World(1 / 60, 1, 8);
  populate();
  setInterval(updateOimoPhysics, 1000 / 60);
}
function populate() {
  
  clearMesh();
  world.clear();
  bodys = [];
  //add ground

  OIMO.Body({size:[200, 40, 390], pos:[0, -30, 0], world:world});
  addStaticBox([200, 40, 390], [0, -30, 0], [0, 0, 0]);
  // addStaticBox([400, 40, 400], [0,-60,0], [0,0,0]);
  //add object
  var x, y, z, w, h, d;
  var i = MAX_SPHERES;
  while (i--) {

    x = -100 + Math.random() * 200;
    z = -100 + Math.random() * 200;
    y = 100 + Math.random() * 1000;
    w = 4 + Math.random() * 4;
    h = 10 + Math.random() * 10;
    d = 10 + Math.random() * 10;
     
    bodys[i] = new OIMO.Body({type:'sphere', size:[w * 0.5], pos:[x, y, z], move:true, world:world});
    meshs[i] = new THREE.Mesh(geos.sphere, new THREE.MeshBasicMaterial({wireframe: true, color: getRandomColor()}));
    meshs[i].scale.set(w * 0.5, w * 0.5, w * 0.5);

    // meshs[i].castShadow = true;
    // meshs[i].receiveShadow = true;
    scene.add(meshs[i]);
  }
  gravity(-10);
}

function getRandomColor() {
  /*ignore jslint start*/
  return '#' + ((1 << 24) * Math.random() | 0).toString(16);
  /*ignore jslint end*/
}
function updateOimoPhysics() {
  world.step();
  var x, y, z;
  var i = bodys.length;
  var mesh;
  var body; 
  while (i--) {
    body = bodys[i].body;
    mesh = meshs[i];
    mesh.position.copy(body.getPosition());
    mesh.quaternion.copy(body.getQuaternion());
   
    if (mesh.position.y < -100) {
      x = -100 + Math.random() * 200;
      z = -100 + Math.random() * 200;
      y = 100 + Math.random() * 1000;
      body.resetPosition(x, y, z);
    }
  }
}
function gravity(g) {
  world.gravity = new OIMO.Vec3(0, g, 0);
}

