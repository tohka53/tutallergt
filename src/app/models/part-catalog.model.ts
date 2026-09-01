export type PartType = 'part' | 'material' | 'lubricant' | 'labor' | 'other';

export interface PartCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  compatibleBrands: string[];
  compatibleModels: string[];
  /** Lo que le cuesta al taller. En mano de obra siempre 0. */
  suggestedCost: number;
  /** Lo que se le cobra al cliente. */
  suggestedPrice: number;
  type: PartType;
  active: boolean;
}
