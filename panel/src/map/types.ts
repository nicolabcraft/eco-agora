/** Element DOM enrichi par le moteur de carte. */
export interface MapViewElement extends HTMLDivElement {
  settings?: {
    layerSelected: string;
    frameNum: number;
    timeStart: number;
    timeEnd: number;
    playSpeed: number;
    currentTime: number;
    flat: boolean;
    pause: boolean;
    shareCamera?: boolean;
  };
  toggle3D?: () => void;
  OnTimeUpdated?: (seconds: number) => void;
  OnInfoUpdated?: (text: string) => void;
  OnPositionUpdated?: (pos: { x: number; y: number }) => void;
}

/** [nom technique, libelle affiche, categorie] */
export type LayerTuple = [string, string, string?];

export interface LayerGroup { category: string; layers: LayerTuple[]; }

export interface MapEngine {
  initialized: boolean;
  serverTime: number;
  waterLevel: number;
  layerGroups: LayerGroup[];
  layerNames: LayerTuple[];
  init: () => Promise<void>;
  addView: (view: Element) => void;
  removeView: (view: Element) => void;
  setLayer: (layerName: string, view?: Element) => Promise<void>;
}
