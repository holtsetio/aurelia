import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    smoothstep, uv, float, min, mix, cameraPosition, positionWorld
} from "three/tsl";
import {mx_perlin_noise_float} from "three/src/nodes/materialx/lib/mx_noise";
import {Medusa} from "./medusa";

export class MedusaBellPattern {
   static createColorNode() {
        const pattern = () => {
            const result = float(1).toVar();
            const vUv = uv().mul(0.8);
            const d = vUv.length();

            /*** lines ***/
            const a = attribute('azimuth').div(Math.PI).mul(4).mod(0.5).sub(0.25).toVar();
            const noise = mx_perlin_noise_float(vUv.mul(6));
            a.addAssign(noise.mul(0.1));


            const fade0 = smoothstep(0.2, 0.25, d);
            a.mulAssign(fade0);
            const fade1 = smoothstep(0.6, 0.85, d).oneMinus();
            a.mulAssign(fade1);

            const line = smoothstep(0.02,0.08,a.abs());

            const fade2 = smoothstep(0.80, 0.86, d.add(noise.mul(0.03)));
            const innerCircle = smoothstep(0.15, 0.2, d).oneMinus();

            const linePattern = line.max(fade2).max(innerCircle);

            result.assign(min(result, linePattern));

            /*** seamCircles ***/
            /*const ca = attribute('azimuth').div(Math.PI).mul(10).mod(0.5).sub(0.25);
            const cb = attribute('zenith').sub(1.22).mul(4);
            const circlesDist = sqrt(ca.mul(ca).add(cb.mul(cb))).add(noise.mul(0.1));
            const circles = smoothstep(0.18,0.24,circlesDist);
            /result.assign(min(result,circles));*/

            const circlesFade = smoothstep(0.90, 1.0, d.add(noise.mul(0.05))).oneMinus();
            result.assign(min(result,circlesFade));

            /*** speckles ***/
            const specklesNoiseRaw = mx_perlin_noise_float(uv().mul(100));
            const specklesNoise = smoothstep(-0.5, 0.0, specklesNoiseRaw);
            const specklesFade = smoothstep(0.7, 0.9, d);
            const specklesFade2 = smoothstep(0, 0.2, d).oneMinus();
            const speckles = specklesNoise.max(specklesFade).max(specklesFade2);
            result.assign(min(result, speckles));

            return result;
        };
       MedusaBellPattern.colorNode = Fn(() => {
            const white = vec3(1,1,1);
            const orange = vec3(1,0.5,0.1);

            const value = pattern().toVar();

            //const noise = mx_perlin_noise_float(uv().mul(8)).mul(0.5).add(0.5);
            //value.addAssign(noise.mul(0.5));

            const metalness = float(value).oneMinus().toVar("medusaMetalness");
            const color = mix(orange,white,value).toVar("fragmentColor");
            return color;
        })();

       MedusaBellPattern.emissiveNode = Fn(() => {
            const color = vec3().toVar("DiffuseColor");
            const projectedMousePos = cameraPosition.add(Medusa.uniforms.mouseRay.mul(cameraPosition.distance(positionWorld)));
            const delta = positionWorld.sub(projectedMousePos).toVar();
            const noise = mx_perlin_noise_float(positionWorld).mul(0.5).add(0.5);
            const factor = delta.length().oneMinus().mul(noise).max(0.0).pow(2.0);

            return color.mul(factor);
        })();
    }
}