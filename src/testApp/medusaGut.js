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
    uv,
    float,
    sqrt,
    If, atan2, sin, cos, max
} from "three/tsl";

import {Medusa} from "./medusa";
import {getBellPosition, getGutPosition} from "./medusaBellFormula";
import {noise3D} from "./common/noise";

export class MedusaGut {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
    }

    static createMaterial(physics) {
        MedusaGut.material = new THREE.MeshPhysicalNodeMaterial({
            side: THREE.DoubleSide,
            metalness: 0.0,
            roughness:0.32,
            //transmission: 1.0,
            color: '#ff00ff',
            //normalScale: new THREE.Vector2(10,-10),
            //map: Medusa.colorMap,
            //normalMap: Medusa.normalMap,
            /*clearcoat: 1.0,
            clearcoatRoughness: 0.5,
            iridescence: 1.0,
            iridescenceIOR: 1.666,*/
            opacity: 1.0,
            transparent: true,
            transmission: 0.01,
            emissive: '#ff00ff',
        });

        const vNormal = varying(vec3(0), "v_normalView");
        MedusaGut.material.positionNode = Fn(() => {
            const zenith = attribute('zenith');
            const azimuth = attribute('azimuth');
            const position = getGutPosition(physics.uniforms.time, zenith, azimuth).toVar();
            const tangent = getGutPosition(physics.uniforms.time, zenith.add(0.001), azimuth.sub(0.001)).sub(position);
            const bitangent = getGutPosition(physics.uniforms.time, zenith.add(0.001), azimuth.add(0.001)).sub(position);
            vNormal.assign(transformNormalToView(tangent.cross(bitangent).normalize()));

            return position;
        })();
        MedusaGut.material.normalNode = normalMap(texture(Medusa.normalMap), vec2(0.1,-0.1)); //transformNormalToView(vNormal);
        //Medusa.bellMaterial.normalNode = vNormal.normalize();
        MedusaGut.material.opacityNode = Fn(() => {
            const dist = uv().length();
            const angularPattern = max(0.0, sin(atan2(uv().y,uv().x).mul(4)).mul(0.5).add(0.3));
            const circularPattern = cos(dist.mul(36)).mul(-0.5).add(0.5);
            const fadeOut = float(1.0).sub(dist.mul(1.4));
            return angularPattern.mul(circularPattern).mul(fadeOut);
        })();
    }

    createGeometry() {
        const { noiseSeed } = this.medusa;
        const subdivisions = 10;

        const icoEdgeLength = 1.0;
        const icoCircumradius = 0.951057;
        const icoRadius = 1 / (2 * Math.sin(36 * (Math.PI / 180)));
        const alpha = Math.acos(icoRadius);
        const h = icoCircumradius - Math.sin(alpha);

        const icoVertexTop = new THREE.Vector3(0, icoCircumradius, 0);
        const icoVertexRowTop = [];
        const icoVertexRowBottom = [];
        for (let i = 0; i<=5; i++) {
            const topAngle = i * (2.0 * Math.PI / 5);
            const bottomAngle = (0.5 + i) * (2.0 * Math.PI / 5);
            icoVertexRowTop.push(new THREE.Vector3(Math.sin(topAngle) * icoRadius, h, Math.cos(topAngle) * icoRadius));
            icoVertexRowBottom.push(new THREE.Vector3(Math.sin(bottomAngle) * icoRadius, -h, Math.cos(bottomAngle) * icoRadius));
        }

        let vertexCount = 0;
        const positionArray = [];
        const zenithArray = [];
        const azimuthArray = [];
        const uvArray = [];
        const indices = [];

        const addVertex = (position) => {
            const width = Math.sqrt(position.x*position.x+position.z*position.z);
            let zenith = Math.atan2(width, position.y) / (Math.PI * 0.5);
            const azimuth = Math.atan2(position.x, position.z);

            const noisePosX = Math.sin(azimuth) * 3;
            const noisePosY = Math.cos(azimuth) * 3;
            zenith *= 0.90 + noise3D(noiseSeed, noisePosX, noisePosY) * 0.05;

            const uvx = Math.sin(azimuth) * zenith * 1;
            const uvy = Math.cos(azimuth) * zenith * 1;

            const ptr = vertexCount;
            positionArray[ptr * 3 + 0] = position.x;
            positionArray[ptr * 3 + 1] = position.y;
            positionArray[ptr * 3 + 2] = position.z;
            zenithArray[ptr] = zenith;
            azimuthArray[ptr] = azimuth;
            uvArray[ptr * 2 + 0] = uvx;
            uvArray[ptr * 2 + 1] = uvy;

            vertexCount++;
            return { ptr, azimuth, zenith };
        };

        const vertexRows = [];
        vertexRows.push([addVertex(icoVertexTop.clone().normalize())]);
        for (let y=1; y<=subdivisions; y++) {
            const vertexRow = [];
            for (let f=0; f<5; f++) {
                const e0 = icoVertexTop.clone().lerp(icoVertexRowTop[f], y/subdivisions);
                const e1 = icoVertexTop.clone().lerp(icoVertexRowTop[f+1], y/subdivisions);
                for (let x=0; x<y; x++) {
                    const pos = e0.clone().lerp(e1, x/y).normalize();
                    vertexRow.push(addVertex(pos));
                }
            }
            vertexRow.push(vertexRow[0]);
            vertexRow.push(vertexRow[1]);
            vertexRows.push(vertexRow);
        }
        for (let y=1; y<=subdivisions/2; y++) {
            const vertexRow = [];
            for (let f=0; f<5; f++) {
                const e0 = icoVertexRowTop[f].clone().lerp(icoVertexRowBottom[f], y/subdivisions);
                const e1 = icoVertexRowTop[f+1].clone().lerp(icoVertexRowBottom[f], y/subdivisions);
                const e2 = icoVertexRowTop[f+1].clone().lerp(icoVertexRowBottom[f+1], y/subdivisions);
                for (let x=0; x < subdivisions-y; x++) {
                    const pos = e0.clone().lerp(e1, x/(subdivisions-y)).normalize();
                    vertexRow.push(addVertex(pos));
                }
                for (let x=0; x < y; x++) {
                    const pos = e1.clone().lerp(e2, x/y).normalize();
                    vertexRow.push(addVertex(pos));
                }
            }
            vertexRow.push(vertexRow[0]);
            vertexRow.push(vertexRow[1]);
            vertexRows.push(vertexRow);
        }
        const getVertexFromTopFace = (face, row, index) => {
            return vertexRows[row][face * row + index].ptr;
        };
        const getVertexFromBottomDownlookingFace = (face, row, index) => {
            return vertexRows[subdivisions + row][face * subdivisions + index].ptr;
        }
        const getVertexFromBottomUplookingFace = (face, row, index) => {
            return vertexRows[subdivisions + row][face * subdivisions + (subdivisions - row) + index].ptr;
        }


        for (let y = 1; y<=subdivisions; y++) {
            for (let f=0; f<5; f++) {
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromTopFace(f, y, x);
                    const v1 = getVertexFromTopFace(f, y-1, x);
                    const v2 = getVertexFromTopFace(f, y, x+1);
                    indices.push(v0,v1,v2);
                    if (x < y-1) {
                        const v3 = getVertexFromTopFace(f, y-1, x+1);
                        indices.push(v3,v2,v1);
                    }
                }
            }
        }

        for (let y = 1; y<=subdivisions/2; y++) {
            for (let f=0; f<5; f++) {
                for (let x=0; x < subdivisions - y; x++) {
                    const v0 = getVertexFromBottomDownlookingFace(f, y, x);
                    const v1 = getVertexFromBottomDownlookingFace(f, y-1, x+1);
                    const v2 = getVertexFromBottomDownlookingFace(f, y, x+1);
                    const v3 = getVertexFromBottomDownlookingFace(f, y-1, x+2);
                    indices.push(v0,v1,v2);
                    indices.push(v3,v2,v1);
                }
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromBottomUplookingFace(f, y, x);
                    const v1 = getVertexFromBottomUplookingFace(f, y-1, x);
                    const v2 = getVertexFromBottomUplookingFace(f, y, x+1);
                    indices.push(v0,v1,v2);
                    const v3 = getVertexFromBottomUplookingFace(f, y - 1, x + 1);
                    indices.push(v3, v2, v1);
                }
            }
        }

        const positionBuffer =  new THREE.BufferAttribute(new Float32Array(positionArray), 3, false);
        const zenithBuffer =  new THREE.BufferAttribute(new Float32Array(zenithArray), 1, false);
        const azimuthBuffer =  new THREE.BufferAttribute(new Float32Array(azimuthArray), 1, false);
        const uvBuffer =  new THREE.BufferAttribute(new Float32Array(uvArray), 2, false);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute( 'position', positionBuffer);
        geometry.setAttribute( 'zenith', zenithBuffer);
        geometry.setAttribute( 'azimuth', azimuthBuffer);
        geometry.setAttribute( 'uv', uvBuffer);
        geometry.setIndex(indices);

        this.object = new THREE.Mesh(geometry, MedusaGut.material);
        this.object.frustumCulled = false;
        this.object.renderOrder = 20;

    }
}