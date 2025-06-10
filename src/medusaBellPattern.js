import {
    Fn,
    If,
    attribute,
    varying,
    vec3,
    smoothstep,
    uv,
    float,
    min,
    mix,
    cameraPosition,
    positionWorld,
    triNoise3D,
    time,
    sin,
    positionLocal,
    atan,
    modelWorldMatrixInverse,
    vec4,
    cross,
    dFdx, dFdy, positionView, normalView,length,
    pow
} from "three/tsl";
import {Medusa} from "./medusa";

export class MedusaBellPattern {
    static createColorNode() {
        MedusaBellPattern.metalness = float(0).toVar("medusaMetalness")
        MedusaBellPattern.emissiveness = vec3(0).toVar("medusaEmissiveness")

        const pattern = Fn(() => {
            const result = vec3(1).toVar();
            const vUv = uv() * 0.8;
            const d = vUv.length();

            /*** lines ***/
            const azimuth = atan(vUv.x, vUv.y);
            const a = (((azimuth / Math.PI) * 4) % 0.5 - 0.25).toVar();
            const noise = triNoise3D(vec3(uv() * 0.6, 1.34), 0.5, time).toVar(); //mx_perlin_noise_float(vUv.mul(6));
            result.z.assign(noise);

            noise.assign(noise * 3.0 - 1.0);


            /*const viewPosdx = dFdx(positionView);
            const viewPosdy = dFdy(positionView);
            const adx = dFdx(a.abs()).div(viewPosdx.length());
            const ady = dFdy(a.abs()).div(viewPosdy.length());
            const ad = adx.mul(viewPosdx.z.div(viewPosdx.length())).add(ady.mul(viewPosdy.z.div(viewPosdy.length()))).mul(0.2);*/

            //a.assign(a.abs());
            const lineNoise = noise * 0.1 * (1.0 - smoothstep(0.23, 0.25, a.abs()));
            a.addAssign(lineNoise);
            const fade0 = smoothstep(0.2, 0.25, d);
            a.mulAssign(fade0);
            const fade1 = 1.0 - smoothstep(0.6, 0.85, d);
            a.mulAssign(fade1);

            const line = smoothstep(0.02,0.08,a.abs());
            const lineRed = smoothstep(0.0,0.02,a.abs());

            const fade2 = smoothstep(0.80, 0.96, d + noise * 0.03);
            const fade2red = smoothstep(0.65, 0.85, d + noise * 0.03);
            const innerCircle = 1.0 - smoothstep(0.15, 0.2, d);

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

            const circlesFade = 1.0 - smoothstep(0.90, 1.0, d + noise * 0.05);
            result.x.assign(min(result.x,circlesFade));

            /*** speckles ***/
            const specklesNoiseRaw = triNoise3D(vec3(uv() * 0.1, 12.34), 0, 0);
            result.z.assign(noise);
            const specklesNoise = smoothstep(0.0, 0.4, specklesNoiseRaw);
            //const specklesNoiseRed = smoothstep(0.05, 0.1, specklesNoiseRaw);
            const specklesFade = smoothstep(0.7, 0.9, d);
            const specklesFade2 = 1.0 - smoothstep(0, 0.2, d);
            const speckles = specklesNoise.max(specklesFade).max(specklesFade2);
            //const specklesRed = specklesNoiseRed.max(specklesFade).max(specklesFade2);
            result.x.assign(min(result.x, speckles));

            return result;
        });

        const vEmissive = varying(float(0), "v_MedusaEmissive");

        MedusaBellPattern.colorNode = Fn(() => {
            const value = pattern().toVar();
            const noise = value.z.mul(0.2).toVar();
            const white = vec3(1,0.7,0.3) - noise;
            const orange = vec3(1,0.5,0.1) - noise;
            const red = vec3(1,0.2,0.1) - noise;

            //const noise = mx_perlin_noise_float(uv().mul(8)).mul(0.5).add(0.5);
            //value.addAssign(noise.mul(0.5));

            MedusaBellPattern.metalness.assign(1.0 - value.x);
            MedusaBellPattern.emissiveness.assign(red * (1.0 - value.y) * pow(sin(Medusa.uniforms.phase + positionLocal.y) * 0.5 + 0.5, 10) * 2);
            MedusaBellPattern.emissiveness.addAssign(red * value.y * 0.105);

            const color = mix(orange,white,value.x).toVar("fragmentColor");
            color.assign(mix(red, color, value.y));

            //MedusaBellPattern.emissiveness.addAssign(vec3(0,0,1) * Medusa.uniforms.charge * 0.3);

            /*** inner glow **/
            MedusaBellPattern.emissiveness.addAssign(orange * vEmissive);

            return color;
        })();

        MedusaBellPattern.emissiveNode = MedusaBellPattern.emissiveness;
    }
}