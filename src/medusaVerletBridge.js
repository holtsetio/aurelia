import * as THREE from "three/webgpu";
import { Fn, instanceIndex, uniform, If, uniformArray, abs, instancedArray } from "three/tsl";
import {getBellPosition} from "./medusaBellFormula";

export class MedusaVerletBridge {
    physics = null;

    medusa = null;

    isBaked = false;

    vertices = [];

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
        this.vertices.push({ id, medusaId, zenith, azimuth, isBottom, offset, directionalOffset, fixed });
    }

    async bake() {
        this.medusaCount = this.medusae.length;
        this.vertexCount = this.vertices.length;

        this.vertices = this.vertices.sort((x, y) => {
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
        this.fixedNum = this.vertices.findIndex(v => !v.fixed);
        this.medusaePtr = [];
        let ptr = this.fixedNum;
        for (let i = 0; i < this.medusaCount; i++) {
            const count = (i === this.medusaCount - 1 ? this.vertices.length : this.vertices.findIndex(v => !v.fixed && v.medusaId === i + 1)) - ptr;
            this.medusaePtr[i] = { ptr, count };
            ptr += count;
        }

        const idArray = new Uint32Array(this.vertexCount * 2); // x: vertex Id, y: medusa Id
        const paramsArray = new Float32Array(this.vertexCount * 3); // x: zenith, y: azimuth, z: isBottom
        const offsetArray = new Float32Array(this.vertexCount * 4); //xyz: offset, w: directionalOffset
        this.vertices.forEach((v, index) => {
            const { id, medusaId, zenith, azimuth, isBottom, offset, directionalOffset } = v;
            idArray[index * 2 + 0] = id;
            idArray[index * 2 + 1] = medusaId;
            paramsArray[index * 3 + 0] = zenith;
            paramsArray[index * 3 + 1] = azimuth;
            paramsArray[index * 3 + 2] = isBottom ? 1 : 0;
            offsetArray[index * 4 + 0] = offset.x;
            offsetArray[index * 4 + 1] = offset.y;
            offsetArray[index * 4 + 2] = offset.z;
            offsetArray[index * 4 + 3] = directionalOffset;
        });
        this.idData = instancedArray(idArray, "uvec2");
        this.paramsData = instancedArray(paramsArray, 'vec3');
        this.offsetData = instancedArray(offsetArray, 'vec4');

        this.medusaTransformData = uniformArray(new Array(this.medusaCount).fill(0).map(() => { return new THREE.Matrix4(); }));
        this.medusaPhaseData = uniformArray(new Array(this.medusaCount).fill(0));
        this.uniforms.vertexStart = uniform(0, "uint");
        this.uniforms.vertexCount = uniform(this.vertexCount, "uint");
        this.medusae.forEach((medusa, index) => {
            const matrix = medusa.transformationObject.matrix;
            this.medusaTransformData.array[index].copy(matrix);
        });


        console.time("compileBridge");
        this.updatePositionsKernel = Fn(()=>{
            const id = this.uniforms.vertexStart.add(instanceIndex);
            If(instanceIndex.lessThan(this.uniforms.vertexCount), () => {
                const vertexId = this.idData.element(id).x;
                const medusaId = this.idData.element(id).y;
                const offset = this.offsetData.element(id).xyz.toVar();
                const directionalOffset = this.offsetData.element(id).w;
                const params = this.paramsData.element(id);
                const medusaTransform = this.medusaTransformData.element(medusaId);
                const phase = this.medusaPhaseData.element(medusaId);
                const zenith = params.x;
                const azimuth = params.y;
                const bottomFactor = params.z;

                const position = getBellPosition(phase, zenith, azimuth, bottomFactor).toVar();

                If(abs(directionalOffset).greaterThan(0.0), () => {
                    const p1 = getBellPosition(phase, zenith.add(0.001), azimuth, bottomFactor);
                    const dir = p1.sub(position).normalize();
                    offset.assign(dir.mul(directionalOffset));
                });
                const result = medusaTransform.mul(position.add(offset)).xyz;
                this.physics.positionData.element(vertexId).xyz.assign(result);
            });
        })().compute(this.vertexCount);
        await this.updateAll();

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