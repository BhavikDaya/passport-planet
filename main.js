import * as THREE from 'https://esm.sh/three@0.160.1';
import { OrbitControls } from 'https://esm.sh/three@0.160.1/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'https://cdn.skypack.dev/gsap';
import { OBJLoader } from 'https://esm.sh/three@0.160.1/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls;
let targetBody = null;
let asteroidBelt = null;
let kuiperBelt = null;
let isFollowing = false;
let isPaused = false;
let trailToggle = false;
let speedModifier = 1;
let sunLight = null;
let cockpitMode =false;
let cockpitCamera = null;
let ship;
let shipVelocity = new THREE.Vector3();
let shipDirection = new THREE.Vector3();
let spaceMissionTarget = new THREE.Vector3();
let keys = {};
let cameraTransition = {
    isActive: false,
    startTime: null,
    duration: 6000,
    startPosition: new THREE.Vector3(),
    startTarget: new THREE.Vector3()

}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const shipScale = 0.3;

let celestialBodies = [];
let bodyData = [];

async function loadCelestialDB () {
    
        const response = await fetch('./celestialDB.json');
        bodyData = await response.json();
        init();
    
}

loadCelestialDB();

function init() {
        const fadeOverlay = document.createElement('div');
    fadeOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: black;
        z-index: 99999;
        opacity: 1;
        transition: opacity 0.5s ease-in-out;
        pointer-events: none;
    `;
    document.body.appendChild(fadeOverlay);
    
    setTimeout(() => {
        fadeOverlay.style.opacity = '0';
        setTimeout(() => fadeOverlay.remove(), 2000);
    }, 1000);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0000c); 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200000);
    camera.position.set(0, 25, 40); 

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('solarCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.addEventListener('click', onClick, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 2600;

    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
    document.addEventListener('click' || 'mousemove', () => {
        const backgroundMusic = new Audio('./sounds/background.mp3');
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.5;
        backgroundMusic.play();
    }, {once: true});
   
    const playPause = document.getElementById("playPause");
    playPause.addEventListener('click', () => {
        isPaused = !isPaused;
        playPause.textContent = isPaused ? 'Play ':'Pause';
    });

    document.getElementById('X').addEventListener('click', () => {
        document.getElementById('infoPane').classList.remove('visible');
    })

    const trailToggleButton = document.getElementById("trailToggle");
    trailToggleButton.addEventListener('click', () => {
        trailToggle = !trailToggle;
        trailToggleButton.textContent = trailToggle ? 'Trails On':'Trails Off';
        celestialBodies.forEach(({trail}) => {
            if (trail) trail.visible = !trailToggle;
        });
    });

    const cockpitButton = document.getElementById("cockpitButton");
    cockpitButton.addEventListener('click', () => {
        cockpitMode = !cockpitMode;
        cockpitButton.textContent = cockpitMode ? 'Exit cockpit':'Enter cockpit';
        controls.enabled = !cockpitMode;
        if (cockpitMode && !cockpitCamera) {
            createCockpitCamera();
        }
    });

    const speedSlider = document.getElementById("speedSlider");
    speedSlider.addEventListener('input', (e) => {
            speedModifier = 1;
            speedModifier = Math.pow(2, parseFloat(e.target.value));
            if (speedModifier >= 1){
            document.getElementById('speedDisplay').textContent = (speedModifier + '').substring(0, 1) + 'x';
            }
            else
            {
                document.getElementById('speedDisplay').textContent = (speedModifier + '').substring(0, 4) + 'x';
            }
    });

    const sidebar = document.getElementById('sidebar');
    const title = document.getElementById('sidebarTitle');
    title.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    })

    const ambientLight = new THREE.AmbientLight(0x333333, 7);
    scene.add(ambientLight);

    createShip();
    createStarField();

    bodyData.forEach(data => createCelestialBody(data));

    setTimeout(() => {
    celestialBodies.forEach(body => {
        const sbl = document.getElementById('sidebarList');
        const li = document.createElement('li');
        li.textContent = body.data.name.charAt(0).toUpperCase() + body.data.name.slice(1);
        li.style.cursor = 'pointer';
        li.style.padding = '8px 5px';
        li.style.borderBottom = '1px solid #444';

        li.addEventListener('mouseenter', () => li.style.backgroundColor = '#555');
        li.addEventListener('mouseleave', () => li.style.backgroundColor = 'transparent');

        li.addEventListener('click', () => {flyToObject(body);});
        sbl.appendChild(li);
    });
}, 2500);
   
    asteroidBelt = createBelts();
   
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    if (cockpitCamera) {
        cockpitCamera.aspect = window.innerWidth / window.innerHeight;
        cockpitCamera.updateProjectionMatrix;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateShipMovement (change) {
    shipDirection.set(0, 0, 0);
    if (keys['w']) shipDirection.z -= 0.1;
    if (keys['s']) shipDirection.z += 0.1;
    if (keys['a']) shipDirection.x -= 0.1;
    if (keys['d']) shipDirection.x += 0.1;
    if (keys['arrowup']) shipDirection.y += 0.00001;
    if (keys['arrowdown']) shipDirection.y -= 0.00001;
    if (keys['q']) ship.rotation.z += 0.02; 
    if (keys['e']) ship.rotation.z -= 0.02;
    if (keys['r']) ship.rotation.x += 0.02;
    if (keys['f']) ship.rotation.x -= 0.02; 
    if (keys['arrowleft']) {
        ship.rotation.y += 0.4;
    }
    if (keys['arrowright']) {
        ship.rotation.y -= 0.4;
    }

    shipDirection.normalize();
    shipVelocity.copy(shipDirection).multiplyScalar(10 * change);
    const move = shipVelocity.clone().applyQuaternion(ship.quaternion);
    ship.position.add(move);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const clock = new THREE.Clock();

function animate () {
    requestAnimationFrame(animate);
    const change = clock.getDelta(); 

    if (!isPaused) {
    celestialBodies.forEach(({mesh, pivot, data}) => {
        if (data.rotationSpeed) {
            mesh.rotation.y += data.rotationSpeed * speedModifier;
        }
        if(pivot && data.orbitSpeed) {
            pivot.rotation.y += data.orbitSpeed * speedModifier;
        }
        if (data.precessionSpeed) {
            mesh.rotation.y += data.precessionSpeed * speedModifier;
        }
    });
    asteroidBelt.asteroids.rotation.y += 0.0005 * speedModifier;
    asteroidBelt.kuiperBelt.rotation.y += 0.0005 * speedModifier;
    

    celestialBodies.forEach(({mesh, data}) =>{
        if (data.name == 'sun') {
            const corona = mesh.children.find(child => child instanceof THREE.Sprite);
            if (corona) {
                const scale = 15 + Math.sin(Date.now() * 0.002) * 1;
                corona.scale.set(scale, scale, 0.002);
            }
        }
        if (data.name == 'Mission'){
            spaceMissionTarget = data;
        }
    });
    
    celestialBodies.forEach(({mesh, data}) => {
    if (data.rings) {
        const ringMesh = mesh.children.find(child => child.geometry?.type == 'RingGeometry');
        if (ringMesh) ringMesh.rotation.z += 0.025 * speedModifier;
    }
    });
    
}

if (isFollowing && targetBody) {
    const targetPos = new THREE.Vector3();
    targetBody.mesh.getWorldPosition(targetPos);
    
    const matrixWorld = targetBody.pivot ? targetBody.pivot.matrixWorld : targetBody.mesh.matrixWorld;
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.extractRotation(matrixWorld);
    const scale = targetBody.data.size;
    const zoomFactor = 2;
    const localOffset = new THREE.Vector3(scale * zoomFactor, scale * zoomFactor * 0.6, scale * zoomFactor);
    const worldOffset = localOffset.clone().applyMatrix4(rotationMatrix); 
    const desiredCameraPos = targetPos.clone().add(worldOffset);

    if (cameraTransition.isActive) {
        const elapsed = performance.now() - cameraTransition.startTime;
        const progress = Math.min(elapsed / cameraTransition.duration, 1);
        
        const easedProgress = easeInOutCubic(progress);
        
        camera.position.lerpVectors(
            cameraTransition.startPosition, 
            desiredCameraPos, 
            easedProgress 
        );
        controls.target.lerpVectors(
            cameraTransition.startTarget,
            targetPos,
            easedProgress  
        );
        
        if (progress >= 1) {
            cameraTransition.isActive = false;
        }
    } else {
        camera.position.lerp(desiredCameraPos, 0.1);
        controls.target.lerp(targetPos, 0.1);
    }
}
    if (cockpitMode) {
        updateShipMovement(change);
        controls.enabled = false;
        document.getElementById('cockpitControls').classList.add('visible');
        document.getElementById('infoPane').classList.remove('visible');
        setTimeout(() => {
        document.getElementById("sidebar").style.display = 'none';
        }, 10);
         const shake = 0.00002;
         cockpitCamera.position.x = cockpitCamera.position.x + ((Math.sin(Date.now() * 0.01) * shake));
         cockpitCamera.position.y = cockpitCamera.position.y + (Math.cos(Date.now() * 0.015) * shake * 0.5);
        
        renderer.render(scene, cockpitCamera);
        return;
    }
    else
    {
        document.getElementById("sidebar").style.display = 'block';
        document.getElementById('cockpitControls').classList.remove('visible');
    }

    controls.update();
    renderer.render(scene, camera);
}
function onClick (event) {
    speedModifier = 1;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    
    setTimeout(() => {
        infoPane.classList.remove('visible');
    }, 10);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(
        celestialBodies.map(obj => obj.mesh), true
    );
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        clickedObject.material.color.set(0xFF0000);
        setTimeout(()=> {
        clickedObject.material.color.set(0xFFFFFF);
        }, 50);

        targetBody = celestialBodies.find(obj => obj.mesh == clickedObject);

        if (targetBody) {
            flyToObject(targetBody);
        }
    } 
    else
    {
        const infoPane = document.getElementById("infoPane");
        infoPane.style.display = 'none';
        targetBody = null;
        isFollowing = false;
        cameraTransition.isActive = false;
    }
    
}

function createCelestialBody(data, parentGroup = scene) {
    const texture = new THREE.TextureLoader().load(data.texture);
    const geometry = new THREE.SphereGeometry(data.size, 32, 32);
    const isSun = data.name.toLowerCase() === 'sun';
    const material = isSun
    ? new THREE.MeshBasicMaterial({ map: texture })
    : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.1, metalness: 0 });
    const mesh = new THREE.Mesh(geometry, material);

    

    if (isSun) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const light = new THREE.PointLight(0xffffff, 2, 0, 0.05);
    light.position.copy(mesh.position);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 200000;

    scene.add(light);
    scene.add(mesh);

    sunLight = { light, mesh };
} else {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    }
    if (data.axialTilt) {
        mesh.rotation.z = data.axialTilt;
        mesh.rotation.y += data.precessionSpeed;
    }

    const orbitalPlane = new THREE.Group();
    const pivot = new THREE.Group();

    if (data.isSpaceMissionObject) {
        const loader = new OBJLoader();
        loader.load(data.texture, obj => {
            const spaceObject = obj;
        const downSize = data.size / 1000;
        spaceObject.scale.set(downSize, downSize, downSize);

        const orbitalPlane = new THREE.Group();
        const pivot = new THREE.Group();

        const offset = data.orbitOffset;
        orbitalPlane.position.set(offset.x, offset.y, offset.z);

        if (data.orbitalTilt) orbitalPlane.rotation.x = data.orbitalTilt;

        spaceObject.position.x = data.distance;

        pivot.add(spaceObject);
        orbitalPlane.add(pivot);
        parentGroup.add(orbitalPlane);
        
        celestialBodies.push({ mesh: spaceObject, pivot, orbitalPlane, data });
        
        });
        return;
    }

    if (data.orbitalTilt) {
        orbitalPlane.rotation.x = data.orbitalTilt;
    }
    orbitalPlane.add(pivot);

    if (data.distance != undefined) {
        mesh.position.x = data.distance;
        pivot.add(mesh);
        parentGroup.add(orbitalPlane);
    }
    else
    {
        parentGroup.add(mesh);
    }

    if (data.corona) {
        const corona = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: new THREE.TextureLoader().load('./images/corona.png'),
                color: 0xFFCC66,
                opacity: 0.6,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: false,
                alphaTest: 0.1
            })
        );
        corona.scale.set(15, 15, 0.002);
        mesh.add(corona);
    }
    if (data.atmosphere) {
        const atmosphere = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: new THREE.TextureLoader().load(data.atmosphere),
                opacity: 0.4,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: false,
                alphaTest: 0.001
            })
        );
        atmosphere.scale.set(data.size+2, data.size+2, 1);
        mesh.add(atmosphere);
    }

    if (data.trail && data.distance != undefined) {
        const trailGeometry = new THREE.RingGeometry(data.distance - 0.04, data.distance + 0.04, 128);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0xADD8E6, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        trail.rotation.x = Math.PI / 2;
        orbitalPlane.add(trail);
        celestialBodies[celestialBodies.length - 1].trail = trail;
    }

    if (data.moons && Array.isArray(data.moons) && data.moons.name != 'ISS') {
        data.moons.forEach(moonData => createCelestialBody(moonData, mesh));
    }

    if (data.rings) {
        const ringsTexture = new THREE.TextureLoader().load(data.rings.texture);
        const ringsGeometry = new THREE.RingGeometry(data.rings.innerRadius, data.rings.outerRadius, 64);
        const ringsMaterial = new THREE.MeshBasicMaterial({
            map: ringsTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
        });
        const ringsMesh = new THREE.Mesh(ringsGeometry, ringsMaterial);
        ringsMesh.rotation.x = Math.PI / 2;
        ringsMesh.rotation.z = data.rings.tilt || 0;
        mesh.add(ringsMesh);
    }
    
    celestialBodies.push({mesh, pivot, data});
    return mesh;
}

function createBelts(numBeltObjects = 1500, innerRadius = 32, outerRadius = 45, kuiperInnerRadius = 460, kuiperOuterRadius = 800) {
    const size = 0.05;
    const kuiperSize = 0.09;
    const geometry = new THREE.SphereGeometry(size, 3, 3);
    const kuiperGeometry = new THREE.SphereGeometry(kuiperSize, 3, 3);
    const material = new THREE.MeshBasicMaterial({color: 0x86775f});
    const kuiperMaterial = new THREE.MeshBasicMaterial({color: 0xBDDEEC});
    const asteroids = new THREE.InstancedMesh(geometry, material, numBeltObjects);
    const kuiperBelt = new THREE.InstancedMesh(kuiperGeometry, kuiperMaterial, numBeltObjects);

    const temp = new THREE.Object3D();

    for (let i = 0; i < numBeltObjects; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
        const kuiperRadius = kuiperInnerRadius + Math.random() * (kuiperOuterRadius - kuiperInnerRadius);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 3;

        temp.position.set(x, y, z);
        temp.rotation.set(Math.random(), Math.random(), Math.random());
        temp.updateMatrix();
        asteroids.setMatrixAt(i, temp.matrix);

        const kuiperX = Math.cos(angle) * kuiperRadius;
        const kuiperZ = Math.sin(angle) * kuiperRadius;
        const kuiperY = (Math.random() - 0.5) * 10;

        temp.position.set(kuiperX, kuiperY, kuiperZ);

        temp.rotation.set(Math.random(), Math.random(), Math.random());
        temp.updateMatrix();
        kuiperBelt.setMatrixAt(i, temp.matrix);
    }
    asteroids.instanceMatrix.needsUpdate = true;
    kuiperBelt.instanceMatrix.needsUpdate = true;
    scene.add(asteroids);
    scene.add(kuiperBelt);
    return {asteroids, kuiperBelt}; 
}

function createStarField (count = 500, radius = 2800) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = radius;

        const x =  r * Math.sin(phi) * Math.cos(theta);
        const y =  r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions.push(x, y, z);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 15,
        sizeAttenuation: true
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function flyToObject(listMesh) {
    targetBody = listMesh;
    isFollowing = true;

    cameraTransition.isActive = true;
    cameraTransition.startTime = performance.now();
    cameraTransition.startPosition.copy(camera.position);
    cameraTransition.startTarget.copy(controls.target);

    if (listMesh.data.status == 'Moon') {
        document.getElementById("speedSlider").hidden = true;
        document.getElementById('speedDisplay').hidden = true;
        speedModifier = 0.3;
    }
    else
    {
        document.getElementById("speedSlider").hidden = false;
        document.getElementById('speedDisplay').hidden = false;
        speedModifier = 1;
    }
    if (!listMesh.data.isSpaceMissionObject) {
        showInfoPane(listMesh);
    }
    else
    {
        infoPane.classList.remove('visible');
    }
}

function showInfoPane (body) {
    const infoPane = document.getElementById("infoPane");
    const objectInfo  = body.data;
    const infoTitle = document.getElementById("infoTitle");
    const infoStatus = document.getElementById("status");
    const infoSize = document.getElementById("infoSize");
    const infoDistance = document.getElementById("infoDistance");
    const infoMoonDistance = document.getElementById("infoMoonDistance");
    const infoOrbit = document.getElementById("orbit");
    const infoDay = document.getElementById("day");
    const infoTemp = document.getElementById("temp");
    const infoAtmos = document.getElementById("atmosComp");
    const infoMoon = document.getElementById("moonNum");
    const infoFact = document.getElementById("funFact");
    setTimeout(() => {
    infoPane.classList.add("visible");
    }, 10); 

    infoTitle.textContent = objectInfo.name.charAt(0).toUpperCase() + objectInfo.name.slice(1);
    infoStatus.textContent = objectInfo.status;
    infoSize.textContent = 'Diameter: ' + objectInfo.diameter + ' km';
    if(objectInfo.distanceFromSun != undefined) {
        infoDistance.textContent = 'Distance from sun: ' + objectInfo.distanceFromSun + ' million km';
        infoDistance.style.display = 'block';
    }
    else
    {
        infoDistance.style.display = 'none';
    }
    if (objectInfo.distanceFromPlanet != undefined) {
        infoMoonDistance.textContent = 'Distance from planet: ' + objectInfo.distanceFromPlanet + ' million km';
    }
    else
    {
        infoMoonDistance.style.display = 'none';
    }
    if (objectInfo.orbit) {
        infoOrbit.textContent = 'Orbital period: ' + objectInfo.orbit + ' earth days';
    }
    else
    {
        infoOrbit.textContent = '';
    }
    infoDay.textContent = 'Rotational period: ' + objectInfo.day;
    infoTemp.textContent = 'Temperatures: ' + objectInfo.temp;
    infoAtmos.textContent = 'Atmosphere: ' + objectInfo.atmosComp;
    if (objectInfo.moons != undefined || objectInfo.moonNum != null) {
        infoMoon.textContent = 'Moons: ' + objectInfo.moonNum;
    }
    else
    {
        infoMoon.textContent = '';
    }
    infoFact.textContent = 'Fun fact: ' + objectInfo.funFact;

    infoPane.style.display = 'block';
}

function createShip() {
    const shipGroup = new THREE.Group(); 

    const geom = new THREE.ConeGeometry(0.2, 0.6, 8);
    const mater = new THREE.MeshBasicMaterial({color: 0xFFFFFF});
    mater.side = THREE.DoubleSide;
    const placeholderShipMesh = new THREE.Mesh(geom, mater); 
    placeholderShipMesh.rotation.x = Math.PI / 2; 
    shipGroup.add(placeholderShipMesh); 

    ship = shipGroup;
    scene.add(ship); 

    const loader = new OBJLoader();

    loader.load(
        './images/spaceship.obj', 
        function (obj) {

            const loadedRocketModel = obj;

            loadedRocketModel.rotation.y = Math.PI;
            loadedRocketModel.scale.set(0.005, 0.005, 0.005);
            loadedRocketModel.position.set(0, 0, 0); 

            shipGroup.remove(placeholderShipMesh);
            
            shipGroup.add(loadedRocketModel);

            
            console.log("Rocket .obj loaded and successfully integrated into shipGroup!");
        },
        function (xhr) {
            console.log('rocket.obj ' + (xhr.loaded / xhr.total * 100).toFixed(0) + '% loaded');
        },
        function (error) {
            console.error('An error occurred loading rocket.obj:', error);
        }
    );

}


function createCockpitCamera () {
    cockpitCamera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 200000);
    cockpitCamera.position.set(0, 0.01, 0.1);
    ship.add(cockpitCamera);
}

