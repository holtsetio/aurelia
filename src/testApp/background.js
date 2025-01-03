import * as THREE from "three/webgpu";
import {noise3D} from "./common/noise";
import chroma from "chroma-js";
import {conf} from "./conf";
import {
    Fn,
    vec3,
    screenUV,
    positionWorld,
    cameraPosition,
    float,
    acos,
    normalWorld,
    rand,
    time,
    sin,
    dot,
    mx_worley_noise_float,
    reflectVector,
    triNoise3D, min, smoothstep, vec2, mod, mat3, If
} from "three/tsl";

const hash23 = /*@__PURE__*/ Fn( ( [ uv ] ) => {
    const a = 12.9898, b = 78.233, c = vec3(43758.5453, 43758.1947, 43758.42037);
    const dt = dot(uv.xy, vec2(a, b));
    const sinsn = sin(mod( dt, Math.PI )).toVar();
    return c.mul(sinsn).fract();
} );

export class Background {

    static fogFunction = Fn(() => {
        const colorTop = vec3(.1, .4, .9);
        const colorBottom = vec3(.1, .5, .6);

        const camDir = positionWorld.sub(cameraPosition).normalize();

        const wave = sin(camDir.x.add(time.mul(0.2))).mul(0.05);
        const y = camDir.y.mul(0.5).add(0.5).pow(2.0).add(wave);
        const color = colorTop.mul(y);
        const uv = screenUV.toVar();
        const dither = hash23(uv).sub(0.5).mul(1.0/255);
        color.xyz.addAssign(dither);
        return color;
    })();

    //#define F a=min(a,length(.5-fract(k.xyw*=mat3(-2,-1,2, 3,-2,1, 1,2,2)*.3)))
    //
    // void mainImage(out vec4 k, vec2 p)
    // {
    //     k.w = iDate.w*0.1;
    //     k.xy = p/iResolution.y*7. + sin(iDate.w*.1);
    //     float a=1.;
    //     F;F;F;
    //     k = pow(a,7.)*25.+vec4(0,.35,.5,1);
    // }

    static envFunction = Fn(() => {
        const up = normalWorld.y.max(0.0);
        const lightIntensity = float(0.0).toVar();
        If(up.greaterThan(0.0), () => {
            const matrix = mat3(-2/3,-1/3,2/3, 3/3,-2/3,1/3, 1/3,2/3,2/3);
            const water = vec3(positionWorld.xz.mul(1.5), time.mul(0.5)).toVar();
            //water.x.sub(positionWorld.y);
            //water.addAssign(sin(time.mul(0.2)));
            water.assign(matrix.mul(water));
            const a = vec3(0.5).sub(water.fract()).length().toVar();
            water.assign(matrix.mul(water));
            a.assign(min(a,vec3(0.5).sub(water.fract()).length()));
            //water.assign(matrix.mul(water));
            //a.assign(min(a,vec3(0.5).sub(water.fract()).length()));

            lightIntensity.assign(up.mul(a.add(0.4).pow(8.0).mul(4.0).max(0.0)));
        });

        return vec3(1).mul(lightIntensity);

        //const water = mx_worley_noise_float(vec3(positionWorld.xz.mul(1.0), time.mul(1.0)));
        /*const waterNoise = triNoise3D(vec3(positionWorld.xz.mul(0.2), 13.37), 0.5, time); // mx_worley_noise_float(vec3(positionWorld.xz.mul(1.0), time.mul(1.0)));
        const water = min(smoothstep(0.2,0.25,waterNoise), smoothstep(0.25,0.30,waterNoise).oneMinus());
        const up = dot(vec3(0,1,0),reflectVector).max(0.0);
        const lightIntensity = up.mul(water.mul(1.0).add(0.0));
        return vec3(1).mul(lightIntensity);*/
    })().toVar("waterEnvironment");

    static fogNear = 12;
    static fogFar = 30;

    constructor(renderer) {
        /*this.renderer = renderer;
        this.renderTarget = new THREE.WebGLCubeRenderTarget( 256 );
        this.renderTarget.texture.type = THREE.HalfFloatType;
        this.renderTarget.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.renderTarget.texture.magFilter = THREE.LinearFilter;
        this.renderTarget.texture.generateMipmaps = true;

        this.camera = new THREE.CubeCamera( 1, 1000, this.renderTarget );
        this.texture = this.renderTarget.texture;

        this.scene = new THREE.Scene();
        const light = new THREE.PointLight('#ff00ff', 1000);
        this.scene.add(light);

        this.box = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardNodeMaterial());
        this.box.position.setX(5);
        this.scene.add(this.box);*/
    }

    update(elapsed) {
        //this.box.position.set(Math.sin(elapsed*0.01) * 5, 0, Math.cos(elapsed*0.01) * 5);
        //this.camera.update(this.renderer, this.scene);
    }
}

