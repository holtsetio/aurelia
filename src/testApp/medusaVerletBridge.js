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

    registerVertex(medusaId, vertex, zenith, azimuth, offset, directionalOffset, fixed) {
        if (this.isBaked) {
            console.error("Can't add any more vertices!");
        }
        const { id } = vertex;
        this.vertexQueue.push({ id, medusaId, zenith, azimuth, offset, directionalOffset, fixed });
    }

    async bake() {
        this.vertexQueue = this.vertexQueue.sort((x, y) => Number(y.fixed) - Number(x.fixed));
        this.fixedNum = this.vertexQueue.findIndex(v => !v.fixed);

        this.medusaCount = this.medusae.length;
        this.vertexCount = this.vertexQueue.length;
        this.vertexIdData = new WgpuBuffer(this.vertexCount, 'uint', 1, Uint32Array, "vertexId", true);
        this.medusaIdData = new WgpuBuffer(this.vertexCount, 'uint', 1, Uint32Array, "medusaId", true);
        this.paramsData = new WgpuBuffer(this.vertexCount, 'vec2', 2, Float32Array, "params", true); // x: zenith, y: azimuth
        this.offsetData = new WgpuBuffer(this.vertexCount, 'vec4', 4, Float32Array, "offset", true); //xyz: offset, w: directionalOffset
        this.medusaTransformData = uniformArray(new Array(this.medusaCount * 4).fill(0).map(() => { return new THREE.Vector4(); }));
        this.medusaTimeData = uniformArray(new Array(this.medusaCount).fill(0));

        this.medusae.forEach((medusa, index) => {
            const matrix = medusa.transformationObject.matrix;
            this.medusaTransformData.array[index*4+0].set(matrix.elements[0], matrix.elements[1], matrix.elements[2], matrix.elements[3]);
            this.medusaTransformData.array[index*4+1].set(matrix.elements[4], matrix.elements[5], matrix.elements[6], matrix.elements[7]);
            this.medusaTransformData.array[index*4+2].set(matrix.elements[8], matrix.elements[9], matrix.elements[10], matrix.elements[11]);
            this.medusaTransformData.array[index*4+3].set(matrix.elements[12], matrix.elements[13], matrix.elements[14], matrix.elements[15]);
        });



        //this.uniforms.matrix = uniform(this.medusa.transformationObject.matrix, "mat4");
        this.uniforms.vertexCount = uniform(this.vertexCount, "uint");

        this.vertexQueue.forEach((v, index) => {
            const { id, medusaId, zenith, azimuth, offset, directionalOffset } = v;
            this.vertexIdData.array[index] = id;
            this.medusaIdData.array[index] = medusaId;
            this.paramsData.array[index * 2 + 0] = zenith;
            this.paramsData.array[index * 2 + 1] = azimuth;
            this.offsetData.array[index * 4 + 0] = offset.x;
            this.offsetData.array[index * 4 + 1] = offset.y;
            this.offsetData.array[index * 4 + 2] = offset.z;
            this.offsetData.array[index * 4 + 3] = directionalOffset;

        });

        /*
        vec3 getBellPosition(float t, float angle) {
            float x, y, z;
            float phase = uTime * 3.14159 * 2.0;
            float yoffset = sin(3.0 + phase) * 0.5;
            phase -= mix(0.0, t * 0.95, t);
            phase += 3.14159 * 0.5;
            float xr = 1.3 + sin(0.0 + phase) * 0.3;
            float yr = 1.0; // + sin(2.0 + phase) * 0.2;
            float polarAngle = t * 3.14159 * (0.5 + sin(3.0 + phase) * 0.15 + sin(angle * 16.0) * 0.01);
            x = sin(polarAngle) * xr;
            y = cos(polarAngle) * yr;
            y += yoffset;

            z = cos(angle) * x;
            x = sin(angle) * x;
            return vec3(x,y,z);
        }*/

        console.time("compileBridge");
        this.updatePositions = Fn(()=>{
            If(instanceIndex.lessThan(this.uniforms.vertexCount), () => {
                const medusaId = this.medusaIdData.buffer.element(instanceIndex);
                const medusaPtr = medusaId.mul(4).toVar();
                const m0 = this.medusaTransformData.element(medusaPtr);
                const m1 = this.medusaTransformData.element(medusaPtr.add(1));
                const m2 = this.medusaTransformData.element(medusaPtr.add(2));
                const m3 = this.medusaTransformData.element(medusaPtr.add(3));
                const medusaTransform = mat4(m0,m1,m2,m3);

                const time = this.medusaTimeData.element(medusaId);
                const vertexId = this.vertexIdData.buffer.element(instanceIndex);
                const params = this.paramsData.buffer.element(instanceIndex);

                const position = getBellPosition(time, params.x, params.y).toVar();

                const offset = this.offsetData.buffer.element(instanceIndex).xyz.toVar();
                const directionalOffset = this.offsetData.buffer.element(instanceIndex).w;
                If(abs(directionalOffset).greaterThan(0.0), () => {
                    const p1 = getBellPosition(time, params.x.add(0.001), params.y);
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
        /*
        const { dimension } = this.physics
        this.material = new RawShaderMaterial({
            uniforms: {
                uDimensions: { type: 'v2', value: new Vector2(dimension, dimension) },
                uMatrix: {  type: 'm4', value: new Matrix4() },
                uTime: { value: 0 },
            },
            fragmentShader: fragShader,
            vertexShader: vertShader,
            depthWrite: false,
            depthTest: false,
            blending: CustomBlending,
            blendEquation: AddEquation, //default
            blendSrc: OneFactor,
            blendDst: ZeroFactor,
            name: 'medusaVerletBridge',
        });


        this.vertexCount = this.vertexQueue.length;

        this.indexBufferArray = new Uint16Array(this.vertexCount * 2);
        this.azimuthBufferArray = new Float32Array(this.vertexCount);
        this.radiusBufferArray = new Float32Array(this.vertexCount);
        this.offsetBufferArray = new Float32Array(this.vertexCount * 3);
        this.fixedBufferArray = new Float32Array(this.vertexCount);

        this.vertexQueue.forEach((v, index) => {
            const { id, azimuth, radius, offset, fixed } = v;
            const ptr = this.physics.getVertexPtr(id);
            this.indexBufferArray[index * 2 + 0] = ptr.x;
            this.indexBufferArray[index * 2 + 1] = ptr.y;
            this.azimuthBufferArray[index] = azimuth;
            this.radiusBufferArray[index] = radius;
            this.offsetBufferArray[index * 3 + 0] = offset.x;
            this.offsetBufferArray[index * 3 + 1] = offset.y;
            this.offsetBufferArray[index * 3 + 2] = offset.z;
            this.fixedBufferArray[index] = fixed ? 0 : 1;

        });

        this.indexBuffer = new InstancedBufferAttribute(this.indexBufferArray, 2, false);
        this.azimuthBuffer = new InstancedBufferAttribute(this.azimuthBufferArray, 1, false);
        this.radiusBuffer = new InstancedBufferAttribute(this.radiusBufferArray, 1, false);
        this.offsetBuffer = new InstancedBufferAttribute(this.offsetBufferArray, 3, false);
        this.fixedBuffer = new InstancedBufferAttribute(this.fixedBufferArray, 1, false);
        this.positionBuffer = new BufferAttribute(new Float32Array(3), 3, false);

        const geometry = new InstancedBufferGeometry();
        geometry.setAttribute( 'position', this.positionBuffer);
        geometry.setAttribute( 'index', this.indexBuffer);
        geometry.setAttribute( 'azimuth', this.azimuthBuffer);
        geometry.setAttribute( 'radius', this.radiusBuffer);
        geometry.setAttribute( 'offset', this.offsetBuffer);
        geometry.setAttribute( 'fourthValue', this.fixedBuffer);
        this.object = new Points(geometry, this.material);
        this.object.position.setX(2);
        this.object.frustumCulled = false;
        this.object.geometry.instanceCount = this.vertexCount;

        this.camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 2, 200000);
        this.camera.position.set(0,0,10000);

        this.update(0);
         */
    }

    async update() {
        if (!this.isBaked) {
            console.error("Not baked yet!");
        }
        const { renderer } = this.physics;

        this.medusae.forEach((medusa, index) => {
            const matrix = medusa.transformationObject.matrix;
            this.medusaTransformData.array[index*4+0].set(matrix.elements[0], matrix.elements[1], matrix.elements[2], matrix.elements[3]);
            this.medusaTransformData.array[index*4+1].set(matrix.elements[4], matrix.elements[5], matrix.elements[6], matrix.elements[7]);
            this.medusaTransformData.array[index*4+2].set(matrix.elements[8], matrix.elements[9], matrix.elements[10], matrix.elements[11]);
            this.medusaTransformData.array[index*4+3].set(matrix.elements[12], matrix.elements[13], matrix.elements[14], matrix.elements[15]);
            this.medusaTimeData.array[index] = medusa.time;
        });
       // this.uniforms.matrix.value = this.medusa.transformationObject.matrix;

        await renderer.computeAsync(this.updatePositions);

        // only set vertexCount to fixedNum after first frame!
        this.uniforms.vertexCount.value = this.fixedNum;
        this.updatePositions.count = this.fixedNum;
        this.updatePositions.updateDispatchCount();


        /*
        const { renderer, positionBuffer } = this.physics;
        this.material.uniforms.uTime.value = uTime;

        this.medusa.object.updateMatrix();
        this.material.uniforms.uMatrix.value.copy(this.medusa.object.matrix);

        const prevRenderTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(positionBuffer);
        renderer.autoClear = false;
        renderer.render(this.object, this.camera);
        renderer.autoClear = true;
        renderer.setRenderTarget(prevRenderTarget);

        if (this.object.geometry.instanceCount > this.fixedNum) {
            this.object.geometry.instanceCount = this.fixedNum;
        }*/
    }

}