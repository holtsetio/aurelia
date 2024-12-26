import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    transformNormalToView,
    normalMap,
    texture,
    vec2,
    uint,
    int,
    If, float
} from "three/tsl";

import {Medusa} from "./medusa";
import {getBellPosition} from "./medusaBellFormula";
import {conf} from "./conf";
import {MedusaBellPattern} from "./medusaBellPattern";

export class MedusaBellGeometry {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;

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
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness } = conf;
        MedusaBellGeometry.material = new THREE.MeshPhysicalNodeMaterial({
            //side: THREE.Single,
            roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness,
            opacity:0.8,
            transparent: true,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        MedusaBellGeometry.material.positionNode = Fn(() => {
            const tangent = vec3().toVar();
            const bitangent = vec3().toVar();
            const position = vec3().toVar();
            const normal = vec3().toVar();
            const zenith = attribute('zenith');
            const azimuth = attribute('azimuth');
            const bottomFactor = attribute('bottomFactor');
            const side = attribute('sideData');
            const vertexIds = attribute('vertexIds');

            If(vertexIds.x.equal(int(-1)), () => {
                position.assign(getBellPosition(Medusa.uniforms.phase, zenith, azimuth, bottomFactor));
                position.assign(Medusa.uniforms.matrix.mul(position).xyz);
                const p0 = Medusa.uniforms.matrix.mul(getBellPosition(Medusa.uniforms.phase, zenith.add(0.001), azimuth.sub(0.01), bottomFactor)).xyz;
                const p1 = Medusa.uniforms.matrix.mul(getBellPosition(Medusa.uniforms.phase, zenith.add(0.001), azimuth.add(0.01), bottomFactor)).xyz;
                tangent.assign(p0.sub(position));
                bitangent.assign(p1.sub(position));
            }).Else(() => {
                const p0 = physics.positionData.buffer.element(vertexIds.x).xyz.toVar();
                const p1 = physics.positionData.buffer.element(vertexIds.y).xyz.toVar();
                const p2 = physics.positionData.buffer.element(vertexIds.z).xyz.toVar();
                const p3 = physics.positionData.buffer.element(vertexIds.w).xyz.toVar();
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

            vNormal.assign(transformNormalToView(normal));
            return position;
        })();
        MedusaBellGeometry.material.normalNode = normalMap(texture(Medusa.normalMap), Medusa.uniforms.normalMapScale); //transformNormalToView(vNormal);
        //MedusaBellGeometry.material.normalNode = vNormal.normalize();

        MedusaBellGeometry.material.colorNode = MedusaBellPattern.colorNode;
        MedusaBellGeometry.material.emissiveNode = MedusaBellPattern.emissiveNode;
        MedusaBellGeometry.material.metalnessNode = Fn(() => {
            const metalness = float().toVar("medusaMetalness");
            return metalness.mul(0.5).add(0.25);
        })();

        /*
        MedusaBell.material.thicknessColorNode = Fn(() => {
           return uv().length().div(4.0).oneMinus();
        })();
        MedusaBell.material.thicknessDistortionNode = float( 0.1 );
        MedusaBell.material.thicknessAmbientNode = float( 0.0 );
        MedusaBell.material.thicknessAttenuationNode = float( .8 );
        MedusaBell.material.thicknessPowerNode = float( 2.0 );
        MedusaBell.material.thicknessScaleNode = float( 1.0 );*/
    }

    normalizeAzimuth (a) {
        return a < 0 ? a + Math.PI * 2 : a;
    }

    _addVertex (zenith, azimuth, v0, v1, v2, v3, side, width, bottomFactor) {
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
        this.bottomFactorArray[ptr] = bottomFactor;
        this.sideArray[ptr*4+0] = side.x;
        this.sideArray[ptr*4+1] = side.y;
        this.sideArray[ptr*4+2] = side.z;
        this.sideArray[ptr*4+3] = width;

        this.vertexCount++;
        return ptr;
    }

    addVertexFromParams(zenith, azimuth, side = {x: 0, y: 0, z: 1}, width = 0, bottomFactor = 0) {
        return this._addVertex(zenith, azimuth, -1, -1, -1, -1, side, width, bottomFactor);
    }

    addVertexFromVertices(v0, v1, v2, v3, side, width, bottomFactor = 0) {
        let zenith, azimuth;
        azimuth = (this.normalizeAzimuth(v0.azimuth) + this.normalizeAzimuth(v1.azimuth) + this.normalizeAzimuth(v2.azimuth) + this.normalizeAzimuth(v3.azimuth)) * 0.25;
        zenith = (v0.zenith + v1.zenith + v2.zenith + v3.zenith) * 0.25;
        zenith -= (v0.offset.y + v1.offset.y + v2.offset.y + v3.offset.y) * 0.25;
        zenith += side.y * width;
        return this._addVertex(zenith, azimuth, v0.id, v1.id, v2.id, v3.id, side, width, bottomFactor);
    }

    addFace(v0,v1,v2) {
        this.indices.push(v0,v1,v2);
    }

    bakeGeometry() {
        const positionBuffer =  new THREE.BufferAttribute(new Float32Array(this.positionArray), 3, false);
        const vertexIdBuffer =  new THREE.BufferAttribute(new Int32Array(this.vertexIdArray), 4, false);
        const zenithBuffer =  new THREE.BufferAttribute(new Float32Array(this.zenithArray), 1, false);
        const azimuthBuffer =  new THREE.BufferAttribute(new Float32Array(this.azimuthArray), 1, false);
        const bottomFactorBuffer =  new THREE.BufferAttribute(new Float32Array(this.bottomFactorArray), 1, false);
        const sideBuffer =  new THREE.BufferAttribute(new Float32Array(this.sideArray), 4, false);
        const uvBuffer =  new THREE.BufferAttribute(new Float32Array(this.uvArray), 2, false);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('vertexIds', vertexIdBuffer);
        geometry.setAttribute('zenith', zenithBuffer);
        geometry.setAttribute('azimuth', azimuthBuffer);
        geometry.setAttribute('bottomFactor', bottomFactorBuffer);
        geometry.setAttribute('sideData', sideBuffer);
        geometry.setAttribute('uv', uvBuffer);
        geometry.setIndex(this.indices);

        this.object = new THREE.Mesh(geometry, MedusaBellGeometry.material);
        this.object.frustumCulled = false;

        this.object.onBeforeRender = () => {
            Medusa.uniforms.phase.value = this.medusa.phase;
            Medusa.uniforms.matrix.value.copy(this.medusa.transformationObject.matrix);
        }
    }
}