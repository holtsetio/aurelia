import * as THREE from "three/webgpu";
import { uniform } from "three/tsl";

import {noise2D, noise3D} from "./common/noise";

import {MedusaTentacles} from "./medusaTentacles";
import {MedusaBell} from "./medusaBell";
import {conf} from "./conf";
import {MedusaOralArms} from "./medusaOralArms";
import {MedusaBellGeometry} from "./medusaBellGeometry";
import {MedusaBellPattern} from "./medusaBellPattern";

export class Medusa {
    renderer = null;
    physics = null;
    object = null;
    bridge = null;
    medusaId = -1;
    noiseSeed = 0;
    time = 0;
    phase = 0;
    needsPositionUpdate = true;
    charge = 0;
    static uniforms = {};

    constructor(renderer, physics, bridge){
        this.renderer = renderer;
        this.physics = physics;
        this.object = new THREE.Object3D();
        this.transformationObject = new THREE.Object3D();
        this.object.add(this.transformationObject);

        this.time = Math.random() * 5;
        this.noiseSeed = Math.random() * 100.0;
        this.bridge = bridge;
        this.medusaId = this.bridge.registerMedusa(this);

        this.transformationObject.position.set((Math.random() - 0.5) * 10, (this.medusaId / 10 + Math.random() * 0.1 - 0.5) * 40, (Math.random() - 0.5) * 10);

        this.createBellGeometry();

        this.updatePosition(0,0);
    }

    createBellGeometry() {
        this.subdivisions = 40; //has to be even

        this.bell = new MedusaBell(this);
        this.tentacles = new MedusaTentacles(this);
        this.arms = new MedusaOralArms(this);

        this.bell.createGeometry();
        this.tentacles.createGeometry();
        this.arms.createGeometry();
        //this.gut.createGeometry();

        this.object.add(this.bell.object);
        this.object.add(this.tentacles.object);
        this.object.add(this.arms.object);
    }

    async bake() { }

    updatePosition(delta, elapsed) {
        const time = this.time * 0.1;
        const rotX = noise3D(this.noiseSeed, 13.37, time) * Math.PI * 0.2;
        const rotY = noise3D(this.noiseSeed, 12.37, time*0.1) * Math.PI * 0.4;
        const rotZ = noise3D(this.noiseSeed, 11.37, time) * Math.PI * 0.2;
        this.transformationObject.rotation.set(rotX,rotY,rotZ, "XZY");

        const speed = (1.0 + Math.sin(this.phase + 4.4) * 0.35 + this.charge * 1.0) * delta;

        const offset = new THREE.Vector3(0,speed,0).applyEuler(this.transformationObject.rotation);
        this.transformationObject.position.add(offset);
        if (this.transformationObject.position.y > 20) {
            this.transformationObject.position.set((Math.random() - 0.5) * 10, -25, (Math.random() - 0.5) * 10);
            this.needsPositionUpdate = true;
        }

        this.transformationObject.updateMatrix();
    }

    updatePointerInteraction(ray) {
        const dist = ray.distanceToPoint(this.transformationObject.position);
        this.charge += (1 - Math.min(Math.max(0, dist - 0.5), 1)) * 0.05;
        this.charge = Math.min(this.charge, 1.00);
        this.charge *= 0.95;
    }

    async update(delta, elapsed) {
        this.time += delta * (1.0 + noise2D(this.noiseSeed, elapsed*0.1) * 0.1 + this.charge * 0.5);
        this.phase = ((this.time * 0.2) % 1.0) * Math.PI * 2;
        this.updatePosition(delta, elapsed);
        //return await this.bridge.update();
    }


    static async initStatic(physics) {
        Medusa.uniforms.matrix = uniform(new THREE.Matrix4());
        Medusa.uniforms.phase = uniform(0);
        Medusa.uniforms.charge = uniform(0);

        MedusaBellPattern.createColorNode();
        MedusaBellGeometry.createMaterial(physics);
        MedusaTentacles.createMaterial(physics);
        MedusaOralArms.createMaterial(physics);

    }

    static setMouseRay(ray) { }

    static updateStatic() { }

}