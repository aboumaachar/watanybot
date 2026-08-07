export * from "./circularsTaxonomy";
export * from "./circularsDomainAdapter";

// APEX_CIRCULARS_INDEX_COMPAT_START
export { circularTaxonomy as CIRCULAR_TAXONOMY } from './circularsTaxonomy';
export { getCircularCategoryLabelAr as getCircularTaxonomyLabelAr } from './circularsTaxonomy';
export { classifyCircularCategory as inferCircularCategory } from './circularsDomainAdapter';
// APEX_CIRCULARS_INDEX_COMPAT_END
