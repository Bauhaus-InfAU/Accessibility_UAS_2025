# Changelog

## [2026-02-03] - Building Filter Toggle & Default Mode Changes

### Added
- **Building Filter Toggle**: New UI control in Buildings mode to select which buildings are analyzed
  - "Residential Only" (default): Calculate accessibility only for residential buildings
  - "All Buildings": Calculate accessibility for all buildings (excluding amenity buildings when using predefined amenity types)
- New `BuildingFilterMode` type (`'residential' | 'all'`) in `src/config/types.ts`
- New `isAnalyzed` property on building features for map styling (replaces `isResidential` for color determination)
- `buildingFilterMode` state and `setBuildingFilterMode` setter in AppContext

### Changed
- **Default analysis mode**: Changed from Grid Analysis to Building Analysis
- **Default amenity type**: Changed from "Generic Retail" to "Custom" (user-placed pins)
- Buildings mode now uses `fullNetworkMatrix` when "All Buildings" filter is selected (required because `distanceMatrix` only contains entries for residential buildings)
- Map layer styling now uses `isAnalyzed` property instead of `isResidential` for determining which buildings show accessibility gradient
- Updated `updateBuildingColors()` function to accept `buildingFilterMode` parameter

### Technical Details
- The `distanceMatrix` is precomputed only from residential building nodes for performance
- When "All Buildings" mode is selected, the system switches to `fullNetworkMatrix` which contains distances from all network nodes
- The `isAnalyzed` property is computed based on filter mode and amenity type to correctly exclude amenity buildings

## [2026-01-23] - Project Initialization

### Added
- Project specification for interactive accessibility analysis tool
- CLAUDE.md context file
- Cloned reference repository for GeoJSON data

### Rationale
Educational tool for students to understand distance decay functions and spatial accessibility.
