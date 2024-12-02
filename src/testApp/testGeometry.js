import * as THREE from "three/webgpu";
import {attribute, Fn, normalMap, texture, transformNormalToView, varying, vec2, vec3} from "three/tsl";
import {Medusa} from "./medusa";


export class TestGeometry {
    object = null;

    constructor() {
        this.object = new THREE.Object3D();
        const geometry1 = new THREE.SphereGeometry(1);
        const geometry2 = new THREE.SphereGeometry(1);
        delete geometry2.attributes.normal;
        const metalness = 1.0;
        const roughness = 0.4;

        const material1 = new THREE.MeshPhysicalNodeMaterial({
            metalness, roughness,
            normalMap: Medusa.normalMap,
            normalScale: new THREE.Vector2(1,1),
        });

        const material2 = new THREE.MeshPhysicalNodeMaterial({
            metalness, roughness
        });

        const vNormal = varying(vec3(0), "v_normalView");
        material2.positionNode = Fn(() => {
            const position = attribute("position");
            vNormal.assign(transformNormalToView(position.normalize()));
            return position;
        })();
        material2.normalNode = vNormal.normalize();
        material2.normalNode = normalMap(texture(Medusa.normalMap), vec2(1.0,1.0));



        this.mesh1 = new THREE.Mesh(geometry1, material1);
        this.mesh2 = new THREE.Mesh(geometry2, material2);
        this.mesh1.position.setX(1);
        this.mesh2.position.setX(-1);
        this.object.add(this.mesh1);
        this.object.add(this.mesh2);
    }

    update(elapsed) {
        //this.mesh1.rotation.set(0,elapsed,0);
        //this.mesh2.rotation.set(0,elapsed,0);
    }
}

