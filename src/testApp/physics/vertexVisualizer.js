import * as THREE from "three/webgpu";

export class VertexVisualizer {
    physics = null;
    object = null;
    count = 0;
    material = null;
    constructor(physics){
        this.physics = physics;
        this.count = physics.vertexCount;
        this.material = new THREE.SpriteNodeMaterial();
        this.material.positionNode = this.physics.positionData.attribute;
        this.object = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), this.material);
        this.object.count = this.count;
        this.object.frustumCulled = false;
    }
    update(interval, elapsed) {}
}