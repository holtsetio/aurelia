import * as THREE from "three/webgpu";
import {pass, mrt, output, float, vec4, Fn, clamp, vec3} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

import { Lights } from "./lights";
import { conf } from "./conf";
import { Info } from "./info";
import { VerletPhysics } from "./physics/verletPhysics";
import { VertexVisualizer } from "./physics/vertexVisualizer";
import {SpringVisualizer} from "./physics/springVisualizer";
import {Medusa} from "./medusa";
import {MedusaVerletBridge} from "./medusaVerletBridge";
import {Background} from "./background";
import {Plankton} from "./plankton";
import {Godrays} from "./godrays";

class App {
    renderer = null;

    camera = null;

    scene = null;

    controls = null;

    lights = null;

    stats = null;

    physics = null;

    vertexVisualizer = null;

    springVisualizer = null;

    frameNum = 0;

    constructor(renderer){
        console.time("firstFrame");
        this.renderer = renderer;
    }

    async init(progressCallback) {
        conf.init();
        this.info = new Info();
        this.renderer.init();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 30);
        this.camera.position.set(0, 0, 15);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateProjectionMatrix();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.minPolarAngle = Math.PI * 0.25;
        this.controls.maxPolarAngle = Math.PI * 0.75;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 25;
        this.controls.enablePan = false;

        await progressCallback(0.1);

        this.physics = new VerletPhysics(this.renderer);

        await progressCallback(0.3);

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        this.background = new Background(this.renderer);
        this.scene.environmentNode = Background.envFunction;
        this.scene.environmentIntensity = 0.3;
        this.scene.backgroundNode = Background.fogFunction;

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        await progressCallback(0.4);

        await Medusa.initStatic(this.physics);

        await progressCallback(0.5);

        this.bridge = new MedusaVerletBridge(this.physics);

        for (let i=0; i<10; i++) {
            const medusa = new Medusa(this.renderer, this.physics, this.bridge);
            this.scene.add(medusa.object);
            this.physics.addObject(medusa);
        }
        this.physics.addObject(this.bridge);

        await progressCallback(0.6);

        await this.physics.bake();

        await progressCallback(0.7);

        this.vertexVisualizer = new VertexVisualizer(this.physics);
        //this.scene.add(this.vertexVisualizer.object);
        this.springVisualizer = new SpringVisualizer(this.physics);
        this.scene.add(this.springVisualizer.object);

        await progressCallback(0.8);

        this.plankton = new Plankton();
        this.scene.add(this.plankton.object);

        await progressCallback(0.9);
        this.godrays = new Godrays(this.bridge);
        this.scene.add(this.godrays.object);

        const scenePass = pass(this.scene, this.camera);
        scenePass.setMRT( mrt( {
            output,
            bloomIntensity: float( 0 ) // default bloom intensity
        } ) );

        const outputPass = scenePass.getTextureNode();
        const bloomIntensityPass = scenePass.getTextureNode( 'bloomIntensity' );

        const bloomPass = bloom(Fn(() => {
            const bloomIntensity = bloomIntensityPass.r;
            const charge = bloomIntensityPass.g;
            const colorMask = vec3(1.0 - charge * 0.5, 1.0 - charge, 1.0);

            return vec4(outputPass.rgb * bloomIntensity * colorMask, 1);
        })());

        const postProcessing = new THREE.PostProcessing(this.renderer);
        postProcessing.outputColorTransform = false;
        postProcessing.outputNode = Fn(() => {
            const bloomIntensity = bloomIntensityPass.r;
            const charge = bloomIntensityPass.g;

            const bloomMask = (1.0 - clamp(bloomIntensity, 0, 1)) + charge;
            const finalBloom = bloomPass.rgb * clamp(bloomMask, 0, 1);
            return vec4(outputPass.rgb + finalBloom.rgb, 1.0).renderOutput();
        })();

        this.postProcessing = postProcessing;
        this.bloomPass = bloomPass;

        this.bloomPass.threshold.value = 0.001;
        this.bloomPass.strength.value = 0.4;
        this.bloomPass.radius.value = 0.8;

        this.raycaster = new THREE.Raycaster();
        this.renderer.domElement.addEventListener("mousemove", (event) => { this.onMouseMove(event); });


        await progressCallback(1.0, 100);
    }

    onMouseMove(event) {
        const pointer = new THREE.Vector2();
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(pointer, this.camera);
        this.physics.setMouseRay(this.raycaster.ray.origin, this.raycaster.ray.direction);
    }

    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    updatePointer() {
        this.bridge.medusae.forEach(medusa => {
            medusa.updatePointerInteraction(this.raycaster.ray);
        });
    }

    sortMedusae() {
        this.bridge.medusae.forEach(medusa => {
           medusa.distance = this.camera.position.distanceTo(medusa.transformationObject.position);
        });
        const sorted = [...this.bridge.medusae].sort((m1,m2) => m1.distance - m2.distance);
        let z = 10;
        for (let i = 0; i < sorted.length; i++) {
            const m = sorted[i];
            m.bell.geometryInside.object.renderOrder = z++;
            m.arms.object.renderOrder = z++;
            m.tentacles.object.renderOrder = z++;
            m.bell.geometryOutside.object.renderOrder = z++;
        }
    }

    async update(delta, elapsed) {
        conf.begin();
        const { runSimulation, showVerletSprings } = conf;
        this.springVisualizer.object.visible = showVerletSprings;

        conf.update();
        this.controls.update(delta);
        Medusa.updateStatic();

        this.background.update(elapsed);
        this.lights.update(elapsed);

        this.updatePointer();

        if (runSimulation) {
            await this.physics.update(delta, elapsed);
        }
        this.sortMedusae();

        //this.renderer.render(this.scene, this.camera);

        await this.postProcessing.renderAsync();

        if (this.frameNum === 0) {
            console.timeEnd("firstFrame");
        }
        this.frameNum++
        conf.end();
    }
}
export default App;