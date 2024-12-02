import * as THREE from "three/webgpu";
import { Fn, attribute, varying, vec3, transformNormalToView, normalMap, texture, vec2 } from "three/tsl";

import {MedusaVerletBridge} from "./medusaVerletBridge";
import {noise3D} from "../testApp/common/noise";
import {getBellPosition} from "./medusaBell";

import normalMapFile from '../assets/Alien_Muscle_001_NORM.jpg';
import colorMapFile from '../assets/Alien_Muscle_001_COLOR.jpg';

export class Medusa {
    renderer = null;
    physics = null;
    object = null;
    bridge = null;
    noiseSeed = 0;

    constructor(renderer, physics){
        this.renderer = renderer;
        this.physics = physics;
        this.object = new THREE.Object3D();
        this.transformationObject = new THREE.Object3D();
        this.object.add(this.transformationObject);
        this.transformationObject.position.set(Math.random() * 5, 0, Math.random() * 5);

        this.noiseSeed = Math.random() * 100.0;
        this.bridge = new MedusaVerletBridge(this.physics, this);
        this.createBellMaterial();
        this.createBellMarginMaterial();
        this.createBellGeometry();
        this.physics.addObject(this);

        this.updatePosition(0,0);
    }

    /*addVertex(position, fixed) {
        const vertex = this.physics.addVertex(position, false);

        const width = Math.sqrt(position.x*position.x+position.z*position.z);
        const zenith = Math.atan2(width, position.y) / (Math.PI * 0.5);
        const azimuth = Math.atan2(position.x, position.z);

        const offset = position.clone().multiplyScalar(0.3);
        const muscleVertex = this.physics.addVertex(position, true);
        this.bridge.registerVertex(vertex, zenith, azimuth, new THREE.Vector3(0), false);
        this.bridge.registerVertex(muscleVertex, zenith, azimuth, offset, true);
        this.physics.addSpring(vertex, muscleVertex, 0.05, 1);
        return vertex;
    }*/

    createBellMaterial() {
        this.bellMaterial = new THREE.MeshPhysicalNodeMaterial({
            side: THREE.DoubleSide,
            metalness: 0.5,
            roughness:0.32,
            transmission: 0.8,
            //normalScale: new THREE.Vector2(10,-10),
            //map: Medusa.colorMap,
            normalMap: Medusa.normalMap,
            clearcoat: 1.0,
            clearcoatRoughness: 0.5,
            iridescence: 1.0,
            iridescenceIOR: 1.666,
            //opacity: 0,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        this.bellMaterial.positionNode = Fn(() => {
            const zenith = attribute('zenith');
            const azimuth = attribute('azimuth');
            const position = getBellPosition(this.physics.uniforms.time, zenith, azimuth).toVar();
            const tangent = getBellPosition(this.physics.uniforms.time, zenith.add(0.001), azimuth.sub(0.001)).sub(position);
            const bitangent = getBellPosition(this.physics.uniforms.time, zenith.add(0.001), azimuth.add(0.001)).sub(position);
            vNormal.assign(transformNormalToView(tangent.cross(bitangent).normalize()));

            return position;
        })();
        this.bellMaterial.normalNode = normalMap(texture(Medusa.normalMap), vec2(0.8,-0.8)); //transformNormalToView(vNormal);
        //this.bellMaterial.normalNode = vNormal.normalize();
        //this.material.colorNode = vNormal;
    }

    createBellMarginMaterial() {
        this.bellMarginMaterial = new THREE.MeshPhysicalNodeMaterial({
            side: THREE.DoubleSide,
            metalness: 0.5,
            roughness:0.32,
            transmission: 0.8,
            //normalScale: new THREE.Vector2(10,-10),
            //map: Medusa.colorMap,
            //normalMap: Medusa.normalMap,
            clearcoat: 1.0,
            clearcoatRoughness: 0.5,
            iridescence: 1.0,
            iridescenceIOR: 1.666,
            //opacity: 0,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        this.bellMarginMaterial.positionNode = Fn(() => {
            const vertexIds = attribute('vertexIds');
            const p0 = this.physics.positionData.buffer.element(vertexIds.x).xyz.toVar();
            const p1 = this.physics.positionData.buffer.element(vertexIds.y).xyz.toVar();
            const p2 = this.physics.positionData.buffer.element(vertexIds.z).xyz.toVar();
            const bitangent = p1.sub(p0);
            const tangent = p2.sub(p0);
            vNormal.assign(transformNormalToView(tangent.cross(bitangent).normalize()));

            return p0.mul(1.0/3.0).add(p1.mul(1.0/3.0)).add(p2.mul(1.0/3.0));
        })();
        this.bellMarginMaterial.normalNode = vNormal.normalize();
        //this.material.colorNode = vNormal;

    }


    createBellGeometry() {
        /*const tmp0 = this.physics.addVertex({x:0,y:0,z:0}, true);
        const tmp1 = this.physics.addVertex({x:0,y:0.1,z:0}, false);
        const s0 = this.physics.addSpring(tmp0,tmp1,0.3,1);*/

        const subdivisions = 20; //has to be even

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
            const zenith = Math.atan2(width, position.y) / (Math.PI * 0.5);
            const azimuth = Math.atan2(position.x, position.z);

            const uvx = Math.sin(azimuth) * zenith * 4;
            const uvy = Math.cos(azimuth) * zenith * 4;

            const ptr = vertexCount;
            positionArray[ptr * 3 + 0] = position.x;
            positionArray[ptr * 3 + 1] = position.y;
            positionArray[ptr * 3 + 2] = position.z;
            zenithArray[ptr] = zenith;
            azimuthArray[ptr] = azimuth;
            uvArray[ptr * 2 + 0] = uvx;
            uvArray[ptr * 2 + 1] = uvy;

            vertexCount++;
            return ptr;
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
            return vertexRows[row][face * row + index];
        };
        const getVertexFromBottomDownlookingFace = (face, row, index) => {
            return vertexRows[subdivisions + row][face * subdivisions + index];
        }
        const getVertexFromBottomUplookingFace = (face, row, index) => {
            return vertexRows[subdivisions + row][face * subdivisions + (subdivisions - row) + index];
        }


        for (let y = 1; y<=subdivisions; y++) {
            for (let f=0; f<5; f++) {
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromTopFace(f, y, x);
                    const v1 = getVertexFromTopFace(f, y-1, x);
                    const v2 = getVertexFromTopFace(f, y, x+1);
                    indices.push(v2,v1,v0);
                    if (x < y-1) {
                        const v3 = getVertexFromTopFace(f, y-1, x+1);
                        indices.push(v1,v2,v3);
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
                    indices.push(v2,v1,v0);
                    indices.push(v1,v2, v3);
                }
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromBottomUplookingFace(f, y, x);
                    const v1 = getVertexFromBottomUplookingFace(f, y-1, x);
                    const v2 = getVertexFromBottomUplookingFace(f, y, x+1);
                    indices.push(v2,v1,v0);
                    const v3 = getVertexFromBottomUplookingFace(f, y - 1, x + 1);
                    indices.push(v1, v2, v3);
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

        this.medusa = new THREE.Mesh(geometry, this.bellMaterial);
        this.medusa.frustumCulled = false;
        this.transformationObject.add(this.medusa);

        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshPhysicalNodeMaterial({
            color: '#ff6600',
        }));
        this.transformationObject.add(ball);


        /* ##################################
            create Verlet geometry
        #################################### */

        const bellMarginWidth = 200;
        const bellMarginHeight = 8;
        const bellMarginRows = [];
        for (let y = 0; y < bellMarginHeight; y++) {
            const row = [];
            for (let x = 0; x < bellMarginWidth; x++) {
                const zenith = y===0 ? 0.98 : 1.00;
                const azimuth = ((x + (y%2) * 0.5) / bellMarginWidth) * Math.PI * 2;
                const vertex = this.physics.addVertex(new THREE.Vector3(), y <= 1);
                const offset = new THREE.Vector3(0, (y-1) * -0.05, 0);
                if (y <= 1) { offset.multiplyScalar(0); }
                vertex.offset = offset.clone();
                vertex.zenith = zenith;
                vertex.azimuth = azimuth;
                this.bridge.registerVertex(vertex, zenith, azimuth, offset.clone(), y <= 1);
                row.push(vertex);
            }
            row.push(row[0]);
            bellMarginRows.push(row);
        }
        for (let y = 2; y < bellMarginHeight; y++) {
            for (let x = 0; x < bellMarginWidth; x++) {
                const springStrength = 0.005;
                const v0 = bellMarginRows[y][x];
                const v1 = bellMarginRows[y-1][x + y%2];
                const v2 = bellMarginRows[y][x+1];
                const v3 = bellMarginRows[y-2][x];
                const v4 = bellMarginRows[y][(x+2)%bellMarginWidth];
                this.physics.addSpring(v0, v1, springStrength, 1);
                this.physics.addSpring(v1, v2, springStrength * 0.1, 1);
                this.physics.addSpring(v0, v2, springStrength, 1);
                this.physics.addSpring(v0, v3, springStrength, 1);
                //this.physics.addSpring(v0, v4, springStrength, 1);
            }
        }

        /* ##################################
            create Bell Margin geometry
        #################################### */
        const marginPositionArray = [];
        const marginVertexIdArray = [];
        const marginIndices = [];
        const marginVertexRows = [];
        let marginVertexCount = 0;
        const addMarginVertex = (v0, v1, v2) => {
            const ptr = marginVertexCount;
            marginPositionArray[ptr * 3 + 0] = 0;
            marginPositionArray[ptr * 3 + 1] = 0;
            marginPositionArray[ptr * 3 + 2] = 0;
            marginVertexIdArray[ptr * 3 + 0] = v0.id;
            marginVertexIdArray[ptr * 3 + 1] = v1.id;
            marginVertexIdArray[ptr * 3 + 2] = v2.id;
            marginVertexCount++;
            return ptr;
        };

        for (let y = 1; y < bellMarginHeight; y++) {
            const row = []
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = bellMarginRows[y][x];
                const v1 = bellMarginRows[y-1][x+y%2];
                const v2 = bellMarginRows[y][x+1];
                const vertex = addMarginVertex(v0,v1,v2);
                row.push(vertex);
            }
            row.push(row[0]);
            marginVertexRows.push(row);
        }
        for (let y = 1; y < marginVertexRows.length; y++) {
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = marginVertexRows[y][x];
                const v1 = marginVertexRows[y-1][x+y%2];
                const v2 = marginVertexRows[y][x+1];
                const v3 = marginVertexRows[y-1][x+1-y%2];
                marginIndices.push(v0,v2,v1);
                if (y%2 === 0) {
                    marginIndices.push(v1,v2,v3);
                } else {
                    marginIndices.push(v3,v0,v1);
                }
            }
        }
        const marginPositionBuffer =  new THREE.BufferAttribute(new Float32Array(marginPositionArray), 3, false);
        const marginVertexIdBuffer =  new THREE.BufferAttribute(new Uint32Array(marginVertexIdArray), 3, false);
        const marginGeometry = new THREE.BufferGeometry();
        marginGeometry.setAttribute('position', marginPositionBuffer);
        marginGeometry.setAttribute('vertexIds', marginVertexIdBuffer);
        marginGeometry.setIndex(marginIndices);

        this.bellMargin = new THREE.Mesh(marginGeometry, this.bellMarginMaterial);
        this.bellMargin.frustumCulled = false;
        this.object.add(this.bellMargin);


        /* ##################################
        tentacles
        #################################### */
        const tentacleNum = 20;
        const tentacleLength = 20;
        const tentacles = [];
        for (let x = 0; x < tentacleNum; x++) {
            const springStrength = 0.005;
            const pivot = bellMarginRows[bellMarginRows.length - 1][Math.floor(x * (bellMarginWidth / tentacleNum))]
            const { offset, zenith, azimuth } = pivot;
            const tentacle = [];
            tentacle.push(pivot);
            for (let y = 1; y < tentacleLength; y++) {
                const vertex = this.physics.addVertex(new THREE.Vector3(), false);
                offset.y -= 0.12 + Math.random() * 0.05;
                this.bridge.registerVertex(vertex, zenith, azimuth, offset.clone(), false);
                this.physics.addSpring(tentacle[y-1], vertex, springStrength, 1);
                if (y > 1) {
                    this.physics.addSpring(tentacle[y-2], vertex, springStrength, 1);
                }
                tentacle.push(vertex);
            }
            tentacles.push(tentacle);
        }
        /*
        const bellMarginVertexRows = [];
        bellMarginVertexRows.push(vertexRows[vertexRows.length - 1]);
        const verticesPerMarginRow = subdivisions * 5;
        for (let i=1; i<8; i++) {
            const vertexRow = [];
            for (let x=0; x < verticesPerMarginRow; x++) {

                const refVertex = bellMarginVertexRows[0][x];
                const azimuth = Math.atan2(refVertex.value.x, refVertex.value.z) + (((i%2) * 0.5) / verticesPerMarginRow) * Math.PI * 2;

                const zenith = 1;
                //const azimuth = ((x + (i%2) * 0.5) / verticesPerMarginRow) * Math.PI * 2;
                const offset = new THREE.Vector3(0,-i*0.05,0);

                const vertex = this.physics.addVertex(new THREE.Vector3(), false);
                this.bridge.registerVertex(vertex, zenith, azimuth, offset, false);
                //this.physics.addSpring(vertex, muscleVertex, 0.05, 1);
                vertexRow.push(vertex);
            }
            vertexRow.push(vertexRow[0]);
            bellMarginVertexRows.push(vertexRow);
        }
        for (let i=1; i<8; i++) {
            for (let x=0; x < verticesPerMarginRow; x++) {
                const v0 = bellMarginVertexRows[i][x];
                const v1 = bellMarginVertexRows[i-1][x + i%2];
                const v2 = bellMarginVertexRows[i][x+1];
                this.physics.addSpring(v0, v1, 0.2, 1);
                this.physics.addSpring(v1, v2, 0.2, 1);
                this.physics.addSpring(v0, v2, 0.2, 1.0);
                if (i === 1) {
                    const v3 = vertexRows[vertexRows.length - 2][x];
                    this.physics.addSpring(v0, v3, 0.2, 1);
                }
                if (i > 1) {
                    const v3 = bellMarginVertexRows[i-2][x];
                    this.physics.addSpring(v0, v3, 0.2, 1);
                }
            }
        }
        console.log(vertexRows);

         */
    }

    async bake() {
        return await this.bridge.bake();
    }

    updatePosition(delta, elapsed) {
        const time = elapsed * 0.2;
        const rotX = noise3D(this.noiseSeed, 13.37, time * 0.01) * Math.PI * 0.1;
        const rotY = noise3D(this.noiseSeed, 12.37, time * 0.01) * Math.PI * 0.1;
        const rotZ = noise3D(this.noiseSeed, 11.37, time * 0.01) * Math.PI * 0.1;
        this.transformationObject.rotation.set(rotX,rotY,rotZ, "XZY");
        const offset = new THREE.Vector3(0,delta,0).applyEuler(this.transformationObject.rotation);
        this.transformationObject.position.add(offset);
        this.transformationObject.updateMatrix();
    }

    async update(delta, elapsed) {
        this.updatePosition(delta, elapsed);
        return await this.bridge.update();
    }


    static colorMap;
    static normalMap;
    static aoMap;
    static async initTextures() {
        const textureLoader = new THREE.TextureLoader();
        const loadTexture = (file) => {
            return new Promise(resolve => {
                textureLoader.load(file, texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    resolve(texture);
                });
            });
        }
        Medusa.normalMap = await loadTexture(normalMapFile);
        Medusa.colorMap = await loadTexture(colorMapFile);

    }

}