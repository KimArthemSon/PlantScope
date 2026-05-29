// @/utils/layerCodes.ts
export const LAYER_CODE_MAP: Record<string, Record<string, string>> = {
  meta_data: {
    land_title: "meta_land_title",
    tax_decl: "meta_tax_decl",
    other_doc: "meta_other_doc",
  },
  safety: {
    flood: "safety_flood",
    landslide: "safety_landslide",
    erosion: "safety_erosion",
    other: "safety_other",
  },
  survivability: {
    soil: "surv_soil",
    water: "surv_water",
    animal: "surv_animal",
    slope: "surv_slope",
  },
  boundary_verification: {
    verification: "bound_verification",
  },
};

export const getStrictLayerCode = (layerId: string, subCategory?: string): string => {
  return LAYER_CODE_MAP[layerId]?.[subCategory || "other"] || `${layerId}_other`;
};

export const VALID_IMAGE_LAYERS = Object.values(LAYER_CODE_MAP).flatMap(Object.values);