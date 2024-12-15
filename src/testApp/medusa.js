import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    transformNormalToView,
    normalMap,
    texture,
    vec2,
    If,
    uniform,
    cos, sin
} from "three/tsl";

import {noise2D, noise3D} from "../testApp/common/noise";
import {getBellPosition} from "./medusaBellFormula";

import normalMapFile from '../assets/Alien_Muscle_001_NORM.jpg';
import colorMapFile from '../assets/Alien_Muscle_001_COLOR.jpg';
import {MedusaTentacles} from "./medusaTentacles";
import {MedusaBellMargin} from "./medusaBellMargin";
import {MedusaBell} from "./medusaBell";
import {MedusaGut} from "./medusaGut";
import {conf} from "./conf";

export class Medusa {
    renderer = null;
    physics = null;
    object = null;
    bridge = null;
    medusaId = -1;
    noiseSeed = 0;
    time = 0;
    static uniforms = {};

    constructor(renderer, physics, bridge){
        this.renderer = renderer;
        this.physics = physics;
        this.object = new THREE.Object3D();
        this.transformationObject = new THREE.Object3D();
        this.object.add(this.transformationObject);
        this.transformationObject.position.set(Math.random() * 10, 0, Math.random() * 10);

        this.time = Math.random() * 5;
        this.noiseSeed = Math.random() * 100.0;
        this.bridge = bridge;
        this.medusaId = this.bridge.registerMedusa(this);

        this.createBellGeometry();

        this.updatePosition(0,0);
    }

    createBellGeometry() {
        this.subdivisions = 40; //has to be even

        this.bell = new MedusaBell(this);
        this.bellMargin = new MedusaBellMargin(this);
        this.tentacles = new MedusaTentacles(this);
        this.gut = new MedusaGut(this);

        this.bell.createGeometry();
        this.bellMargin.createGeometry();
        this.tentacles.createGeometry();
        this.gut.createGeometry();


        this.transformationObject.add(this.gut.object);
        this.transformationObject.add(this.bell.object);
        this.object.add(this.bellMargin.object);
        this.object.add(this.tentacles.object);

        /*const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshPhysicalNodeMaterial({
            color: '#ff6600',
        }));
        this.transformationObject.add(ball); */
    }

    async bake() {
        //return await this.bridge.bake();
    }

    updatePosition(delta, elapsed) {
        const time = this.time * 0.1;
        const rotX = noise3D(this.noiseSeed, 13.37, time) * Math.PI * 0.2;
        const rotY = noise3D(this.noiseSeed, 12.37, time*0.1) * Math.PI * 0.4;
        const rotZ = noise3D(this.noiseSeed, 11.37, time) * Math.PI * 0.2;
        this.transformationObject.rotation.set(rotX,rotY,rotZ, "XZY");
        const offset = new THREE.Vector3(0,delta,0).applyEuler(this.transformationObject.rotation);
        this.transformationObject.position.add(offset);
        this.transformationObject.updateMatrix();
    }

    async update(delta, elapsed) {
        this.time += delta * (1.0 + noise2D(this.noiseSeed, elapsed) * 0.1);
        this.updatePosition(delta, elapsed);
        //return await this.bridge.update();
    }


    static colorMap;
    static normalMap;
    static aoMap;
    static async initStatic(physics) {
        const textureLoader = new THREE.TextureLoader();
        const loadTexture = (file) => {
            return new Promise(resolve => {
                textureLoader.load(file, texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    resolve(texture);
                });
            });
        }
        Medusa.normalMap = await loadTexture(normalMapFile);
        Medusa.colorMap = await loadTexture(colorMapFile);

        Medusa.uniforms.matrix = uniform(new THREE.Matrix4());
        Medusa.uniforms.time = uniform(0);
        Medusa.uniforms.normalMapScale = uniform(new THREE.Vector2());

        MedusaBell.createMaterial(physics);
        MedusaBellMargin.createMaterial(physics);
        MedusaTentacles.createMaterial(physics);
        MedusaGut.createMaterial(physics);
    }
    static updateStatic() {
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness, clearcoatColor, normalMapScale } = conf;
        const materials = [MedusaBell.material, MedusaBellMargin.material, MedusaTentacles.material];
        materials.forEach((material) => {
           material.roughness = roughness;
           material.metalness = metalness;
           material.transmission = transmission;
           material.color.setHex(color);
           material.iridescence = iridescence;
           material.iridescenceIOR = iridescenceIOR;
           material.clearcoat = clearcoat;
           material.clearcoatRoughness = clearcoatRoughness;
           //material.clearcoatColor.setHex(clearcoatColor);
        });
        Medusa.uniforms.normalMapScale.value.set(normalMapScale, -normalMapScale);
    }


}