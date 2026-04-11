// src/types/geo-declarations.d.ts

declare module "esri-leaflet" {
  import * as L from "leaflet";
  export function basemapLayer(key: string): L.TileLayer;
  export function featureLayer(options: any): L.Layer;
}

declare module "georaster" {
  export default class GeoRaster {
    static fromArrayBuffer(buffer: ArrayBuffer): Promise<GeoRaster>;
    width: number;
    height: number;
    numberOfRasters: number;
    rasterBand: number[];
    mins: number[];
    maxes: number[];
    noDataValue: number | null;
  }
}

declare module "georaster-layer-for-leaflet" {
  import * as L from "leaflet";
  import GeoRaster from "georaster";
  
  interface GeoRasterLayerOptions {
    georaster: GeoRaster;
    opacity?: number;
    resolution?: number;
    resampleMethod?: "nearest" | "bilinear" | "cubic";
    pixelValuesToColorFn?: (values: number[]) => string;
    debugLevel?: number;
  }
  
  export default class GeoRasterLayer extends L.GridLayer {
    constructor(options: GeoRasterLayerOptions);
    getBounds(): L.LatLngBounds;
    setOpacity(opacity: number): void;
  }
}