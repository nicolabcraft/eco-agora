'use strict';

import $ from 'jquery';
import * as THREE from 'three';
import DistrictColors from './DistrictColors';
import PlotMap from './PlotMap';
import axios from 'axios';
import GIFMANAGER from './GIFMANAGER'
import GenChunk from './GenChunk'
import OrbitControls from './OrbitControls'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'

const waterAlpha = 0.6;
const waterAlphaInDistrictsMode = 0.3;

const rawFragmentShader = [
    "precision highp float;",
    "precision highp int;",
    "uniform float time;",
    "uniform vec2 resolution;",
    "uniform sampler2D map;",
    "uniform sampler2D heat;",
    "uniform sampler2D features;",
    "uniform sampler2D terrain;",
    "#ifdef DRAWING",
    "uniform sampler2D drawmap;",
    "#endif",
    "uniform vec3 tint;",
    "varying vec2 vUv;",
    "varying vec3 vColor;",
    "void main(void) {",
    "#ifdef LOOKUP",
    "    gl_FragColor = vec4(vUv, 0.0, vColor.r);",
    "#else",
    "    vec3 mColor = texture2D(map, vUv).rgb;",
    "#ifdef HEATMAP",
    "    float a = mColor.r > 0.2 ? 1.0 : (mColor.r + 0.8);",
    "    vec2 uv = vec2(mColor.r, mColor.g);",
    "    mColor = vColor - texture2D(heat, uv).rgb;",
    "#endif",
    "#ifdef FMAP",
    "    #ifdef HEATMAP",
    "    mColor = (mColor * a) + ((1.0 - a) * (vColor - (vec3(1, 1, 1) - texture2D(terrain, vUv).rgb)));",
    "    #else",
    "    mColor = vColor * mColor;",
    "    #endif",
    "    mColor = mColor * texture2D(features, vUv).rgb;",
    "#endif",
    "#ifdef DRAWING",
    "    vec4 drawing = texture2D(drawmap, vUv);",
    "    mColor = (drawing.r > 0.0) ? (vec3(1, 1, 1) - mColor) : mColor;",
    "#endif",
    "    gl_FragColor = vec4(mColor * tint, 0.1);",
    "#endif",
    "}",
    ""
].join('\n');

const curvedVertex = [
    "precision highp float;",
    "precision highp int;",
    "#define VERTEX_TEXTURES",
    "uniform mat4 modelMatrix;",
    "uniform mat4 projectionMatrix;",
    "uniform mat4 viewMatrix;",
    "uniform mat4 modelViewMatrix;",
    "uniform vec4 worldSize;",
    "uniform vec3 cameraPosition;",
    "attribute vec4 position;",
    "attribute vec3 translate;",
    "varying vec2 vUv;",
    "varying vec3 vColor;",
    "uniform sampler2D height;",
    "#ifdef LOOKUP",
    "uniform vec3 tint;",
    "#endif",
    "vec3 slerp(vec3 p0, vec3 p1, float t)",
    "{",
    "    float cosHalfTheta = dot(p0, p1);",
    "    float halfTheta = acos(cosHalfTheta);",
    "    float sinHalfTheta = sqrt(1.0 - cosHalfTheta * cosHalfTheta);",
    "    float ratioA = sin((1.0 - t) * halfTheta) / sinHalfTheta;",
    "    float ratioB = sin(t * halfTheta) / sinHalfTheta;",
    "    return p0 * ratioA + p1 * ratioB;",
    "}",
    "vec4 curveVertexFixed(vec4 vertex)",
    "{",
    "    float radius = worldSize.x / 3.14159;    vec3 center = vec3(cameraPosition.x, -radius, cameraPosition.z);",
    "    vec4 vv = modelMatrix * vertex;",
    "    if (cameraPosition.x - vv.x > worldSize.x)",
    "        vv.x = vv.x + worldSize.z;",
    "    else if (cameraPosition.x - vv.x < -worldSize.x)",
    "        vv.x = vv.x - worldSize.z;",
    "    if (cameraPosition.z - vv.z > worldSize.y)",
    "        vv.z = vv.z + worldSize.w;",
    "    else if (cameraPosition.z - vv.z < -worldSize.y)",
    "        vv.z = vv.z - worldSize.w;",
    "    vec3 toVertex = vv.xyz - center;",
    "    vec3 v1 = vec3(0, toVertex.y, 0);    vec3 xz = vec3(toVertex.x, 0, toVertex.z);",
    "    vec3 v2 = normalize(xz) * abs(toVertex.y);",
    "    float d = length(toVertex.xz);",
    "    float c = 2.0 * 3.14159 * abs(radius);",
    "    float t = clamp(d / (c / 4.0), 0.0, 2.0);",
    "    vec3 s = slerp(v1, v2, t);",
    "    vec3 expected = center + s;",
    "    vv.xyz = expected;",
    "    vv = viewMatrix*vv;",
    "    return projectionMatrix * vv;",
    "}",
    "void main()",
    "{",
    "    vec3 pos = position.xyz + translate;",
    "    vUv = (pos.xz + worldSize.xy) / worldSize.zw;",
    "#ifdef GRID",
    "    pos.y = texture2D(height, fract(vUv + position.yw / worldSize.zw)).r * 25500.0;",
    "    float y2 = texture2D(height, fract(vUv - position.yw / worldSize.zw)).r * 25500.0;",
    "    float y3 = texture2D(height, fract(vUv - vec2(position.y, -position.w) / worldSize.zw)).r * 25500.0;",
    "    float y4 = texture2D(height, fract(vUv - vec2(-position.y, position.w) / worldSize.zw)).r * 25500.0;",
    "    if (y2 > pos.y || y3 > pos.y || y4 > pos.y)",
    "        vColor = vec3(0.7, 0.7, 0.7);",
    "    else",
    "        vColor = vec3(1.0, 1.0, 1.0);",
    "#endif",
    "#ifdef FLAT",
    "#ifdef WRAP",
    "    vec4 vv = modelMatrix * vec4(pos, 1.0);",
    "    if (cameraPosition.x - vv.x > worldSize.x)",
    "        vv.x = vv.x + worldSize.z;",
    "    else if (cameraPosition.x - vv.x > worldSize.x * 0.9)",
    "        vv.y = -10000.0;",
    "    else if (cameraPosition.x - vv.x < -worldSize.x)",
    "        vv.x = vv.x - worldSize.z;",
    "    else if (cameraPosition.x - vv.x < -worldSize.x * 0.9)",
    "        vv.y = -10000.0;",
    "    if (cameraPosition.z - vv.z > worldSize.y)",
    "        vv.z = vv.z + worldSize.w;",
    "    else if (cameraPosition.z - vv.z > worldSize.y * 0.9)",
    "        vv.y = -10000.0;",
    "    else if (cameraPosition.z - vv.z < -worldSize.y)",
    "        vv.z = vv.z - worldSize.w;",
    "    else if (cameraPosition.z - vv.z < -worldSize.y * 0.9)",
    "        vv.y = -10000.0;",
    "    vec4 mvPosition = viewMatrix * vv;",
    "#else",
    "    vec4 mvPosition = viewMatrix* vec4(pos, 1.0);",
    "#endif",
    "    gl_Position = projectionMatrix * mvPosition;",
    "#else",
    "    gl_Position = curveVertexFixed(vec4(pos, 1.0));",
    "#endif",
    "}",
    ""
].join('\n');

const vertexShader = [
    "uniform vec4 worldSize;",
    "varying vec2 vUv;",
    "varying vec3 vColor;",
    "vec3 slerp(vec3 p0, vec3 p1, float t)",
    "{",
    "    float cosHalfTheta = dot(p0, p1);",
    "    float halfTheta = acos(cosHalfTheta);",
    "    float sinHalfTheta = sqrt(1.0 - cosHalfTheta * cosHalfTheta);",
    "    float ratioA = sin((1.0 - t) * halfTheta) / sinHalfTheta;",
    "    float ratioB = sin(t * halfTheta) / sinHalfTheta;",
    "    return p0 * ratioA + p1 * ratioB;",
    "}",
    "vec4 curveVertexFixed(vec4 vertex)",
    "{",
    "    float radius = worldSize.x / 3.14159;    vec3 center = vec3(cameraPosition.x, -radius, cameraPosition.z);",
    "    vec4 vv = modelMatrix * vertex;",
    "    if (cameraPosition.x - vv.x > worldSize.x)",
    "        vv.x = vv.x + worldSize.z;",
    "    else if (cameraPosition.x - vv.x < -worldSize.x)",
    "        vv.x = vv.x - worldSize.z;",
    "    if (cameraPosition.z - vv.z > worldSize.y)",
    "        vv.z = vv.z + worldSize.w;",
    "    else if (cameraPosition.z - vv.z < -worldSize.y)",
    "        vv.z = vv.z - worldSize.w;",
    "    vec3 toVertex = vv.xyz - center;",
    "    vec3 v1 = vec3(0, toVertex.y, 0);    vec3 xz = vec3(toVertex.x, 0, toVertex.z);",
    "    vec3 v2 = normalize(xz) * abs(toVertex.y);",
    "    float d = length(toVertex.xz);",
    "    float c = 2.0 * 3.14159 * abs(radius);",
    "    float t = clamp(d / (c / 4.0), 0.0, 2.0);",
    "    vec3 s = slerp(v1, v2, t);",
    "    vec3 expected = center + s;",
    "    vv.xyz = expected;",
    "    vv = viewMatrix*vv;",
    "    return projectionMatrix * vv;",
    "}",
    "void main()",
    "{",
    "    vColor = vec3(0.0, 0.0, 0.0);",
    "#ifdef FLAT",
    "#ifdef WRAP",
    "    vec4 vv = modelMatrix * vec4(position, 1.0);",
    "    if (cameraPosition.x - vv.x > worldSize.x)",
    "        vv.x = vv.x + worldSize.z;",
    "    else if (cameraPosition.x - vv.x > worldSize.x * 0.9)",
    "        vv.y = -10000.0;",
    "    else if (cameraPosition.x - vv.x < -worldSize.x)",
    "        vv.x = vv.x - worldSize.z;",
    "    else if (cameraPosition.x - vv.x < -worldSize.x * 0.9)",
    "        vv.y = -10000.0;",
    "    if (cameraPosition.z - vv.z > worldSize.y)",
    "        vv.z = vv.z + worldSize.w;",
    "    else if (cameraPosition.z - vv.z > worldSize.y * 0.9)",
    "        vv.y = -10000.0;",
    "    else if (cameraPosition.z - vv.z < -worldSize.y)",
    "        vv.z = vv.z - worldSize.w;",
    "    else if (cameraPosition.z - vv.z < -worldSize.y * 0.9)",
    "        vv.y = -10000.0;",
    "    vec4 mvPosition = viewMatrix * vv;",
    "#else",
    "    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
    "#endif",
    "    gl_Position = projectionMatrix * mvPosition;",
    "#else",
    "    gl_Position = curveVertexFixed(vec4(position, 1.0));",
    "#endif",
    "    vUv = (position.xz + worldSize.xy) / worldSize.zw;",
    "}",
    ""
].join('\n');

const fragmentShader = [
    "uniform float time;",
    "uniform float alpha;",
    "uniform vec2 resolution;",
    "uniform sampler2D map;",
    "uniform sampler2D heat;",
    "uniform sampler2D features;",
    "uniform vec3 tint;",
    "varying vec2 vUv;",
    "varying vec3 vColor;",
    "void main(void) {",
    "    gl_FragColor = vec4(tint, alpha);",
    "}",
    ""
].join('\n');

const worldLayerFragment = [
    "precision highp float;",
    "precision highp int;",
    "uniform float time;",
    "uniform vec2 resolution;",
    "uniform sampler2D renderTex;",
    "uniform sampler2D map;",
    "uniform sampler2D heat;",
    "uniform sampler2D features;",
    "uniform sampler2D terrain;",
    "uniform vec3 waterColor;",
    "#ifdef DRAWING",
    "uniform sampler2D drawmap;",
    "#endif",
    "uniform vec3 tint;",
    "varying vec2 vUv;",
    "void main(void) {",
    "    vec4 inputData = texture2D(renderTex, vUv);",
    "    vec2 uv = inputData.xy;",
    "    float underWater = inputData.z;",
    "    vec3 vColor = inputData.www ;",
    "    vec3 mColor = texture2D(map, uv).rgb;",
    "#ifdef DRAWING",
    "    vec4 drawing = texture2D(drawmap, uv);",
    "    drawing = texture2D(heat, vec2(drawing.r, 0));",
    "    mColor = vColor - (vec3(1, 1, 1) - drawing.rgb);",
    "    #ifdef FMAP",
    "        mColor = mColor * texture2D(features, uv).rgb;",
    "    #endif",
    "    vec3 c = mix(mColor * tint, vec3(0.0, 0.0, 0.1), underWater * 1);",
    "#else",
    "    #ifdef HEATMAP",
    "        float a = mColor.r > 0.2 ? 1.0 : (mColor.r + 0.8);",
    "        vec2 uv2 = vec2(mColor.r, mColor.g);",
    "    #endif",
    "    #ifdef FMAP",
    "        #ifdef HEATMAP",
    "        mColor = vColor - texture2D(heat, uv2).rgb;",
    "        mColor = (mColor * a) + ((1.0 - a) * (vColor - (vec3(1, 1, 1) - texture2D(terrain, uv).rgb)));",
    "        #else",
    "        mColor = vColor * mColor;",
    "        #endif",
    "        mColor = mColor * texture2D(features, uv).rgb;",
    "    #else",
    "        mColor = vColor * texture2D(heat, uv2).rgb;",
    "        #ifdef HEATMAP",
    "            underWater *= 1;",
    "        #endif",
    "    #endif",
    "        vec3 c = mix(mColor * tint, waterColor, underWater);",
    "#endif",
    "    gl_FragColor = vec4(c, step(0.5, inputData.w));",
    "}",
    ""
].join('\n');

const worldLayerVertex = [
    "precision highp float;",
    "uniform mat4 projectionMatrix;",
    "uniform mat4 modelViewMatrix;",
    "attribute vec2 uv;",
    "attribute vec3 position;",
    "varying vec2 vUv;",
    "void main()",
    "{",
    "    vUv = uv;",
    "    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
    "}",
    ""
].join('\n');


class EcoMap {
    initialized = false;
    zoning = false;
    zoomSetsDrawSize = false;
    drawSize = 1;
    get drawZone() {
        return this.zoning;
    };
    set drawZone(x) {
        this.setZoning(x);
    };
    get eraseMode() {
        return this.drawMap ? this.drawMap.erasing : false;
    };
    set eraseMode(x) {
        if (this.drawMap) { this.drawMap.SetEraseMode(x); }
    };
    editView?: Element | any;

    scenes: Array<THREE.Scene> = [];
    views: JQuery<HTMLElement> = $();
    canvas?: HTMLCanvasElement;
    renderer?: THREE.WebGLRenderer;
    heatMap = new THREE.TextureLoader().load('/images/heatmapinvert.png');
    featureMap?: THREE.Texture;
    drawMap?: PlotMap;
    districtMap: Array<PlotMap> = [];
    proposedDistrictMap?: PlotMap;
    districtColorLookup = new DistrictColors();

    waterMat?: THREE.ShaderMaterial;
    clock: THREE.Clock = new THREE.Clock(true);
    terrainMap?: THREE.Texture;
    worldWidth = 200;
    worldDepth = 200;
    worldHalfWidth = this.worldWidth / 2;
    worldHalfDepth = this.worldDepth / 2;
    heightMap?: THREE.Texture;
    heightHistoryLoaded = false;
    terrainHistoryLoaded = false;

    geometry?: THREE.InstancedBufferGeometry;
    geometry2?: THREE.PlaneGeometry;
    data: Float32Array = new Float32Array();

    readonly flatShaderDefines = { GRID: true, FLAT: true, WRAP: true, FMAP: true };
    readonly curveShaderDefines = { GRID: true, FMAP: true };
    readonly waterFlatShaderDefines = { FLAT: true, WRAP: true };
    readonly waterCurveShaderDefines = {};
    sharedRenderTarget;
    sharedFirstView;

    mouseX: number = 0;
    mouseY: number = 0;
    pos: THREE.Vector2 = new THREE.Vector2(0.0, 0.0);
    mouseHitWorld = false;
    plots;
    plotLookup = {};
    plotNameLookup: Array<any> = [];

    debugKeyX = false;
    debugKeyZ = false;
    mouseState = 0;
    dragStart: THREE.Vector2 = new THREE.Vector2(0.0, 0.0);
    dragPos: THREE.Vector2 = new THREE.Vector2(0.0, 0.0);

    public lastMouseScene?: THREE.Scene;

    public layerNames = [["Camas", "Camas"], ["Elk", "Elk"]];
    public waterLevel = -1;
    public serverTime = 10000.0;

    public editViewNum = 0; //think this should usually be the last?

    public layerGroups: Array<any> = [];

    public districtSuffix: string = "";

    zoneString?: string;

    serverUrl?: string;


    async init() {
        this.serverUrl = (window as any).serverUrl;

        this.terrainMap = new THREE.TextureLoader().load(`${this.serverUrl}/Layers/TerrainLatest.gif`);
        this.terrainMap.generateMipmaps = false;
        this.terrainMap.magFilter = THREE.NearestFilter;
        this.terrainMap.minFilter = THREE.NearestFilter;
        this.terrainMap.flipY = false;

        this.heatMap.generateMipmaps = false;
        this.heatMap.magFilter = THREE.LinearFilter;
        this.heatMap.minFilter = THREE.LinearFilter;

        await this.setupLayers();
        new THREE.TextureLoader().load(`${this.serverUrl}/Layers/HeightMapLatest.gif`, texture => {
            this.views = $('.view-map:visible');
            this.heightMap = texture;
            this.heightMap.generateMipmaps = false;
            this.heightMap.flipY = false;
            this.heightMap.minFilter = THREE.NearestFilter;

            if (this.views.length && this.waterLevel >= 0) this.finishInit(texture);
        });

        document.addEventListener('mousemove', (arg) => this.onDocumentMouseMove(arg), false);
        window.addEventListener('keydown', (arg) => this.onKeyDown(arg), false);
    };

    protected finishInit(hmap) {
        this.canvas = <HTMLCanvasElement>document.getElementById('c');

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0xffffff, 0);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.worldWidth = hmap.image.width;
        this.worldDepth = hmap.image.height;
        this.worldHalfWidth = this.worldWidth / 2;
        this.worldHalfDepth = this.worldDepth / 2;
        this.data = this.generateHeight(hmap);

        this.setupPlots();
        this.drawMap = new PlotMap(this.worldWidth / 5, this.worldDepth / 5);

        if (this.zoneString) {
            //TODO: enable map viewing
            this.drawMap.LoadArray(this.zoneString);
        }

        this.geometry = GenChunk(40, 40, this.worldWidth, this.worldDepth);
        this.geometry2 = new THREE.PlaneGeometry(this.worldWidth * 100, this.worldDepth * 100, 100, 100);
        this.geometry2.rotateX(-Math.PI / 2);

        this.initialized = true;

        for (let n = 0; n < this.views.length; n++) {
            this.addView(this.views[n]);
        }

        this.animate();
    }


    addView(view: Element | any) {
        view.forceUpdate = false;

        if (!view.settings) view.settings = {};
        if (undefined === view.settings.layerSelected) view.settings.layerSelected = "Terrain";
        if (undefined === view.settings.frameNum) view.settings.frameNum = -1;
        if (undefined === view.settings.heightFrameNum) view.settings.heightFrameNum = -1;
        if (undefined === view.settings.terrainFrameNum) view.settings.terrainFrameNum = -1;
        if (undefined === view.settings.timeStart) view.settings.timeStart = 0.0;
        if (undefined === view.settings.timeEnd) view.settings.timeEnd = this.serverTime;
        if (undefined === view.settings.playSpeed) view.settings.playSpeed = 0.5;
        if (undefined === view.settings.currentTime) view.settings.currentTime = this.serverTime;
        if (undefined === view.settings.flat) view.settings.flat = false;
        if (undefined === view.settings.pause) view.settings.pause = true;
        if (view.OnTimeUpdated) view.OnTimeUpdated(view.settings.currentTime);

        if (!this.initialized) this.finishInit(this.heightMap);

        const rect = view.getBoundingClientRect();

        if (view.settings.shareCamera) {
            if (this.sharedRenderTarget === undefined) {
                var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.FloatType };
                this.sharedRenderTarget = new THREE.WebGLRenderTarget(rect.width, rect.height, pars);
                this.sharedFirstView = view;
            }
            view.depthRenderTarget = this.sharedRenderTarget;
        } else {
            pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.FloatType };
            view.depthRenderTarget = new THREE.WebGLRenderTarget(rect.width, rect.height, pars);
        }

        const scene = new THREE.Scene();
        //scene.fog = new THREE.FogExp2( 0xffffff, 0.00005 );

        const uniforms2 = {
            tint: { value: new THREE.Color(1.0, 1.0, 1.0) },
            waterColor: { value: new THREE.Color(0.0, 0.3, 0.7) },
            time: { value: 1.0 },
            worldSize: { value: new THREE.Vector4(this.worldHalfWidth * 100, this.worldHalfDepth * 100, this.worldWidth * 100, this.worldDepth * 100) },
            heat: { value: this.heatMap },
            features: { value: this.featureMap },
            drawmap: { value: this.drawMap },
            terrain: { value: this.terrainMap },
            map: { value: null },
            height: { value: this.heightMap },
            renderTex: { value: view.depthRenderTarget.texture },
        };

        view.positionLookupShader = new THREE.RawShaderMaterial({
            defines: view.settings.flat ? { GRID: true, FLAT: true, WRAP: true, LOOKUP: true } : { GRID: true, LOOKUP: true },
            uniforms: uniforms2,
            vertexShader: curvedVertex,
            fragmentShader: rawFragmentShader
        });

        const layerShader = new THREE.RawShaderMaterial({
            defines: view.settings.flat ? this.flatShaderDefines : this.curveShaderDefines,
            uniforms: uniforms2,
            vertexShader: worldLayerVertex,
            fragmentShader: worldLayerFragment
        });

        layerShader.transparent = true;
        //layerShader.opacity = 0.5;
        layerShader.blending = THREE.NormalBlending;

        view.mainMat = layerShader;
        if (this.zoneString)
            view.mainMat.defines.DRAWING = true;

        if (view.settings.gradient !== undefined) {
            delete view.mainMat.defines.FMAP;
            let gradient = new THREE.TextureLoader().load(view.settings.gradient, function (texture) {
                gradient = texture;
                gradient.generateMipmaps = false;
                gradient.magFilter = THREE.LinearFilter;
                gradient.minFilter = THREE.LinearFilter;
                view.mainMat.uniforms.heat.value = gradient;
                view.mainMat.needsUpdate = true;
            });
        }

        if (view.settings.noWater !== undefined && view.settings.noWater) {
            view.mainMat.uniforms.waterColor.value = new THREE.Color(0.0, 0.0, 0.1);
        }

        this.setLayer(view.settings.layerSelected, view);

        const renderLayer = new ShaderPass(layerShader);
        renderLayer.renderToScreen = true;

        const mesh = new THREE.Mesh(this.geometry, view.positionLookupShader); //material);

        const waterUniforms = {
            tint: { value: new THREE.Color(0.0, 0.0, 1.0) },
            time: { value: 1.0 },
            worldSize: { value: new THREE.Vector4(this.worldHalfWidth * 100, this.worldHalfDepth * 100, this.worldWidth * 100, this.worldDepth * 100) },
            heat: { value: null },
            features: { value: null },
            terrain: { value: null },
            map: { value: null },
            alpha: { value: waterAlpha }
        };

        this.waterMat = new THREE.ShaderMaterial({
            defines: view.settings.flat ? this.waterFlatShaderDefines : this.waterCurveShaderDefines,
            uniforms: waterUniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
        });

        view.waterMat = this.waterMat;

        view.toggle3D = function () {
            view.settings.flat = !view.settings.flat;
            [view.mainMat, view.waterMat, view.positionLookupShader].forEach(mat => {
                if (view.settings.flat) {
                    mat.defines.FLAT = true;
                    mat.defines.WRAP = true;
                } else {
                    delete mat.defines.FLAT;
                    delete mat.defines.WRAP;
                }

                mat.needsUpdate = true;
            });
        };

        const plane = new THREE.Mesh(this.geometry2, this.waterMat);
        plane.translateY((this.waterLevel * 100.0)); //.1 from getY scaling, 100 from block size, 10 to put it on top

        //var box = new THREE.BoxBufferGeometry(500, 9000, 500, 10, 1, 10);
        //var boxMesh = new THREE.Mesh(box, waterMat);
        //scene.add(boxMesh);
        //scene.userData.selectBox = boxMesh;

        scene.add(plane);

        mesh.layers.set(2); // terrain layer
        scene.add(mesh);

        const ambientLight = new THREE.AmbientLight(0xcccccc);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(1, 1, 0.5).normalize();
        scene.add(directionalLight);

        scene.userData.view = view;
        let camera;

        if (view.camera)
            scene.userData.camera = view.camera;
        else {
            camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 1000, 400000);
            camera.position.y = this.getY(this.worldHalfWidth, this.worldHalfDepth) * 100 + 10000;
            scene.userData.camera = camera;
            view.camera = camera;
        }

        camera = scene.userData.camera;
        camera.layers.enable(2);
        // camera.zoom = .8; // zoom was too close for this new ver.

        //var renderPass = new THREE.RenderPass( scene, camera );

        //var copyPass = new ShaderPass(THREE.CopyShader);
        //copyPass.renderToScreen = true;

        view.composer = new EffectComposer(this.renderer!);
        //view.composer.addPass(renderPass);
        //view.composer.addPass(copyPass);
        view.composer.addPass(renderLayer);

        const controls = new OrbitControls(camera, view);
        controls.enableRotate = false;
        controls.mouseButtons  = { ORBIT: THREE.MOUSE.RIGHT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.LEFT };
        controls.maxDistance = this.waterLevel * 100 + this.worldWidth * 95;
        controls.minDistance = this.waterLevel * 110;
        view.camera.position.y = (controls.maxDistance + controls.minDistance) / 2;

        if (view.settings.camPos) {
            camera.position.copy(view.settings.camPos);
            controls.target.copy(view.settings.camPos); // prevent orbiting around zero
            controls.target.y = 0;
        }

        scene.userData.controls = controls;
        view.settings.camPos = camera.position;

        scene.userData.lastCamPosition = new THREE.Vector3(0, 0, 0);
        scene.userData.lastRenderPosition = new THREE.Vector3(0, -100000, 0);
        scene.userData.frameNum = 0;

        this.scenes.push(scene);

        if (this.editView == null) this.editView = view;
    }

    removeView(view) {
        if (this.scenes.length == 1 && this.scenes[0].userData.view == view)
            this.scenes = [];
        else {
            for (let i = 0; i < this.scenes.length; i++) {
                if (this.scenes[i].userData.view == view || this.scenes[i].userData.view.id == view) {
                    this.scenes[i].userData.controls.dispose();
                    this.scenes[i].userData.camera = null;
                    delete this.scenes[i];
                    this.scenes.splice(i, 1);
                    break;
                }
            }
        }
    }

    removeDeadViews() {
        for (let i = 0; i < this.scenes.length; i++) {
            if (!$.contains(document.body, this.scenes[i].userData.view)) {
                this.scenes[i].userData.controls.dispose();
                this.scenes[i].userData.camera = null;
                delete this.scenes[i];
                this.scenes.splice(i, 1);
                i--;
            }
        }
    }

    private generateHeight(hmap): Float32Array {
        var canvas = document.createElement('canvas');
        canvas.width = hmap.image.width;
        canvas.height = hmap.image.height;
        var context = canvas.getContext('2d');

        var size = hmap.image.width * hmap.image.height;
        var data = new Float32Array(size);

        if (!context) return data;
        context.drawImage(hmap.image, 0, 0);
        var imgd = context.getImageData(0, 0, hmap.image.width, hmap.image.height);
        var pix = imgd.data;

        var j = 0;
        for (var i = 0, n = pix.length; i < n; i += 4) {
            data[j++] = pix[i];
        }

        return data;
    }

    private getY(x, z): number {
        x = (x + this.worldWidth) % this.worldWidth;
        z = (z + this.worldWidth) % this.worldWidth;
        return (this.data[x + z * this.worldWidth] * 0.1) | 0;
    }

    // 4 tiles in game = 1 tile here
    private getWorldPos(position): THREE.Vector2 {
        return new THREE.Vector2(
            Math.round((this.worldHalfWidth + position.x / 100)),
            Math.round((this.worldHalfWidth - position.z / 100))
        );
    }

    private updateSize() {
        if (this.canvas) {
            const width = this.canvas.clientWidth;
            const height = this.canvas.clientHeight;

            if (this.canvas.width !== width || this.canvas.height != height) {
                this.renderer!.setSize(width, height, false);
            }
        }
    }

    private animate() {
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    private onDocumentMouseMove(event: MouseEvent) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
        //if(scenes.length < 1) return;
        //var rect = scenes[0].userData.view.getBoundingClientRect();
        //scenes[0].userData.view.OnInfoUpdated((mouseX - rect.left) + " , " + (mouseY - rect.top));
    }

    private GetFrameNum(name, frameNum, view): Number {
        if (GIFMANAGER.gifTimes[name] != undefined && GIFMANAGER.gifTimes[name].length > 0) {
            const currentTime = view.settings.currentTime;
            const myTimes = GIFMANAGER.gifTimes[name];
            const maxFrame = myTimes.length;

            if (frameNum < 0) frameNum = maxFrame - 1;

            while (frameNum < maxFrame - 1 && currentTime > myTimes[frameNum]) frameNum++;
            while (frameNum > 0 && currentTime < myTimes[frameNum]) frameNum--;
        } else if (GIFMANAGER.gifTimes[name] != undefined) {
            return 0;
        }

        return frameNum;
    }



    render() {
        this.updateSize();

        if (!this.renderer) return;

        this.renderer.setClearColor(0xffffff, 0);
        this.renderer.setScissorTest(false);
        this.renderer.clear();

        // sometimes the render gets called for one more frame after the map is destroyed, better to cancel
        if (this.canvas == null) return;

        const myRect = this.canvas.getBoundingClientRect();

        let deltaTime = this.clock.getDelta();
        if (deltaTime > 5) deltaTime = 1.0; // probably debugging

        this.scenes.forEach((scene) => {

            if (!this.renderer) return;


            var view = scene.userData.view;
            var s = view.settings;

            if (s.shareCamera && this.sharedFirstView != view) {
                s.currentTime = this.sharedFirstView.settings.currentTime;
                s.pause = this.sharedFirstView.settings.pause;
                s.playSpeed = this.sharedFirstView.settings.playSpeed;
            }

            // L'historique (relief, terrain) se chargeait seulement pendant la lecture :
            // reculer le curseur sans appuyer sur lecture n'affichait donc aucune
            // evolution. On le charge aussi des qu'on s'eloigne de l'instant present.
            var veutHistorique = !s.pause || s.currentTime < this.serverTime - 1;
            if (veutHistorique && GIFMANAGER.gifStorage["HeightMap"] === undefined) {
                GIFMANAGER.giftextures("HeightMap", () => {
                    this.heightHistoryLoaded = true;
                    GIFMANAGER.giftextures("Terrain", () => {
                        this.terrainHistoryLoaded = true;
                    });
                });
            }

            var rect = view.getBoundingClientRect();
            var cam = scene.userData.camera;

            // check if it's offscreen. If so skip it
            if (rect.bottom < 0 || rect.top > this.renderer.domElement.clientHeight ||
                rect.right < 0 || rect.left > this.renderer.domElement.clientWidth) {
                return;  // it's off screen
            }

            //textures are still not loaded
            // if (view.loading) return;

            // Viewport calcule dans le repere du canvas : l origine GL est en bas a gauche.
            // (La version d origine utilisait des offsets fixes lies a l ancienne mise en page.)
            var width = Math.max(1, Math.round(rect.width));
            var height = Math.max(1, Math.round(rect.height));
            var left = Math.round(rect.left - myRect.left);
            var bottom = Math.round(myRect.bottom - rect.bottom);

            this.renderer.setViewport(left, bottom, width, height);
            this.renderer.setScissor(left, bottom, width, height);

            if (view.lastWidth != width || view.lastHeight != height) {
                cam.aspect = width / height;
                cam.updateProjectionMatrix();
                view.forceUpdate = true;
            }

            view.lastWidth = width;
            view.lastHeight = height;

            if (isNaN(s.currentTime)) s.currentTime = 0.0;

            var materialChanged = false, heightChanged = false;
            var lastTime = s.currentTime, prevFrameNum = s.frameNum, prevHeightFrameNum = s.heightFrameNum, prevTerrainFrameNum = s.terrainFrameNum;

            if (!s.pause && s.playSpeed != 0.0) {
                s.currentTime += ((view.loading ? 0.2 : s.playSpeed) * 86400) * deltaTime;
            }

            if (s.currentTime > s.timeEnd) {
                s.currentTime = s.timeStart;
            } else if (s.currentTime < s.timeStart) {
                s.currentTime = s.timeEnd;
            }

            if (lastTime != s.currentTime || view.forceUpdate) {
                if (view.timeText)
                    view.timeText.innerText = s.currentTime / 3600.0;
                if (view.OnTimeUpdated)
                    view.OnTimeUpdated(s.currentTime);

                s.frameNum = this.GetFrameNum(s.layerSelected, s.frameNum, view);
                if (this.heightHistoryLoaded)
                    s.heightFrameNum = this.GetFrameNum("HeightMap", s.heightFrameNum, view);
                if (this.terrainHistoryLoaded)
                    s.terrainFrameNum = this.GetFrameNum("Terrain", s.terrainFrameNum, view);

                if (s.currentTime != this.serverTime && GIFMANAGER.gifStorage[s.layerSelected] == undefined) {
                    this.setLayer(s.layerSelected, view);
                }

                //Terrain have special handling
                if (s.layerSelected != "Terrain" && GIFMANAGER.gifStorage[s.layerSelected] && prevFrameNum != s.frameNum) {
                    view.mainMat.uniforms.map.value = GIFMANAGER.giftextures(s.layerSelected)[s.frameNum];
                    materialChanged = true;
                }

                if (this.heightHistoryLoaded && prevHeightFrameNum != s.heightFrameNum) {
                    view.mainMat.uniforms.height.value = GIFMANAGER.giftextures("HeightMap")[s.heightFrameNum];
                    materialChanged = true;
                    heightChanged = true;
                }

                if (s.layerSelected != "Terrain" && this.terrainHistoryLoaded && prevTerrainFrameNum != s.terrainFrameNum) {
                    view.mainMat.uniforms.terrain.value = GIFMANAGER.giftextures("Terrain")[s.terrainFrameNum];
                    materialChanged = true;
                }

                if (materialChanged)
                    view.mainMat.needsUpdate = true;
            }

            var mouseViewX = this.mouseX - rect.left;
            var mouseViewY = rect.height - (this.mouseY - rect.top);

            this.pos = this.getWorldPos(s.camPos);

            if ((mouseViewX > 0 && mouseViewY > 0 && mouseViewX < rect.width && mouseViewY < rect.height) || view.firstRender === undefined || heightChanged || view.forceUpdate) {
                view.forceUpdate = false;

                //TODO: switch to UInt8 and pack/unpack 16-bit ints
                var read = new Float32Array(4);
                this.renderer.readRenderTargetPixels(view.depthRenderTarget, mouseViewX, mouseViewY, 1, 1, read);
                this.mouseHitWorld = read[3] >= 0.7; // AO is 0.7-1.0

                if (this.mouseHitWorld) {
                    this.pos.x = Math.floor(read[0] * this.worldWidth);
                    this.pos.y = this.worldDepth - Math.floor(read[1] * this.worldDepth);
                }

                if (cam.position.distanceTo(scene.userData.lastRenderPosition) > 0.5) { //should remain valid until camera moves
                    //scene.overrideMaterial = view.positionLookupShader;
                    //cam.layers.disable(0); // disable default stuff, only show terrain
                    this.renderer.setClearColor(0x000000, 0);
                    this.renderer.clear(view.depthRenderTarget);
                    this.renderer.setRenderTarget(view.depthRenderTarget);
                    this.renderer.render(scene, cam);
                    this.renderer.setRenderTarget(null);
                    this.renderer.clear();

                    if (!this.debugKeyX) {
                        scene.overrideMaterial = null;
                        //cam.layers.enable(0);
                    }

                    scene.userData.lastRenderPosition.copy(cam.position);

                    if (view.settings.shareCamera) {
                        this.scenes.forEach(function (s) {
                            if (s.userData.view.settings.shareCamera) {
                                s.userData.lastRenderPosition.copy(cam.position);
                                s.userData.camera.position.copy(cam.position);
                            }
                        });
                    }
                }
                this.lastMouseScene = scene;
                view.firstRender = false;
            }

            if (view.OnPositionUpdated) {
                if (this.pos != view.worldPos) {
                    view.OnPositionUpdated(this.pos);
                    view.worldPos = this.pos;
                    if (view.OnInfoUpdated) {
                        var lookup = this.getPlotNum(this.pos.x, this.pos.y);
                        var plotName = "\n";
                        if (this.plotLookup[lookup] !== undefined)
                            plotName = this.plotNameLookup[this.plotLookup[lookup]];
                        if (view.plotName != plotName) {
                            view.OnInfoUpdated(plotName);
                            view.plotName = plotName;
                        }
                    }
                }
            }

            //if (debugKeyZ) {
            //cam.layers.disable(0);
            //} else {
            //cam.layers.enable(0);
            //}

            this.renderer.setClearColor(0x3c3c3c, 1); // Map Background Color
            this.renderer.setScissorTest(true);

            //if (debugKeyX) {
            //renderer.render(scene, cam);
            //} else {
            view.composer.passes[0].uniforms.renderTex.value = view.depthRenderTarget.texture;
            view.composer.setSize(width, height);
            view.composer.render(0.1);
            //}

            //if(++frameNum == GIFMANAGER.giftextures.length) frameNum = 0;
            scene.userData.lastCamPosition.copy(cam.position);
            scene.userData.controls.update();


            // shader magically wraps 1 tile around map, need to keep camera within bounds
            if (cam.position.x > this.worldHalfWidth * 100)
                cam.position.x -= this.worldWidth * 100;
            else if (cam.position.x < -this.worldHalfWidth * 100)
                cam.position.x += this.worldWidth * 100;
            if (cam.position.z > this.worldHalfDepth * 100)
                cam.position.z -= this.worldDepth * 100;
            else if (cam.position.z < -this.worldHalfDepth * 100)
                cam.position.z += this.worldDepth * 100;

            //             ssaoPass.uniforms[ 'cameraNear' ].value = cam.near;
            //             ssaoPass.uniforms[ 'cameraFar' ].value = cam.far;
            scene.userData.controls.target.copy(cam.position); // fix target to prevent insanity
            scene.userData.controls.target.y = 0;


            if (view.cameraText) {
                view.cameraText.innerText = JSON.stringify(s);
            }
            if (scene.userData.view.mapdata) {
                view.mapdata.value = JSON.stringify(s);
            }
        });
    }


    private async setupLayers() {
        const { data } = await axios.get('/map/map.json');
        if (!data) return console.log('No layers to display');

        this.layerNames = data.LayerNames;
        this.layerGroups = [];
        this.layerNames.forEach(x => {
            var category = this.layerGroups.find(y => y.category == x[2]);

            if (category == null) {
                category = { category: x[2], layers: [] };
                this.layerGroups.push(category);
            }

            category.layers.push(x);
        });

        this.layerGroups.sort((x, y) => x.category > y.category ? 1 : x.category == y.category ? 0 : -1);
        this.fillLayerSelects();

        this.waterLevel = data.WaterLevel;
        this.serverTime = data.WorldTime;
        this.districtSuffix = data.DistrictSuffix;
        this.plots = data.Plots;

        if (this.heightMap !== undefined) this.finishInit(this.heightMap);
    }



    setZoning(enabled) {
        //TODO: setup/disable drawing
        this.zoning = enabled;
        if (this.zoning) {
            this.editView.addEventListener('mousedown', this.onMouseDown, false);
            this.editView.mainMat.defines.DRAWING = true;
            this.editView.mainMat.uniforms.heat.value = this.districtColorLookup;
            this.editView.mainMat.needsUpdate = true;
            //document.getElementById('map-zonemap').appendChild(drawmap.image);
        } else {
            this.drawMap!.Reset();
            delete this.editView.mainMat.defines.DRAWING;
            this.editView.mainMat.needsUpdate = true;
            this.editView.mainMat.uniforms.heat.value = this.heatMap;
            this.editView.removeEventListener('mousedown', this.onMouseDown, false);
            //document.getElementById('map-zonemap').removeChild(drawmap.image);
        }
    };


    private onMouseDown(event) {
        if (event.button === THREE.MOUSE.RIGHT && this.mouseHitWorld) {
            this.mouseState = 1;
            this.dragStart = new THREE.Vector2(Math.floor(this.pos.x / 5), Math.floor(this.pos.y / 5));
            if (this.zoomSetsDrawSize)
                this.drawSize = Math.floor(10 * this.editView.camera.position.y / (this.worldWidth * 90));
            this.drawMap!.SetPixel(this.dragStart, this.drawSize);
            document.addEventListener('mousemove', this.onMouseMove, false);
            document.addEventListener('mouseup', this.onMouseUp, false);
        }
    }

    private onMouseMove() {
        if (this.mouseState === 1 && this.mouseHitWorld) {
            this.dragPos = new THREE.Vector2(Math.floor(this.pos.x / 5), Math.floor(this.pos.y / 5));
            if (this.dragStart != this.dragPos) {
                this.drawMap!.DrawLine(this.dragStart, this.dragPos, this.drawSize);
                this.dragStart = this.dragPos;
            }
        }
    }

    private onMouseUp() {
        if (this.mouseState !== 0) {
            this.mouseState = 0;
            document.removeEventListener('mousemove', this.onMouseMove, false);
            document.removeEventListener('mouseup', this.onMouseUp, false);
        }
    }





    private onKeyDown(event) {
        if (event.keyCode == 88) { // x
            this.debugKeyX = !this.debugKeyX;
        }
        if (event.keyCode == 90) { // x
            this.debugKeyZ = !this.debugKeyZ;
        }
    }

    GetZone() {
        if (this.drawZone)
            return this.drawMap!.GetArray();
        else
            return "";
    }

    SetZone(b64string) {
        if (this.initialized)
            this.drawMap!.LoadArray(b64string);
        else
            this.zoneString = b64string;
    }

    LoadProposedDistricts(districtData) {
        if (this.proposedDistrictMap === undefined)
            this.proposedDistrictMap = new PlotMap(this.worldWidth / 5, this.worldDepth / 5);
        if (this.proposedDistrictMap.metadata !== undefined)
            return;
        this.proposedDistrictMap.LoadDistrictMap(districtData);
        var select = $('.map-layer-select');
        var option = $('<option></option>').attr("value", "ProposedDistricts").text("ProposedDistricts");
        $(select).prepend(option);
    }

    paintDistrict(id) {
        this.drawMap!.SetColor("rgb(" + id + "," + id + "," + id + ")");
    };

    setDistrictColor(id, color) {
        this.districtColorLookup.SetDistrictColorFromStyle(id, color);
    };

    private setupPlots() {
        var tcanvas = document.createElement('canvas');
        tcanvas.width = this.worldWidth;
        tcanvas.height = this.worldDepth;
        var tctx = tcanvas.getContext('2d');
        if (tctx == null) return;
        //tctx.drawImage( tmpCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height );
        tctx.fillStyle = "#FFFFFF";
        tctx.fillRect(0, 0, tcanvas.width, tcanvas.height);
        tctx.fillStyle = "#BBBBBB";
        tctx.strokeStyle = "#555555";
        tctx.lineWidth = 2;
        //         tctx.shadowColor = "#333333";
        //         tctx.shadowBlur = 1;

        var i = 0;
        for (var prop in this.plots) {
            this.plotNameLookup[i] = prop;
            for (var p in this.plots[prop]) {
                var v = this.plots[prop][p];
                tctx.fillRect(v.x, v.y, 5, 5);
                //tctx.strokeRect(v.x,v.y,5,5);
                this.plotLookup[this.getPlotNum(v.x, v.y)] = i;
            }
            i++;
        }

        this.featureMap = new THREE.Texture(tcanvas);
        this.featureMap.minFilter = THREE.NearestFilter;
        this.featureMap.magFilter = THREE.NearestFilter;
        //texture.wrapS = THREE.RepeatWrapping;
        //texture.wrapT = THREE.RepeatWrapping;
        this.featureMap.needsUpdate = true;
        this.featureMap.flipY = true;
    }

    private getPlotNum(x, y) {
        return Math.floor(x / 5) + ((Math.floor(y / 5) * this.worldWidth) / 5);
    }



    async setLayer(layerName, viewRef = undefined) {
        const view = viewRef ? viewRef : this.scenes[this.scenes.length - 1].userData.view;
        view.settings.layerSelected = layerName;
        view.forceUpdate = true;

        //If nothing is selected let's show terrain
        layerName = layerName == "" ? "Terrain" : layerName;
        var layerInfo = this.layerNames.find(x => x[0] == layerName);
        var layerCategory = layerInfo ? layerInfo[2] : "";

        //It's difficult to see district's coloring under water with default settings, so let's make water more transporent
        if (view.waterMat) {
            view.waterMat.uniforms.alpha.value = layerCategory == this.districtSuffix ? waterAlphaInDistrictsMode : waterAlpha;
        }

        if (view.mainMat) {
            if (layerName == "Terrain") {
                view.mainMat.uniforms.map.value = this.terrainMap;
                delete view.mainMat.defines.HEATMAP;
            } else if (layerCategory == this.districtSuffix) {
                const districtMapName = layerName.toString().substring(layerName);

                if (this.districtMap[districtMapName] === undefined) {
                    this.districtMap[districtMapName] = new PlotMap(this.worldWidth / 5, this.worldDepth / 5);

                    const { data: districtData } = await axios.get(`/laws/districtmap/${districtMapName}`);
                    this.districtMap[districtMapName].LoadDistrictMap(districtData);
                }

                view.mainMat.uniforms.map.value = this.districtMap[districtMapName];
                //delete view.mainMat.defines.HEATMAP;
            } else if (layerName == "ProposedDistricts") {
                if (this.proposedDistrictMap === undefined) {
                    this.proposedDistrictMap = new PlotMap(this.worldWidth / 5, this.worldDepth / 5);
                }

                view.mainMat.uniforms.map.value = this.proposedDistrictMap;
                delete view.mainMat.defines.HEATMAP;
            } else {
                view.mainMat.defines.HEATMAP = true;

                if (GIFMANAGER.gifStorage[layerName] === undefined) {
                    view.settings.frameNum = -1;
                    view.loading = true;
                    if (view.OnInfoUpdated) view.OnInfoUpdated("Loading Layer...");

                    if (view.settings.currentTime == this.serverTime && view.settings.pause) {
                        new THREE.TextureLoader().load(`${this.serverUrl}/Layers/${layerName}Latest.gif`, texture => {
                            texture.generateMipmaps = false;
                            texture.flipY = false;
                            texture.magFilter = THREE.LinearFilter;
                            texture.minFilter = THREE.LinearFilter;
                            texture.wrapS = THREE.RepeatWrapping;
                            texture.wrapT = THREE.RepeatWrapping;
                            view.mainMat.uniforms.map.value = texture;
                            view.loading = false;
                            if (view.OnInfoUpdated) view.OnInfoUpdated("");
                        });
                    } else {
                        view.settings.currentTime = 0;
                        GIFMANAGER.giftextures(layerName, function (name) {
                            //scenes[this.editViewNum].userData.view.settings.layerSelected = name;
                            if (name == view.settings.layerSelected) {
                                view.loading = false;
                                if (view.OnInfoUpdated) view.OnInfoUpdated("");
                            }
                        }); //start fetching the texture
                    }
                }
            }
            view.mainMat.needsUpdate = true;
        }
    };

    fillLayerSelects(sell = false) {
        const sel = sell ? $(sell + ' .map-layer-select') : $('.map-layer-select');

        $.each(sel, (key, select) => {
            $.each(this.layerGroups, (key, value) => {
                const group = $('<optgroup></optgroup>').attr("label", value.category);

                $.each(value.layers, function (key, value) {
                    const option = $('<option></option>').attr("value", value[0]).text(value[1]);

                    if ($(select).attr('data-val') == value) {
                        option.attr("selected", "true");
                    }

                    $(group).append(option);
                });

                $(select).append(group);
            });
        });
    };

    private screenToWorldPos(view, viewX, viewY) {
        var read = new Float32Array(4);
        this.renderer!.readRenderTargetPixels(view.depthRenderTarget, viewX, viewY, 1, 1, read);
        var hitWorld = read[3] >= 0.7; // AO is 0.7-1.0
        if (hitWorld)
            return new THREE.Vector2(Math.floor(read[0] * this.worldWidth), this.worldDepth - Math.floor(read[1] * this.worldDepth));
        return null;
    }

    getWorldArea(view, borderSize) {
        var result = {
            min: this.screenToWorldPos(view, borderSize, borderSize),
            max: this.screenToWorldPos(view, view.lastWidth - borderSize, view.lastHeight - borderSize)
        };
        if (result.min == null || result.max == null) {
            result.min = new THREE.Vector2(0, 0);
            result.max = new THREE.Vector2(this.worldWidth - 1, this.worldDepth - 1);
        }
        return result;
    };

}

var ecoMap = new EcoMap();

export default ecoMap;
