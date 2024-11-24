import * as THREE from "three/webgpu";
import { Fn, If, Loop, select, uint, instanceIndex } from "three/webgpu";

class WgpuBuffer {
    length = 0;
    name = "";
    wgputype = "";
    itemsize = 0;
    typeclass = null;
    array = null;
    buffer = null;
    storageObject = null;
    attributeObject = null;
    constructor(_length, _wgputype, _itemsize, _typeclass = Float32Array, _name = "", instanced = false) {
        this.length = _length;
        this.name = _name;
        this.wgputype = _wgputype;
        this.itemsize = _itemsize;
        this.typeclass = _typeclass;
        this.array = new this.typeclass(this.length * this.itemsize);
        if (instanced) {
            this.buffer = new THREE.StorageInstancedBufferAttribute(this.array, this.itemsize, this.typeclass);
        } else {
            this.buffer = new THREE.StorageBufferAttribute(this.array, this.itemsize, this.typeclass);
        }
        this.buffer.name = this.name;
    }
    async read(renderer) {
        return new this.typeclass(await renderer.getArrayBufferAsync(this.buffer));
    }
    get storage() {
        if (!this.storageObject) {
            this.storageObject = THREE.storage(this.buffer, this.wgputype, this.length);
        }
        return this.storageObject;
    }
    toReadOnly() {
        this.storage.toReadOnly();
    }
    toReadWrite() {
        this.storage.setAccess("storage");
    }
    get attribute() {
        if (!this.attributeObject) {
            this.attributeObject = this.storage.toAttribute();
        }
        return this.attributeObject;
    }
}
export class VerletPhysics {
    renderer = null;

    isBaked = false;

    vertexQueue = [];

    springQueue = [];

    benchmarks = [];

    constructor(renderer){
        this.renderer = renderer;
    }

    addVertex(x, y, z, fixed = false) {
        if (this.isBaked) {
            console.error("Can't add any more vertices!");
        }
        const id = this.vertexQueue.length;
        const value = { x, y, z, w: fixed ? 0 : 1 };
        const position = new THREE.Vector3(x, y, z);
        const springs = [];
        const vertex = { id, value, position, springs, fixed };
        this.vertexQueue.push(vertex);
        return vertex;
    }
    addSpring(vertex0, vertex1, stiffness, restLengthFactor = 1.0) {
        if (this.isBaked) {
            console.error("Can't add any more springs!");
        }
        const id = this.springQueue.length;
        vertex0.springs.push({ id, sign: 1 });
        vertex1.springs.push({ id, sign: -1 });
        this.springQueue.push({ id, vertex0, vertex1, stiffness, restLengthFactor });
        return id;
    }
    async bake() {
        this.vertexCount = this.vertexQueue.length;
        this.springCount = this.springQueue.length;
        console.log(this.vertexCount + " vertices");
        console.log(this.springCount + " springs");
        console.log(this.vertexQueue);

        this.positionData = new WgpuBuffer(this.vertexCount, 'vec4', 4, Float32Array, "position", true);
        this.forceData = new WgpuBuffer(this.vertexCount, 'vec3', 3, Float32Array, "force", true);
        this.influencerPtrData = new WgpuBuffer(this.vertexCount, 'uvec2', 2, Uint32Array, "influencerptr", true); // x: ptr, y: length
        this.influencerData = new WgpuBuffer(this.springCount * 2, 'int', 1, Int32Array, "influencer", true);
        //this.influencerSignData = new WgpuBuffer(this.springCount * 2, 'float', 1, Float32Array, "influencerSign", true);
        let influencerPtr = 0;
        this.vertexQueue.forEach((v)=> {
            const {id, value, springs, fixed} = v;
            this.positionData.array[id * 4 + 0] = value.x;
            this.positionData.array[id * 4 + 1] = value.y;
            this.positionData.array[id * 4 + 2] = value.z;
            this.positionData.array[id * 4 + 3] = value.w;

            this.influencerPtrData.array[id * 2 + 0] = influencerPtr;
            if (!fixed) {
                this.influencerPtrData.array[id * 2 + 1] = springs.length;
                springs.forEach(s => {
                    this.influencerData.array[influencerPtr] = (s.id+1) * s.sign;
                    //this.influencerData.array[influencerPtr * 2 + 1] = s.sign > 0 ? 1 : 0;
                    //this.influencerSignData.array[influencerPtr] = s.sign;
                    influencerPtr++;
                });
            }
        });
        this.influencerPtrData.toReadOnly();
        this.influencerData.toReadOnly();
        console.log(this.influencerPtrData.array);
        console.log(influencerPtr, this.influencerData.array);

        this.springVertexData = new WgpuBuffer(this.springCount, 'uvec2', 2, Uint32Array, "springVertex", true);
        this.springParamsData = new WgpuBuffer(this.springCount, 'vec2', 2, Float32Array, "springParams", true); // x: stiffness, y: restLength,
        this.springLengthFactorData = new WgpuBuffer(this.springCount, 'float', 1, Float32Array, "springLengthFactor", true); // restLengthFactor
        this.springForceData = new WgpuBuffer(this.springCount, 'vec3', 3, Float32Array, "springForce", true);
        this.springQueue.forEach((spring)=>{
            const { id, vertex0, vertex1, stiffness, restLengthFactor } = spring;
            this.springVertexData.array[id * 2 + 0] = vertex0.id;
            this.springVertexData.array[id * 2 + 1] = vertex1.id;
            this.springParamsData.array[id * 2 + 0] = stiffness;
            this.springParamsData.array[id * 2 + 1] = 0;
            this.springLengthFactorData.array[id] = restLengthFactor;
        });

        const initSpringLengths = Fn(()=>{
            const vertices = this.springVertexData.storage.element(instanceIndex);
            const v0 = this.positionData.storage.element(vertices.x).xyz;
            const v1 = this.positionData.storage.element(vertices.y).xyz;
            const params = this.springParamsData.storage.element(instanceIndex);
            const restLengthFactor = this.springLengthFactorData.storage.element(instanceIndex);
            const restLength = params.y;
            restLength.assign(v0.distance(v1).mul(restLengthFactor));
        })().compute(this.springCount);
        await this.renderer.computeAsync(initSpringLengths);

        this.springVertexData.toReadOnly();
        this.springParamsData.toReadOnly();
        this.springLengthFactorData.toReadOnly();

        this.computeSpringForces = Fn(()=>{
            const vertices = this.springVertexData.storage.element(instanceIndex);
            const v0 = this.positionData.storage.element(vertices.x).toVec3();
            const v1 = this.positionData.storage.element(vertices.y).toVec3();
            const params = this.springParamsData.storage.element(instanceIndex);
            const stiffness = params.x;
            const restLength = params.y;
            const delta = v1.sub(v0).toVar();
            const dist = delta.length().max(0.000001).toVar();
            const force = dist.sub(restLength).mul(stiffness).div(dist).mul(delta).mul(0.5);
            this.springForceData.storage.element(instanceIndex).assign(force);
        })().compute(this.springCount);

        this.computeVertexForces = Fn(()=>{
            const influencerPtr = this.influencerPtrData.storage.element(instanceIndex).toVar();
            const ptrStart = influencerPtr.x.toVar();
            const ptrEnd = ptrStart.add(influencerPtr.y).toVar();
            const force = this.forceData.storage.element(instanceIndex).toVar();
            force.mulAssign(0.997);
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const springPtr = this.influencerData.storage.element(i);
                //const springSign = this.influencerSignData.readOnly.element(i);
                const springForce = this.springForceData.storage.element(springPtr.abs().sub(1));
                const factor = select(springPtr.greaterThan(0), 1.0, -1.0);
                force.addAssign(springForce.mul(factor));
            });
            force.y.addAssign(-0.0002);
            this.forceData.storage.element(instanceIndex).assign(force);
        })().compute(this.vertexCount);

        this.computeAddForces = Fn(()=>{
            const position = this.positionData.storage.element(instanceIndex);
            If(position.w.greaterThan(0.5), ()=>{
                const force = this.forceData.storage.element(instanceIndex);
                position.addAssign(force);
            });
        })().compute(this.vertexCount);

        /*
        //this.resultData = new WgpuBufferInstanced(this.vertexCount, 'float', 1, Float32Array);
        //this.positionBuffer = test.buffer;
        //this.positionBufferStorage = test.storage;
        //this.positionBufferStorage = THREE.storage(this.positionBuffer, "vec3", this.vertexCount);


        //const resultBuffer = this.resultData.storage;
        const positionStorage = this.positionData.storage;

        const initPositions = THREE.Fn( () => {
            //const position = this.positionBufferStorage.element( THREE.instanceIndex );
            //const randX = THREE.hash( THREE.instanceIndex );
            //const randY = hash( instanceIndex.add( 2 ) );
            positionStorage.element(THREE.instanceIndex).x.assign(THREE.instanceIndex.toFloat().mul(0.1));
            //this.resultBufferStorage.element(0).addAssign(1.0);
            //resultBuffer.element(0).assign(THREE.instanceIndex);
            //position.x.addAssign(THREE.instanceIndex);
            //position.y = 0; // randY.mul( 10 );
            //position.z = 0;

        })().compute(100);
        await this.renderer.computeAsync(initPositions);
        const result = await this.positionData.read(this.renderer);
        //const result = new Float32Array(await this.renderer.getArrayBufferAsync(this.positionBuffer));
        console.log(result);
        //console.log(positionBuffer.toAttribute());
        */
        this.isBaked = true;
    }
    async update(interval, elapsed) {
        if (!this.isBaked) {
            console.error("Verlet system not yet baked!");
        }

        const start = performance.now();
        this.positionData.toReadWrite();
        for(let i = 0; i < 10; i++){
            await this.renderer.computeAsync(this.computeSpringForces);
            await this.renderer.computeAsync(this.computeVertexForces);
            await this.renderer.computeAsync(this.computeAddForces);
        }
        this.positionData.toReadOnly();

        /*
        const r3 = await this.positionData.read(this.renderer);
        const duration = performance.now() - start;
        this.benchmarks.push(duration);
        if (this.benchmarks.length >= 10) {
            let total = 0;
            this.benchmarks.forEach((b)=>{
                total += b;
            });
            total /= this.benchmarks.length;
            this.benchmarks = [];
            console.log(total + " ms");
        }*/
        /*console.log("Frame");
            const r1 = await this.springForceData.read(this.renderer);
            const r2 = await this.forceData.read(this.renderer);
            const r3 = await this.positionData.read(this.renderer);
            console.log(r1);
            console.log(r2);
            console.log(r3);*/
    }
}
