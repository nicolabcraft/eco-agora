
import * as THREE from 'three';
import Base64 from './Base64';


// Now it's constructor and can't be called with old "THREE.Texture.call(this", therefore should be extended
class PlotMap extends THREE.Texture {
    constructor(width, height, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, format) {
        //if ( type === undefined && format === THREE.DepthFormat ) type = THREE.UnsignedShortType;
        //if ( type === undefined && format === THREE.DepthStencilFormat ) type = THREE.UnsignedInt248Type;
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        super(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);

        this.ctxt = canvas.getContext('2d');
        this.ctxt.webkitImageSmoothingEnabled = false;

        this.zoneColor = "#000000";
        this.ctxt.fillStyle = this.zoneColor;
        this.ctxt.strokeStyle = this.zoneColor;
        this.ctxt.miterLimit = 0;
        this.ctxt.lineJoin = "bevel";
        this.erasing = false;

        this.plotSize = 1;

        this.magFilter = magFilter !== undefined ? magFilter : THREE.NearestFilter;
        this.minFilter = minFilter !== undefined ? minFilter : THREE.NearestFilter;

        this.generateMipmaps = false;
        this.Reset();
        this.lastData = this.ctxt.getImageData(0, 0, this.image.width, this.image.height);
    }

    SetColor(color) {
        this.zoneColor = color;
        this.ctxt.fillStyle = color;
        this.ctxt.strokeStyle = color;
    }

    SetPixel(vec, size = 1) {
        this.ctxt.fillRect(vec.x - size, vec.y - size, 1 + size * 2, 1 + size * 2);
        this.ctxt.beginPath();
        this.ctxt.moveTo(vec.x + 0.5, vec.y + 0.5);
        this.needsUpdate = true;
    }

    // canvas lineto uses anti-aliasing that sets incorrect district IDs... using Bresenham line drawing instead
    DrawLine(start, end, size = 1) {
        if (start.distanceTo(end) > this.image.width / 2) {
            // TODO: figure out the right direction and do some wrapping or draw 2 line segments
            this.SetPixel(end, size);
        } else {
            var vec = start.clone();
            var dx = Math.abs(end.x - vec.x);
            var dy = Math.abs(end.y - vec.y);
            var sx = (vec.x < end.x) ? 1 : -1;
            var sy = (vec.y < end.y) ? 1 : -1;
            var err = dx - dy;
            const tr = true;

            while (tr) {
                this.SetPixel(vec, size);

                if ((vec.x == end.x) && (vec.y == end.y)) break;
                var e2 = 2 * err;
                if (e2 > -dy) { err -= dy; vec.x += sx; }
                if (e2 < dx) { err += dx; vec.y += sy; }
            }
        }
    }

    SetRect(a, b) {
        this.mask[a.x + a.y * this.width / 5] = 255;
        var min = new THREE.Vector2((a.x < b.x) ? a.x : b.x, (a.y < b.y) ? a.y : b.y);
        var size = new THREE.Vector2(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

        this.ctxt.fillRect(5 * min.x + 2.5, 5 * min.y + 2.5, size.x * 5, size.y * 5);
        this.needsUpdate = true;
    }

    SetEraseMode(x) {
        this.erasing = x;
        if (this.erasing) {
            this.ctxt.fillStyle = "#000000";
            this.ctxt.strokeStyle = "#000000";
        } else {
            this.ctxt.fillStyle = this.zoneColor;
            this.ctxt.strokeStyle = this.zoneColor;
        }
    }

    Reset() {
        this.ctxt.fillStyle = "#000000";
        this.ctxt.fillRect(0, 0, this.image.width, this.image.height);
        this.ctxt.fillStyle = this.zoneColor;
        this.needsUpdate = true;
    }

    AntiAntiAlias() {
        var data = this.ctxt.getImageData(0, 0, this.image.width, this.image.height);
        for (var y = 0; y < data.data.length; y++) {
            data.data[y] = data.data[y] > 128 ? 255 : 0;
        }
        this.ctxt.putImageData(data, 0, 0);
        this.ctxt.needsUpdate = true;
    }

    GetArray() {
        var data = this.ctxt.getImageData(0, 0, this.image.width, this.image.height);
        var mask = new Uint8Array(data.data.length / 4);
        //Packing to array w/ 1-byte per pixel
        for (var i = 0; i < mask.length; i++) {
            mask[i] = data.data[i * 4];
        }
        var tmp = Base64.fromByteArray(mask);
        return tmp;
    }

    LoadArray(b64MaskString) {
        // unpack to 1bpp array
        var mask = Base64.toByteArray(b64MaskString);
        var data = this.ctxt.getImageData(0, 0, this.image.width, this.image.height);

        for (var i = 0; i < mask.length; i++) {
            data.data[(i * 4)] = mask[i];
            data.data[(i * 4) + 1] = mask[i];
            data.data[(i * 4) + 1] = mask[i];
        }
        this.ctxt.putImageData(data, 0, 0);
        this.needsUpdate = true;
    }

    ApplyDistrictColors(colorsArray) {
        var data = this.ctxt.getImageData(0, 0, this.image.width, this.image.height);
        for (var i = 0; i < data.data.length; i += 4) {
            var districtOffset = data.data[i] * 4;
            for (var j = 0; j < 4; j++)
                data.data[i + j] = colorsArray[districtOffset + j];
        }
        this.ctxt.putImageData(data, 0, 0);
        this.ctxt.needsUpdate = true;
    }

    LoadDistrictMap(districtData) {
        this.metadata = districtData.DistrictMetadata;
        var colorsArray = new Uint8Array(256 * 4);
        colorsArray[0] = 255; // 0 is white / "no district"
        colorsArray[1] = 255;
        colorsArray[2] = 255;
        colorsArray[3] = 255;
        for (var i = 0; i < districtData.DistrictMetadata.length; i++) {
            var id = districtData.DistrictMetadata[i].ID;
            colorsArray[id * 4] = districtData.DistrictMetadata[i].R;
            colorsArray[id * 4 + 1] = districtData.DistrictMetadata[i].G;
            colorsArray[id * 4 + 2] = districtData.DistrictMetadata[i].B;
            colorsArray[id * 4 + 3] = 255;
        }
        if (districtData.DistrictMap != undefined)
            this.LoadArray(districtData.DistrictMap);
        this.ApplyDistrictColors(colorsArray);
    }
}

export default PlotMap;
