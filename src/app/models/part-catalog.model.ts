export type PartType = 'part' | 'material' | 'lubricant' | 'labor' | 'other';

export interface PartCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  compatibleBrands: string[];
  compatibleModels: string[];
  suggestedPrice: number;
  type: PartType;
  active: boolean;
}
