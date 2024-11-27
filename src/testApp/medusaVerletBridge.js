import * as THREE from "three/webgpu";
import { Fn } from "three/tsl";
import { WgpuBuffer } from "./common/WgpuBuffer"

export class MedusaVerletBridge {
    physics = null;

    medusa = null;

    isBaked = false;

    vertexQueue = [];

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

    bake() {
        this.vertexQueue = this.vertexQueue.sort((x, y) => Number(y.fixed) - Number(x.fixed));
        this.fixedNum = this.vertexQueue.findIndex(v => !v.fixed);

        this.vertexCount = this.vertexQueue.length;
        this.vertexIdData = new WgpuBuffer(this.vertexCount, 'uint', 1, Uint32Array, "vertexId", true);
        this.paramsData = new WgpuBuffer(this.vertexCount, 'vec2', 2, Float32Array, "params", true); // x: zenith, y: azimuth
        this.offsetData = new WgpuBuffer(this.vertexCount, 'vec3', 3, Float32Array, "offset", true);

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

    update(uTime) {
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