import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    transformNormalToView,
    int, mrt,
    If, float, vec4, cameraPosition, cross, smoothstep
} from "three/tsl";

import {Medusa} from "./medusa";
import {Background} from "./background";
import {getBellPosition} from "./medusaBellFormula";
import {conf} from "./conf";
import {MedusaBellPattern} from "./medusaBellPattern";

export class MedusaBellGeometry {
    object = null;

    static uniforms = {};

    constructor(medusa, isOuterSide = false) {
        this.medusa = medusa;
        this.isOuterSide = isOuterSide;

        this.positionArray = [];
        this.vertexIdArray = [];
        this.zenithArray = [];
        this.azimuthArray = [];
        this.bottomFactorArray = [];
        this.sideArray = [];
        this.uvArray = [];
        this.indices = [];
        this.vertexCount = 0;
    }

    static createMaterial(physics) {
        MedusaBellGeometry.materialOuter = this._createMaterial(physics, true);
        MedusaBellGeometry.materialInner = this._createMaterial(physics, false);
    }

    static _createMaterial(physics, isOuterSide) {
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness } = conf;
        const material = new THREE.MeshPhysicalNodeMaterial({
            roughness, metalness, transmission, iridescence, iridescenceIOR,
            opacity:0.7,
            transparent: true,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        const vEmissive = varying(float(0), "v_MedusaEmissive");

        material.positionNode = Fn(() => {
            const tangent = vec3().toVar();
            const bitangent = vec3().toVar();
            const position = vec3().toVar();
            const normal = vec3().toVar();
            const zenith = attribute('zenith');
            const azimuth = attribute('azimuth');
            //const bottomFactor = attribute('bottomFactor');
            const side = attribute('sideData');
            const vertexIds = attribute('vertexIds');

            If(vertexIds.x.equal(int(-1)), () => {
                position.assign(getBellPosition(Medusa.uniforms.phase, zenith, azimuth, isOuterSide ? 0 : 1));
                position.assign(Medusa.uniforms.matrix.mul(position).xyz);
                const p0 = Medusa.uniforms.matrix.mul(getBellPosition(Medusa.uniforms.phase, zenith.add(0.001), azimuth.sub(0.001), isOuterSide ? 0 : 1)).xyz;
                const p1 = Medusa.uniforms.matrix.mul(getBellPosition(Medusa.uniforms.phase, zenith.add(0.001), azimuth.add(0.001), isOuterSide ? 0 : 1)).xyz;
                tangent.assign(p0.sub(position));
                bitangent.assign(p1.sub(position));
            }).Else(() => {
                const p0 = physics.positionData.element(vertexIds.x).xyz.toVar();
                const p1 = physics.positionData.element(vertexIds.y).xyz.toVar();
                const p2 = physics.positionData.element(vertexIds.z).xyz.toVar();
                const p3 = physics.positionData.element(vertexIds.w).xyz.toVar();
                const top = p0.add(p1).mul(0.5);
                const bottom = p2.add(p3).mul(0.5);
                const left = p0.add(p2).mul(0.5);
                const right = p1.add(p3).mul(0.5);
                bitangent.assign(right.sub(left));
                tangent.assign(bottom.sub(top));
                const pos = top.add(bottom).mul(0.5);
                position.assign(pos);
            });

            normal.assign(tangent.cross(bitangent).normalize().mul(side.z));
            normal.addAssign(tangent.normalize().mul(side.y));
            position.addAssign(normal.mul(side.w));

            //if (glow) {
                //emissiveness.addAssign(orange.mul(normalView.z.max(0.0).pow(2)).mul(0.4));
                const medusaCenter = Medusa.uniforms.matrix.mul(vec4(0,isOuterSide ? 0.3 : 0.6,0,1)).xyz;
                const rayOrigin = position.xyz;
                const rayDir = rayOrigin.sub(cameraPosition.xyz).normalize().toVar();
                const center = medusaCenter.xyz;
                const distRayToCenter = cross(rayDir, center.sub(rayOrigin)).length();
                // Vector3.Cross(ray.direction, point - ray.origin).magnitude;
                vEmissive.assign(smoothstep(0,isOuterSide ? 1.0 : 1.8,distRayToCenter).oneMinus().mul(0.4));

            //};

            vNormal.assign(transformNormalToView(normal));
            return position;
        })();
        //MedusaBellGeometry.material.normalNode = normalMap(texture(Medusa.normalMap), Medusa.uniforms.normalMapScale); //transformNormalToView(vNormal);
        //MedusaBellGeometry.material.normalNode = vNormal.normalize();

        if (!isOuterSide) {
            material.envNode = Fn(() => { return 0; })();
        }

        material.colorNode = MedusaBellPattern.colorNode;
        material.emissiveNode = MedusaBellPattern.emissiveNode;
        material.metalnessNode = Fn(() => {
            return MedusaBellPattern.metalness.mul(0.5).add(0.25);
        })()

        material.opacityNode = Fn(() => {
            const fog = Background.getFog;
            return MedusaBellPattern.metalness.mul(0.4).add(0.4).add(vEmissive.mul(0.5)).mul(fog);
        })();

        material.mrtNode = mrt( {
            bloomIntensity: Fn(() => {
                const glowIntensity = Background.getFog * (1.0 + Medusa.uniforms.charge * 2);
                const charge = Medusa.uniforms.charge;
                return vec4(glowIntensity, charge, 0, 1);
            })()
        } );

        return material;
    }

    _addVertex (zenith, azimuth, v0, v1, v2, v3, side, width) {
        const ptr = this.vertexCount;
        const uvx = Math.sin(azimuth) * zenith * 1;
        const uvy = Math.cos(azimuth) * zenith * 1;

        this.positionArray[ptr * 3 + 0] = 0;
        this.positionArray[ptr * 3 + 1] = 0;
        this.positionArray[ptr * 3 + 2] = 0;
        this.vertexIdArray[ptr * 4 + 0] = v0;
        this.vertexIdArray[ptr * 4 + 1] = v1;
        this.vertexIdArray[ptr * 4 + 2] = v2;
        this.vertexIdArray[ptr * 4 + 3] = v3;
        this.uvArray[ptr * 2 + 0] = uvx;
        this.uvArray[ptr * 2 + 1] = uvy;

        this.zenithArray[ptr] = zenith;
        this.azimuthArray[ptr] = azimuth;
        //this.bottomFactorArray[ptr] = bottomFactor;
        this.sideArray[ptr*4+0] = side.x;
        this.sideArray[ptr*4+1] = side.y;
        this.sideArray[ptr*4+2] = side.z;
        this.sideArray[ptr*4+3] = width;

        this.vertexCount++;
        return ptr;
    }

    getAvgAngle (angles) {
        let x = 0, y = 0;
        angles.forEach(a => {
            x += Math.sin(a);
            y += Math.cos(a);
        });
        return Math.atan2(x,y);
    }

    addVertexFromParams(zenith, azimuth, side = {x: 0, y: 0, z: 1}, width = 0) {
        return this._addVertex(zenith, azimuth, -1, -1, -1, -1, side, width);
    }

    addVertexFromVertices(v0, v1, v2, v3, side, width) {
        let zenith, azimuth;
        azimuth = this.getAvgAngle([v0.azimuth,v1.azimuth,v2.azimuth,v3.azimuth]);
        zenith = (v0.zenith + v1.zenith + v2.zenith + v3.zenith) * 0.25;
        zenith -= (v0.offset.y + v1.offset.y + v2.offset.y + v3.offset.y) * 0.25;
        zenith += side.y * width;
        return this._addVertex(zenith, azimuth, v0.id, v1.id, v2.id, v3.id, side, width);
    }

    addFace(v0,v1,v2) {
        this.indices.push(v0,v1,v2);
    }

    bakeGeometry() {
        const positionBuffer =  new THREE.BufferAttribute(new Float32Array(this.positionArray), 3, false);
        const vertexIdBuffer =  new THREE.BufferAttribute(new Int32Array(this.vertexIdArray), 4, false);
        const zenithBuffer =  new THREE.BufferAttribute(new Float32Array(this.zenithArray), 1, false);
        const azimuthBuffer =  new THREE.BufferAttribute(new Float32Array(this.azimuthArray), 1, false);
        const sideBuffer =  new THREE.BufferAttribute(new Float32Array(this.sideArray), 4, false);
        const uvBuffer =  new THREE.BufferAttribute(new Float32Array(this.uvArray), 2, false);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('vertexIds', vertexIdBuffer);
        geometry.setAttribute('zenith', zenithBuffer);
        geometry.setAttribute('azimuth', azimuthBuffer);
        //geometry.setAttribute('bottomFactor', bottomFactorBuffer);
        geometry.setAttribute('sideData', sideBuffer);
        geometry.setAttribute('uv', uvBuffer);
        geometry.setIndex(this.indices);

        this.object = new THREE.Mesh(geometry, this.isOuterSide ? MedusaBellGeometry.materialOuter : MedusaBellGeometry.materialInner);
        this.object.frustumCulled = false;

        this.object.onBeforeRender = () => {
            Medusa.uniforms.phase.value = this.medusa.phase;
            Medusa.uniforms.charge.value = this.medusa.charge;
            Medusa.uniforms.matrix.value.copy(this.medusa.transformationObject.matrix);
        }
    }
}