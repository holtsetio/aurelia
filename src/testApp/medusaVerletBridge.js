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
        this.medusaCount = this.medusae.length;

        this.vertexQueue = this.vertexQueue.sort((x, y) => {
            if (x.fixed === y.fixed) {
                const id0 = x.medusaId;
                const id1 = y.medusaId;
                if (id0 < id1) { return -1; }
                else if (id0 > id1) { return 1; }
                return 0;
            }
            const f0 = Number(y.fixed);
            const f1 = Number(x.fixed);
            if (f0 < f1) { return -1; }
            else if (f0 > f1) { return 1; }
            return 0;
        });
        this.fixedNum = this.vertexQueue.findIndex(v => !v.fixed);
        this.medusaePtr = [];
        let ptr = this.fixedNum;
        for (let i = 0; i < this.medusaCount; i++) {
            const count = (i === this.medusaCount - 1 ? this.vertexQueue.length : this.vertexQueue.findIndex(v => !v.fixed && v.medusaId === i + 1)) - ptr;
            this.medusaePtr[i] = { ptr, count };
            ptr += count;
        }

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


        this.uniforms.vertexStart = uniform(0, "uint");
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
        this.updatePositionsKernel = Fn(()=>{
            const id = this.uniforms.vertexStart.add(instanceIndex);
            If(instanceIndex.lessThan(this.uniforms.vertexCount), () => {
                const medusaId = this.medusaIdData.buffer.element(id);
                const medusaTransform = this.medusaTransformData.element(medusaId);

                const phase = this.medusaPhaseData.element(medusaId);
                const vertexId = this.vertexIdData.buffer.element(id);
                const params = this.paramsData.buffer.element(id);
                const zenith = params.x;
                const azimuth = params.y;
                const bottomFactor = params.z;

                const position = getBellPosition(phase, zenith, azimuth, bottomFactor).toVar();

                const offset = this.offsetData.buffer.element(id).xyz.toVar();
                const directionalOffset = this.offsetData.buffer.element(id).w;
                If(abs(directionalOffset).greaterThan(0.0), () => {
                    const p1 = getBellPosition(phase, zenith.add(0.001), azimuth, bottomFactor);
                    const dir = p1.sub(position).normalize();
                    offset.assign(dir.mul(directionalOffset));
                });
                const result = medusaTransform.mul(position.add(offset)).xyz;
                this.physics.positionData.buffer.element(vertexId).xyz.assign(result);
            });
        })().compute(this.vertexCount);
        await this.updateAll();
        //console.timeEnd("compileBridge");

/*        const resetForcesKernel = Fn(()=>{
            const id = this.uniforms.vertexStart.add(instanceIndex);
            If(instanceIndex.lessThan(this.uniforms.vertexCount), () => {
                const vertexId = this.vertexIdData.buffer.element(id);
                this.physics.forceData.buffer.element(vertexId).xyz.assign(vec3(0,0,0));
            });
        })().compute(this.vertexCount);*/

        this.isBaked = true;
    }

    async _updatePositions(start, count) {
        this.uniforms.vertexStart.value = start;
        this.uniforms.vertexCount.value = count;
        this.updatePositionsKernel.count = count;
        this.updatePositionsKernel.updateDispatchCount();
        await this.physics.renderer.computeAsync(this.updatePositionsKernel);
    }
    async updateAll() {
        await this._updatePositions(0, this.vertexCount);
    }
    async updateAllFixed() {
        await this._updatePositions(0, this.fixedNum);
    }
    async updateMedusaById(id) {
        const { ptr, count } = this.medusaePtr[id];
        await this._updatePositions(ptr, count);
    }

    async update() {
        if (!this.isBaked) {
            console.error("Not baked yet!");
        }

        for (let i = 0; i<this.medusae.length; i++) {
            const medusa = this.medusae[i];
            const matrix = medusa.transformationObject.matrix;
            this.medusaTransformData.array[i].copy(matrix);
            this.medusaPhaseData.array[i] = medusa.phase;
            if (medusa.needsPositionUpdate) {
                await this.updateMedusaById(i);
                medusa.needsPositionUpdate = false;
            }
        }

        await this.updateAllFixed();
    }

}