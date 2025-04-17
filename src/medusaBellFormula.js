import {cos, float, mix, sin, vec3, vec2, time, smoothstep, triNoise3D, Fn} from "three/tsl";

export const getBellPosition = Fn(([ phase, zenith, azimuth, bottomFactor = 0 ]) => {
    const sinAzimuth = sin(azimuth).toVar();
    const cosAzimuth = cos(azimuth).toVar();
    const zenithNoise = triNoise3D(vec3(sinAzimuth * 0.02, cosAzimuth * 0.02, 12.69), 0.2, time) * 6.0;
    const modifiedZenith = (zenith * (zenithNoise * 0.03 + 0.9)).toVar();

    const modifiedPhase = phase.toVar();
    modifiedPhase.subAssign(mix(0.0, modifiedZenith * 0.95, modifiedZenith));
    modifiedPhase.addAssign(Math.PI * 0.5);
    const xr = (sin(modifiedPhase) * 0.3 + 1.3).toVar();

    const riffles = mix(1.0, sin(azimuth * 16.0 + 0.5*Math.PI) * 0.02 + 1.0, smoothstep(0.5,1.0,zenith));

    xr.mulAssign(riffles);
    const yr = float(1.0);
    const polarAngle = (sin(modifiedPhase + 3.0) * 0.15 + 0.5) * modifiedZenith * Math.PI;
    const result = vec3(0).toVar();
    result.x.assign(sin(polarAngle) * xr);
    result.y.assign(cos(polarAngle) * yr); //.add(yoffset));
    result.z.assign(cosAzimuth * result.x);
    result.x.assign(sinAzimuth * result.x);

    const bumpNoise = triNoise3D(vec3(sinAzimuth * modifiedZenith * 0.02, cosAzimuth * modifiedZenith * 0.02, 42.69), 0.2, time) * 6.0;
    result.addAssign(bumpNoise * 0.02);

    const mixFactor = smoothstep(0, 0.95, 1.0 - zenith) * 0.1 * bottomFactor;
    result.y.assign(mix(result.y, 0.0, mixFactor));

    return result;
});