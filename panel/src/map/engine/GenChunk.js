
import * as THREE from 'three';

function GenChunk(xSize, zSize, worldX, worldZ) {
    var geometry = new THREE.InstancedBufferGeometry();

    var v = new THREE.BufferAttribute(new Float32Array((xSize + 1) * (zSize + 1) * 4 * 4), 4);
    var t = new THREE.BufferAttribute(new Uint16Array(xSize * zSize * 18), 1);

    function p(x, z) {
        return 4 * ((xSize + 1) * z + x);
    }

    // z
    // ^ p   p+1
    // |
    // | 3   2     7   6
    // |
    // | 0   1     4   5
    // +------------> x

    var i = 0;
    var ti = 0;
    var iUp = 0;
    for (var z = 0; z <= zSize; z++) {
        for (var x = 0; x <= xSize; x++) {
            //index = p(x, z);
            v.setXYZW(i, x * 100, 50, z * 100, 50);
            v.setXYZW(i + 1, x * 100 + 100, -50, z * 100, 50);
            v.setXYZW(i + 2, x * 100 + 100, -50, z * 100 + 100, -50);
            v.setXYZW(i + 3, x * 100, 50, z * 100 + 100, -50);

            if (x < xSize && z < zSize) {
                t.setXYZ(ti, i + 0, i + 2, i + 1);
                t.setXYZ(ti + 3, i + 0, i + 3, i + 2);

                //if (x < xSize) {
                t.setXYZ(ti + 6, i + 1, i + 2, i + 7);
                t.setXYZ(ti + 9, i + 1, i + 7, i + 4);
                //}

                //if (z + 1 < zSize) {
                iUp = p(x, z + 1);
                t.setXYZ(ti + 12, i + 2, i + 3, iUp);
                t.setXYZ(ti + 15, i + 2, iUp, iUp + 1);
                //}
                ti += 18;
            }
            i += 4;
        }
    }

    geometry.setIndex(t);
    geometry.setAttribute('position', v);

    let d = Math.round(worldX / xSize);
    let instances = d * d;
    let o = new THREE.InstancedBufferAttribute(new Float32Array(instances * 3), 3, true);
    i = 0;

    for (z = 0; z < d; z++) {
        for (x = 0; x < d; x++) {
            o.setXYZ(i++, (x * xSize * 100) - (worldX * 50), 0.001, (z * zSize * 100) - (worldZ * 50));
        }
    }

    geometry.setAttribute("translate", o);
    // threejs isn't setting this for some reason and nothing renders w/o it
    geometry.instanceCount = instances;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), worldX * 1000);

    return geometry;
}

export default GenChunk;
