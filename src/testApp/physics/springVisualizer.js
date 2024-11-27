import * as THREE from "three/webgpu";
import { Fn, select } from "three/webgpu";

export class SpringVisualizer {
    physics = null;
    object = null;
    count = 0;
    material = null;
    constructor(physics){
        this.physics = physics;
        this.count = physics.springCount;

        this.positionBuffer = new THREE.BufferAttribute(new Float32Array([0,0,0,1,0,0]), 3, false);
        this.vertexIndexBuffer = new THREE.StorageBufferAttribute(new Uint32Array([0,1]), 1, Uint32Array);
        this.vertexIndexAttribute = THREE.storage(this.vertexIndexBuffer, "int", 2).toAttribute();

        this.material = new THREE.LineBasicNodeMaterial();
        this.material.positionNode = Fn( () => {
            const vertices = this.physics.springVertexData.attribute;
            const ptr = select(this.vertexIndexAttribute.equal(0), vertices.x, vertices.y);
            return this.physics.positionData.storage.element(ptr).xyz;
        } )();

        this.geometry = new THREE.InstancedBufferGeometry();
        this.geometry.setAttribute("position", this.positionBuffer);
        this.geometry.instanceCount = this.count;

        this.object = new THREE.Line(this.geometry, this.material);
        this.object.frustumCulled = false;
    }
    update(interval, elapsed) {}
}