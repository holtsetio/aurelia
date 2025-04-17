import * as THREE from "three/webgpu";
import {Fn, If, Loop, select, uint, instanceIndex, uniform, instancedArray, float, distance, max} from "three/tsl";

export class VerletPhysics {
    renderer = null;

    isBaked = false;

    vertices = [];

    springs = [];

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
        const id = this.vertices.length;
        const value = { x, y, z, w: fixed ? 0 : 1 };
        const springs = [];
        const vertex = { id, value, springs, fixed };
        this.vertices.push(vertex);
        return vertex;
    }

    addSpring(vertex0, vertex1, stiffness, restLengthFactor = 1.0) {
        if (this.isBaked) {
            console.error("Can't add any more springs!");
        }
        const id = this.springs.length;
        vertex0.springs.push({ id, sign: 1 });
        vertex1.springs.push({ id, sign: -1 });
        this.springs.push({ id, vertex0, vertex1, stiffness, restLengthFactor });
        return id;
    }

    async bake() {
        this.vertexCount = this.vertices.length;
        this.springCount = this.springs.length;
        console.log(this.vertexCount + " vertices");
        console.log(this.springCount + " springs");

        this.uniforms.dampening = uniform(0.998);
        this.uniforms.camPos = uniform(new THREE.Vector3());
        this.uniforms.mouseRay = uniform(new THREE.Vector3());

        const positionArray = new Float32Array(this.vertexCount * 4);
        const influencerPtrArray = new Uint32Array(this.vertexCount * 2);
        const influencerArray = new Int32Array(this.springCount * 2);
        let influencerPtr = 0;
        this.vertices.forEach((v)=> {
            const {id, value, springs, fixed} = v;
            positionArray[id * 4 + 0] = value.x;
            positionArray[id * 4 + 1] = value.y;
            positionArray[id * 4 + 2] = value.z;
            positionArray[id * 4 + 3] = value.w;
            influencerPtrArray[id * 2 + 0] = influencerPtr;
            if (!fixed) {
                influencerPtrArray[id * 2 + 1] = springs.length;
                springs.forEach(s => {
                    influencerArray[influencerPtr] = (s.id+1) * s.sign;
                    influencerPtr++;
                });
            }
        });
        this.positionData = instancedArray(positionArray, "vec4");
        this.forceData = instancedArray(this.vertexCount, "vec3");
        this.influencerPtrData = instancedArray(influencerPtrArray, "uvec2");
        this.influencerData = instancedArray(influencerArray, "int");

        const springVertexArray = new Uint32Array(this.springCount * 2);
        const springParamsArray = new Float32Array(this.springCount * 3);
        this.springs.forEach((spring)=>{
            const { id, vertex0, vertex1, stiffness, restLengthFactor } = spring;
            springVertexArray[id * 2 + 0] = vertex0.id;
            springVertexArray[id * 2 + 1] = vertex1.id;
            springParamsArray[id * 3 + 0] = stiffness;
            springParamsArray[id * 3 + 1] = 0;
            springParamsArray[id * 3 + 2] = restLengthFactor;
        });
        this.springVertexData = instancedArray(springVertexArray, "uvec2");
        this.springParamsData = instancedArray(springParamsArray, "vec3");
        this.springForceData = instancedArray(this.springCount, 'vec3');

        for (let i=0; i<this.objects.length; i++){
            await this.objects[i].bake();
        }

        const initSpringLengths = Fn(()=>{
            const vertices = this.springVertexData.element(instanceIndex);
            const v0 = this.positionData.element(vertices.x).xyz;
            const v1 = this.positionData.element(vertices.y).xyz;
            const params = this.springParamsData.element(instanceIndex);
            const restLengthFactor = params.z;
            const restLength = params.y;
            restLength.assign(distance(v0, v1) * restLengthFactor);
        })().compute(this.springCount);
        await this.renderer.computeAsync(initSpringLengths);

        this.computeSpringForces = Fn(()=>{
            const vertices = this.springVertexData.element(instanceIndex);
            const v0 = this.positionData.element(vertices.x).toVec3();
            const v1 = this.positionData.element(vertices.y).toVec3();
            const params = this.springParamsData.element(instanceIndex);
            const stiffness = params.x;
            const restLength = params.y;
            const delta = (v1 - v0).toVar();
            const dist = delta.length().max(0.000001).toVar();
            const force = (dist - restLength) * stiffness * delta * 0.5 / dist;
            this.springForceData.element(instanceIndex).assign(force);
        })().compute(this.springCount);

        this.computeVertexForces = Fn(()=>{
            const influencerPtr = this.influencerPtrData.element(instanceIndex).toVar();
            const ptrStart = influencerPtr.x.toVar();
            const ptrEnd = ptrStart.add(influencerPtr.y).toVar();
            const force = this.forceData.element(instanceIndex).toVar();
            force.mulAssign(this.uniforms.dampening);
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const springPtr = this.influencerData.element(i);
                const springForce = this.springForceData.element(uint(springPtr.abs()) - uint(1));
                const factor = select(springPtr.greaterThan(0), 1.0, -1.0);
                force.addAssign(springForce * factor);
            });

            const position = this.positionData.element(instanceIndex).toVar();
            const projectedMousePos = this.uniforms.camPos + this.uniforms.mouseRay * distance(this.uniforms.camPos, position.xyz);
            const delta = (position.xyz - projectedMousePos).toVar();
            const deltaLength = delta.length();
            const mouseForce = max(0.0, 1.0 - 0.7 * deltaLength) * (delta / deltaLength) * 0.00002;
            force.addAssign(mouseForce);

            this.forceData.element(instanceIndex).assign(force);

            If(position.w.greaterThan(0.5), ()=>{
                //const force = this.forceData.buffer.element(instanceIndex);
                this.positionData.element(instanceIndex).addAssign(force);
            });
        })().compute(this.vertexCount);

        this.isBaked = true;
    }
    setMouseRay(origin, direction) {
        this.uniforms.camPos.value.copy(origin);
        this.uniforms.mouseRay.value.copy(direction);
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
        }
    }
}
