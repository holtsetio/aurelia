import * as THREE from "three/webgpu";
import {cos, float, Fn, instanceIndex, mix, sin, vec3, uniform, If } from "three/tsl";
import { WgpuBuffer } from "./common/WgpuBuffer"

export class MedusaVerletBridge {
    physics = null;

    medusa = null;

    isBaked = false;

    vertexQueue = [];

    uniforms = {};

    constructor(physics, medusa) {
        this.physics = physics;
        this.medusa = medusa;
    }

    registerVertex(vertex, zenith, azimuth, offset, fixed) {
        if (this.isBaked) {
            console.error("Can't add any more vertices!");
        }
        const { id } = vertex;
        this.vertexQueue.push({ id, zenith, azimuth, offset, fixed });
    }

    async bake() {
        this.vertexQueue = this.vertexQueue.sort((x, y) => Number(y.fixed) - Number(x.fixed));
        this.fixedNum = this.vertexQueue.findIndex(v => !v.fixed);

        this.vertexCount = this.vertexQueue.length;
        this.vertexIdData = new WgpuBuffer(this.vertexCount, 'uint', 1, Uint32Array, "vertexId", true);
        this.paramsData = new WgpuBuffer(this.vertexCount, 'vec2', 2, Float32Array, "params", true); // x: zenith, y: azimuth
        this.offsetData = new WgpuBuffer(this.vertexCount, 'vec3', 3, Float32Array, "offset", true);
        this.uniforms.matrix = uniform(this.medusa.object.matrix, "mat4");
        this.uniforms.vertexCount = uniform(this.vertexCount, "uint");

        this.vertexQueue.forEach((v, index) => {
            const { id, zenith, azimuth, offset } = v;
            this.vertexIdData.array[index] = id;
            this.paramsData.array[index * 2 + 0] = zenith;
            this.paramsData.array[index * 2 + 1] = azimuth;
            this.offsetData.array[index * 3 + 0] = offset.x;
            this.offsetData.array[index * 3 + 1] = offset.y;
            this.offsetData.array[index * 3 + 2] = offset.z;
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
        const getBellPosition = (t, angle) => {
            const phase = this.physics.uniforms.time.mul(0.2).mul(Math.PI*2).toVar();
            const yoffset = sin(phase.add(3.0)).mul(0.5);
            phase.subAssign(mix(0.0, t.mul(0.95), t));
            phase.addAssign(Math.PI * 0.5);
            const xr = sin(phase).mul(0.3).add(1.3);
            const yr = float(1.0);
            const polarAngle = sin(phase.add(3.0)).mul(0.15).add(0.5).mul(t).mul(Math.PI);
            const result = vec3(0).toVar();
            result.x.assign(sin(polarAngle).mul(xr));
            result.y.assign(cos(polarAngle).mul(yr).add(yoffset));
            result.z.assign(cos(angle).mul(result.x));
            result.x.assign(sin(angle).mul(result.x));
            return result;
        };

        this.updatePositions = Fn(()=>{
            If(instanceIndex.lessThan(this.uniforms.vertexCount), () => {
                const vertexId = this.vertexIdData.buffer.element(instanceIndex);
                const params = this.paramsData.buffer.element(instanceIndex);
                const offset = this.offsetData.buffer.element(instanceIndex);
                const result = this.uniforms.matrix.mul(getBellPosition(params.x, params.y).add(offset)).xyz;
                this.physics.positionData.buffer.element(vertexId).xyz.assign(result);
            });
        })().compute(this.vertexCount);
        await this.physics.renderer.computeAsync(this.updatePositions);

        this.uniforms.vertexCount.value = this.fixedNum;
        this.updatePositions.count = this.fixedNum;
        this.updatePositions.updateDispatchCount();

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

        this.uniforms.matrix.value = this.medusa.object.matrix;

        await renderer.computeAsync(this.updatePositions);
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