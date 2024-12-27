import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    smoothstep, uv, float, min, mix, cameraPosition, positionWorld, triNoise3D, time, sin, positionLocal
} from "three/tsl";
import {mx_perlin_noise_float} from "three/src/nodes/materialx/lib/mx_noise";
import {Medusa} from "./medusa";

export class MedusaBellPattern {
   static createColorNode() {
        const pattern = () => {
            const result = vec3(1).toVar();
            const vUv = uv().mul(0.8);
            const d = vUv.length();

            /*** lines ***/
            const a = attribute('azimuth').div(Math.PI).mul(4).mod(0.5).sub(0.25).toVar();
            const noise = triNoise3D(vec3(uv().mul(0.6), 1.34), 0.1, time).toVar(); //mx_perlin_noise_float(vUv.mul(6));
            result.z.assign(noise);

            noise.assign(noise.mul(3.0).sub(1.0));

            //a.assign(a.abs());
            const lineNoise = noise.mul(0.1).mul(smoothstep(0.23, 0.25, a.abs()).oneMinus());
            a.addAssign(lineNoise);
            const fade0 = smoothstep(0.2, 0.25, d);
            a.mulAssign(fade0);
            const fade1 = smoothstep(0.6, 0.85, d).oneMinus();
            a.mulAssign(fade1);

            const line = smoothstep(0.02,0.08,a.abs());
            const lineRed = smoothstep(0.0,0.02,a.abs());

            const fade2 = smoothstep(0.80, 0.96, d.add(noise.mul(0.03)));
            const fade2red = smoothstep(0.65, 0.85, d.add(noise.mul(0.03)));
            const innerCircle = smoothstep(0.15, 0.2, d).oneMinus();

            const linePattern = line.max(fade2).max(innerCircle);
            const linePattern2 = lineRed.max(fade2red).max(innerCircle);

            result.x.assign(min(result.x, linePattern));
            result.y.assign(min(result.y, linePattern2));

            /*** seamCircles ***/
            /*const ca = attribute('azimuth').div(Math.PI).mul(10).mod(0.5).sub(0.25);
            const cb = attribute('zenith').sub(1.22).mul(4);
            const circlesDist = sqrt(ca.mul(ca).add(cb.mul(cb))).add(noise.mul(0.1));
            const circles = smoothstep(0.18,0.24,circlesDist);
            /result.assign(min(result,circles));*/

            const circlesFade = smoothstep(0.90, 1.0, d.add(noise.mul(0.05))).oneMinus();
            result.x.assign(min(result.x,circlesFade));

            /*** speckles ***/
            const specklesNoiseRaw = triNoise3D(vec3(uv().mul(10), 12.34), 0, 0);
            result.z.assign(specklesNoiseRaw);
            const specklesNoise = smoothstep(0.1, 0.2, specklesNoiseRaw);
            //const specklesNoiseRed = smoothstep(0.05, 0.1, specklesNoiseRaw);
            const specklesFade = smoothstep(0.7, 0.9, d);
            const specklesFade2 = smoothstep(0, 0.2, d).oneMinus();
            const speckles = specklesNoise.max(specklesFade).max(specklesFade2);
            //const specklesRed = specklesNoiseRed.max(specklesFade).max(specklesFade2);
            result.x.assign(min(result.x, speckles));
            //result.y.assign(min(result.y, specklesRed));

            return result;
        };
       MedusaBellPattern.colorNode = Fn(() => {
           const value = pattern().toVar();
           const noise = value.z.mul(0.2).toVar();
           const white = vec3(1,1,1).sub(noise);
           const orange = vec3(1,0.5,0.1).sub(noise);
           const red = vec3(1,0.2,0.1).sub(noise);

            //const noise = mx_perlin_noise_float(uv().mul(8)).mul(0.5).add(0.5);
            //value.addAssign(noise.mul(0.5));

            const metalness = float(value.x).oneMinus().toVar("medusaMetalness");
            const emissiveness = red.mul(value.y.oneMinus()).mul(sin(Medusa.uniforms.phase.add(positionLocal.y)).mul(0.5).add(0.5).pow(2)).toVar("medusaEmissiveness");

            const color = mix(orange,white,value.x).toVar("fragmentColor");
            color.assign(mix(red, color, value.y));
            return color;
        })();

       MedusaBellPattern.emissiveNode = Fn(() => {
            return vec3().toVar("medusaEmissiveness");
            const color = vec3().toVar("DiffuseColor");
            const projectedMousePos = cameraPosition.add(Medusa.uniforms.mouseRay.mul(cameraPosition.distance(positionWorld)));
            const delta = positionWorld.sub(projectedMousePos).toVar();
            const noise = triNoise3D(positionWorld.xyz.mul(0.1), 0.2, time).mul(3); //mx_perlin_noise_float(positionWorld).mul(0.5).add(0.5);
            const factor = delta.length().oneMinus().mul(noise).max(0.0).pow(2.0);

            return color.mul(factor);
        })();
    }
}