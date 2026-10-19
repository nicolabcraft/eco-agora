
import * as THREE from 'three';


// Now it's constructor and can't be called with old "THREE.Texture.call(this", therefore should be extended
class DistrictColors extends THREE.Texture {
    constructor(type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, format) {
        var width = 256;
        var height = 1;

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        super(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);

        this.ctxt = canvas.getContext('2d');
        this.ctxt.webkitImageSmoothingEnabled = false;

        this.magFilter = magFilter !== undefined ? magFilter : THREE.NearestFilter;
        this.minFilter = minFilter !== undefined ? minFilter : THREE.NearestFilter;

        this.zoneColor = "#FFFFFF";
        this.ctxt.fillStyle = this.zoneColor;
        this.ctxt.strokeStyle = this.zoneColor;
        this.ctxt.miterLimit = 0;
        this.ctxt.lineJoin = "bevel";
        this.erasing = false;


        this.generateMipmaps = false;
        this.Reset();
        this.lastData = this.ctxt.getImageData(0, 0, this.image.width, this.image.height);
    }

    SetPixel(vec, color) {
        var id = this.ctxt.createImageData(1, 1);
        id.data[0] = color.r;
        id.data[1] = color.g;
        id.data[2] = color.b;
        id.data[3] = color.a;
        this.ctxt.putImageData(id, vec.x, vec.y);
        this.needsUpdate = true;
    }

    SetDistrictColorFromStyle(id, style) {
        this.ctxt.fillStyle = style;
        this.ctxt.fillRect(id, 0, 1, 1);
        this.needsUpdate = true;
    }

    Reset() {
        this.ctxt.fillStyle = "#FF0000";
        this.ctxt.fillRect(0, 0, this.image.width, this.image.height);
        this.ctxt.fillStyle = this.zoneColor;
        this.needsUpdate = true;
    }
}

export default DistrictColors;
