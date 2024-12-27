import {cos, float, mix, sin, vec3, vec2, time, smoothstep, triNoise3D} from "three/tsl";
import {mx_perlin_noise_float, mx_perlin_noise_vec3} from "three/src/nodes/materialx/lib/mx_noise";

/*const noisePosX = Math.sin(azimuth) * 3;
            const noisePosY = Math.cos(azimuth) * 3;
            //zenith *= 0.90 + noise3D(noiseSeed, noisePosX, noisePosY) * 0.05;

 */
export const getBellPosition = (phase, zenith, azimuth, bottomFactor = 0) => {
    const sinAzimuth = sin(azimuth).toVar();
    const cosAzimuth = cos(azimuth).toVar();
    const zenithNoise = triNoise3D(vec3(sinAzimuth.mul(0.02), cosAzimuth.mul(0.02), 12.69), 0.2, time).mul(6.0); //mx_perlin_noise_float(vec3(sinAzimuth.mul(3), cosAzimuth.mul(3), time));
    const modifiedZenith = zenith.mul(zenithNoise.mul(0.0).add(0.9)).toVar();

    //const yoffset = sin(phase.add(2.8)).mul(0.3).mul(0);

    const modifiedPhase = phase.toVar();
    modifiedPhase.subAssign(mix(0.0, modifiedZenith.mul(0.95), modifiedZenith));
    modifiedPhase.addAssign(Math.PI * 0.5);
    const xr = sin(modifiedPhase).mul(0.3).add(1.3).toVar();

    const riffles = mix(1.0, sin(azimuth.mul(16.0).add(0.5*Math.PI)).mul(0.02).add(1.0), smoothstep(0.5,1.0,zenith));

    xr.mulAssign(riffles);
    const yr = float(1.0);
    const polarAngle = sin(modifiedPhase.add(3.0)).mul(0.15).add(0.5).mul(modifiedZenith).mul(Math.PI);
    const result = vec3(0).toVar();
    result.x.assign(sin(polarAngle).mul(xr));
    result.y.assign(cos(polarAngle).mul(yr)); //.add(yoffset));
    result.z.assign(cosAzimuth.mul(result.x));
    result.x.assign(sinAzimuth.mul(result.x));

    const noisePos = vec3(sinAzimuth.mul(modifiedZenith).mul(3.0), cosAzimuth.mul(modifiedZenith).mul(3.0), time);
    //result.addAssign(mx_perlin_noise_vec3(noisePos).mul(0.02));
    const bumpNoise = triNoise3D(vec3(sinAzimuth.mul(modifiedZenith).mul(0.02), cosAzimuth.mul(modifiedZenith).mul(0.02), 42.69), 0.2, time).mul(6.0);
    result.addAssign(bumpNoise.mul(0.02));

    const mixFactor = smoothstep(0.0, 0.95, zenith.oneMinus()).mul(0.4).mul(bottomFactor);
    result.y.assign(mix(result.y, 0.0, mixFactor));

    return result;
};
/*).setLayout( {
    name: 'getBellPosition',
    type: 'vec3',
    inputs: [
        { name: 'phase', type: 'float' },
        { name: 'zenith', type: 'float' },
        { name: 'azimuth', type: 'float' },
        { name: 'bottomFactor', type: 'float' },
    ]
} );*/

export const getGutPosition = (time, t, angle) => {
    const rim = getBellPosition(time, float(1.0), angle);
    const planePos = mix(rim.xyz, vec3(0.0, rim.y, 0.0), float(1.0).sub(t));
    const bellPos = getBellPosition(time,t,angle);
    return mix(planePos, bellPos, 0.95);
};