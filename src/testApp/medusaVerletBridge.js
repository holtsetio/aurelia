import * as THREE from "three/webgpu";
import {cos, float, Fn, instanceIndex, mix, sin, vec3, uniform, If, uniformArray, mat4, abs} from "three/tsl";
import { WgpuBuffer } from "./common/WgpuBuffer"
import {getBellPosition} from "./medusaBellFormula";

export class MedusaVerletBridge {
    physics = null;

    medusa = null;

    isBaked = false;

    vertexQueue = [];

    uniforms = {};

    medusae = [];

    constructor(physics) {
        this.physics = physics;
    }

    registerMedusa(medusa) {
        const ptr = this.medusae.length;
        this.medusae[ptr] = medusa;
        return ptr;
    }

    registerVertex(medusaId, vertex, zenith, azimuth, isBottom, offset, directionalOffset, fixed) {
        if (this.isBaked) {
            console.error("Can't add any more vertices!");
        }
        const { id } = vertex;
        this.vertexQueue.push({ id, medusaId, zenith, azimuth, isBottom, offset, directionalOffset, fixed });
    }

    async bake() {
        this.vertexQueue = this.vertexQueue.sort((x, y) => Number(y.fixed) - Number(x.fixed));
        this.fixedNum = this.vertexQueue.findIndex(v => !v.fixed);

        this.medusaCount = this.medusae.length;
        this.vertexCount = this.vertexQueue.length;
        this.vertexIdData = new WgpuBuffer(this.vertexCount, 'uint', 1, Uint32Array, "vertexId", true);
        this.medusaIdData = new WgpuBuffer(this.vertexCount, 'uint', 1, Uint32Array, "medusaId", true);
        this.paramsData = new WgpuBuffer(this.vertexCount, 'vec3', 3, Float32Array, "params", true); // x: zenith, y: azimuth, z: isBottom
        this.offsetData = new WgpuBuffer(this.vertexCount, 'vec4', 4, Float32Array, "offset", true); //xyz: offset, w: directionalOffset
        this.medusaTransformData = uniformArray(new Array(this.medusaCount).fill(0).map(() => { return new THREE.Matrix4(); }));
        this.medusaPhaseData = uniformArray(new Array(this.medusaCount).fill(0));

        this.medusae.forEach((medusa, index) => {
            const matrix = medusa.transformationObject.matrix;
            this.medusaTransformData.array[index].copy(matrix);
        });


        this.uniforms.vertexCount = uniform(this.vertexCount, "uint");

        this.vertexQueue.forEach((v, index) => {
            const { id, medusaId, zenith, azimuth, isBottom, offset, directionalOffset } = v;
            this.vertexIdData.array[index] = id;
            this.medusaIdData.array[index] = medusaId;
            this.paramsData.array[index * 3 + 0] = zenith;
            this.paramsData.array[index * 3 + 1] = azimuth;
            this.paramsData.array[index * 3 + 2] = isBottom ? 1 : 0;
            this.offsetData.array[index * 4 + 0] = offset.x;
            this.offsetData.array[index * 4 + 1] = offset.y;
            this.offsetData.array[index * 4 + 2] = offset.z;
            this.offsetData.array[index * 4 + 3] = directionalOffset;

        });

        console.time("compileBridge");
        this.updatePositions = Fn(()=>{
            If(instanceIndex.lessThan(this.uniforms.vertexCount), () => {
                const medusaId = this.medusaIdData.buffer.element(instanceIndex);
                const medusaTransform = this.medusaTransformData.element(medusaId);

                const phase = this.medusaPhaseData.element(medusaId);
                const vertexId = this.vertexIdData.buffer.element(instanceIndex);
                const params = this.paramsData.buffer.element(instanceIndex);
                const zenith = params.x;
                const azimuth = params.y;
                const bottomFactor = params.z;

                const position = getBellPosition(phase, zenith, azimuth, bottomFactor).toVar();

                const offset = this.offsetData.buffer.element(instanceIndex).xyz.toVar();
                const directionalOffset = this.offsetData.buffer.element(instanceIndex).w;
                If(abs(directionalOffset).greaterThan(0.0), () => {
                    const p1 = getBellPosition(phase, zenith.add(0.001), azimuth, bottomFactor);
                    const dir = p1.sub(position).normalize();
                    offset.assign(dir.mul(directionalOffset));
                });
                const result = medusaTransform.mul(position.add(offset)).xyz;
                this.physics.positionData.buffer.element(vertexId).xyz.assign(result);
            });
        })().compute(this.vertexCount);
        await this.physics.renderer.computeAsync(this.updatePositions);
        console.timeEnd("compileBridge");

        this.isBaked = true;
    }

    async update() {
        if (!this.isBaked) {
            console.error("Not baked yet!");
        }
        const { renderer } = this.physics;

        this.medusae.forEach((medusa, index) => {
            const matrix = medusa.transformationObject.matrix;
            this.medusaTransformData.array[index].copy(matrix);
            this.medusaPhaseData.array[index] = medusa.phase;
        });
       // this.uniforms.matrix.value = this.medusa.transformationObject.matrix;

        await renderer.computeAsync(this.updatePositions);

        // only set vertexCount to fixedNum after first frame!
        this.uniforms.vertexCount.value = this.fixedNum;
        this.updatePositions.count = this.fixedNum;
        this.updatePositions.updateDispatchCount();
    }

}