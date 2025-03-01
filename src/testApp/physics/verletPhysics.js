import * as THREE from "three/webgpu";
import { Fn, If, Loop, select, uint, instanceIndex, uniform } from "three/tsl";
import {WgpuBuffer} from "../common/WgpuBuffer";

export class VerletPhysics {
    renderer = null;

    isBaked = false;

    vertexQueue = [];

    springQueue = [];

    benchmarks = [];

    uniforms = {};

    objects = [];

    time = 0;

    timeSinceLastStep = 0;

    constructor(renderer){
        this.renderer = renderer;
    }

    addObject(object) {
        this.objects.push(object);
    }

    addVertex(position, fixed = false) {
        if (this.isBaked) {
            console.error("Can't add any more vertices!");
        }
        const { x,y,z } = position;
        const id = this.vertexQueue.length;
        const value = { x, y, z, w: fixed ? 0 : 1 };
        const springs = [];
        const vertex = { id, value, springs, fixed };
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
        //console.log(this.vertexQueue);

        this.uniforms.dampening = uniform(0.998);

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

        console.time("bake/objects");
        for (let i=0; i<this.objects.length; i++){
            await this.objects[i].bake();
        }
        //console.timeEnd("bake/objects");

        const initSpringLengths = Fn(()=>{
            const vertices = this.springVertexData.buffer.element(instanceIndex);
            const v0 = this.positionData.buffer.element(vertices.x).xyz;
            const v1 = this.positionData.buffer.element(vertices.y).xyz;
            const params = this.springParamsData.buffer.element(instanceIndex);
            const restLengthFactor = this.springLengthFactorData.buffer.element(instanceIndex);
            const restLength = params.y;
            restLength.assign(v0.distance(v1).mul(restLengthFactor));
        })().compute(this.springCount);
        await this.renderer.computeAsync(initSpringLengths);

        this.computeSpringForces = Fn(()=>{
            const vertices = this.springVertexData.buffer.element(instanceIndex);
            const v0 = this.positionData.buffer.element(vertices.x).toVec3();
            const v1 = this.positionData.buffer.element(vertices.y).toVec3();
            const params = this.springParamsData.buffer.element(instanceIndex);
            const stiffness = params.x;
            const restLength = params.y;
            const delta = v1.sub(v0).toVar();
            const dist = delta.length().max(0.000001).toVar();
            const force = dist.sub(restLength).mul(stiffness).div(dist).mul(delta).mul(0.5);
            this.springForceData.buffer.element(instanceIndex).assign(force);
        })().compute(this.springCount);

        this.computeVertexForces = Fn(()=>{
            const influencerPtr = this.influencerPtrData.buffer.element(instanceIndex).toVar();
            const ptrStart = influencerPtr.x.toVar();
            const ptrEnd = ptrStart.add(influencerPtr.y).toVar();
            const force = this.forceData.buffer.element(instanceIndex).toVar();
            force.mulAssign(this.uniforms.dampening);
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const springPtr = this.influencerData.buffer.element(i);
                //const springSign = this.influencerSignData.readOnly.element(i);
                const springForce = this.springForceData.buffer.element(springPtr.abs().sub(1));
                const factor = select(springPtr.greaterThan(0), 1.0, -1.0);
                force.addAssign(springForce.mul(factor));
            });
            //force.y.addAssign(-0.0002);
            this.forceData.buffer.element(instanceIndex).assign(force);
        })().compute(this.vertexCount);

        this.computeAddForces = Fn(()=>{
            const position = this.positionData.buffer.element(instanceIndex);
            If(position.w.greaterThan(0.5), ()=>{
                const force = this.forceData.buffer.element(instanceIndex);
                position.addAssign(force);
            });
        })().compute(this.vertexCount);

        this.isBaked = true;
    }
    async update(interval, elapsed) {
        if (!this.isBaked) {
            console.error("Verlet system not yet baked!");
        }

        const stepsPerSecond = 360;
        const timePerStep = 1 / stepsPerSecond;
        interval = Math.max(Math.min(interval, 1/60), 0.0001);
        this.timeSinceLastStep += interval;

        while (this.timeSinceLastStep >= timePerStep) {
            this.time += timePerStep;
            this.timeSinceLastStep -= timePerStep;
            for (let i=0; i<this.objects.length; i++){
                await this.objects[i].update(timePerStep, this.time);
            }
            await this.renderer.computeAsync(this.computeSpringForces);
            await this.renderer.computeAsync(this.computeVertexForces);
            await this.renderer.computeAsync(this.computeAddForces);
        }

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
