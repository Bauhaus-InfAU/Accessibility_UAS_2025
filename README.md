# Accessibility Analysis Builder

An interactive web application for exploring spatial accessibility analysis through distance decay functions. Built for university students learning about urban accessibility in spatial planning courses.

**Live Demo**: [bauhaus-infau.github.io/Accessibility_UAS_2025](https://bauhaus-infau.github.io/Accessibility_UAS_2025/)

## Overview

Students define a custom distance decay function *f(d)* graphically, then see how it affects accessibility scores visualized on a 3D city model of Weimar, Germany. The accessibility score for each location *i* is:

```
Acc_i = Σ Att_j × f(d_ij)
```

Where **Att_j** is the attractivity of amenity *j*, **f(d_ij)** is the user-defined decay function, and **d_ij** is the shortest path distance via the street network.

![Overview of all features: the built-in tutorial walks through map interaction, curve editing, three analysis modes, accessibility explorer, and distance measurement tools](docs/screenshots/Reel%20v2_Tutorial_26-02-12.gif)
*A built-in 9-step tutorial guides you through all features — click the help icon to start.*

## Features

### Three Analysis Modes

Switch between modes using the toolbar on the right side of the map.

**Buildings Mode** — Calculate accessibility for individual buildings based on proximity to 14 predefined amenity types (Retail, Education, Health, etc.) or user-placed custom pins.

![Demo of Buildings mode: selecting amenity types, toggling residential filter, and viewing color-coded accessibility scores on 3D building extrusions](docs/screenshots/Reel%20v2_Buildings%20Mode%20Settings_26-02-12.gif)
*Selecting amenity types and analysis scope — buildings are colored from purple (low) to red (high) accessibility.*

**Grid Mode** — Visualize accessibility on a hexagonal grid, independent of buildings. Place custom amenity points and adjust hexagon size (10-100m) for different levels of detail.

![Demo of Grid mode: placing custom amenity attractors on the map and adjusting hexagon grid size, with hexagons colored by accessibility score](docs/screenshots/Reel%20v2_Grid%20Mode%20Settings_26-02-12.gif)
*Placing custom amenities and adjusting hexagon resolution — smaller hexagons reveal finer spatial patterns.*

**Surface Mode** — Display accessibility as a 3D terrain surface where height represents scores. Includes contour lines, street network overlay, and configurable smoothing and height parameters.

![Demo of Surface mode: a 3D terrain rises where accessibility is high, with contour lines and a street network draped over the surface](docs/screenshots/Reel%20v2_Surface%20Mode%20Settings_26-02-12.gif)
*Adjusting terrain smoothing and height — peaks represent areas with the highest accessibility scores.*

### Distance Decay Function Builder

Define how the utility of an amenity decreases with distance using three curve modes:

- **Custom** — Drag control points on a polyline to shape any curve. Includes presets (Exponential, Power, Linear, Step, Constant). Double-click to add points, right-click to remove.
- **Negative Exponential** — *f(d) = e^(-α·d)* with adjustable decay rate α.
- **Exponential Power** — *f(d) = e^{-(d/b)^c}* with adjustable scale *b* and shape *c*.

![Demo of the curve editor: dragging control points to reshape the decay curve, switching between Custom, Negative Exponential, and Exponential Power tabs, and applying presets](docs/screenshots/Reel%20v2_DDF%20Plot%20Tools_26-02-12.gif)
*Shaping the distance decay function — drag points on the Custom tab or switch to mathematical functions with adjustable coefficients.*

### Euclidean vs Network Distance

Toggle between network distance (shortest path via streets) and straight-line Euclidean distance for all accessibility calculations. The distance mode affects buildings, grid, and surface analysis.

![Demo of toggling between Network and Euclidean distance modes, showing how accessibility patterns change when switching from street-following paths to straight-line distances](docs/screenshots/Reel%20v2_Euclidian%20vs%20Netowork_26-02-12.gif)
*Switching between network and Euclidean distance — notice how the spatial pattern of scores shifts.*

### Accessibility Explorer

Place a flag on the map to inspect how a point's accessibility score is calculated. Shows paths to all amenities with their distances and decay values.

![Demo of the Accessibility Explorer: placing a flag on the map and seeing paths radiate to nearby amenities, each labeled with distance and decay value](docs/screenshots/Reel%20v2_Accessibility%20Explorer_26-02-12.gif)
*Inspecting a location's score — paths show the distance and decay contribution from each amenity.*

### Distance Measurement Tool

Compare network distance (via streets) against straight-line (Euclidean) distance between any two points. The solid purple line shows the network path; the dashed yellow line shows the direct distance.

![Demo of the Distance Measurement Tool: placing two points on the map and comparing the solid purple network path against the dashed yellow Euclidean line, with distance labels](docs/screenshots/Reel%20v2_Distance%20Measurement%20Tool_26-02-12.gif)
*Comparing network vs. Euclidean distance — the solid line follows streets, the dashed line goes straight.*

### Score Filtering

Click and drag on the gradient bar in the legend to highlight buildings or hexagons within a specific score range. Elements outside the range are greyed out.

![Demo of Score Filtering: clicking and dragging on the legend gradient bar to select a score range, greying out buildings outside the range](docs/screenshots/Reel%20v2_Filter_26-02-12.gif)
*Dragging on the gradient bar to filter — only buildings within the selected score range stay colored.*

### Adaptive & Fixed Range

Choose between Adaptive (data-driven) and Fixed (user-defined) gradient ranges. Switching to Fixed copies the current adaptive values as initial bounds, which can then be edited manually.

![Demo of Adaptive vs Fixed gradient range: switching between data-driven and user-defined min/max values in the legend, then manually editing the fixed bounds](docs/screenshots/Reel%20v2_Adaptive%20and%20Fixed%20Range_26-02-12.gif)
*Switching to Fixed range locks the color scale — useful for comparing scenarios with a consistent baseline.*

## Tech Stack

- **TypeScript + React + Vite** — Application framework
- **MapLibre GL JS** — 3D building rendering and map interaction
- **Three.js** — Terrain mesh visualization (custom MapLibre layer)
- **Tailwind CSS** — Styling and responsive design
- **Web Worker** — Dijkstra shortest path precomputation

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/Bauhaus-InfAU/Accessibility_UAS_2025.git
cd Accessibility_UAS_2025
npm install
npm run dev
```

Once running, click the **?** help icon in the app to launch a 9-step interactive tutorial that walks through all features.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Data

The application uses GeoJSON data from Weimar, Germany:
- 4,316 buildings with land use classifications
- 1,183 street network segments
- 14 predefined amenity types

## License

CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial)

## Author

**Martin Bielik**

### Collaborators

- Egor Gaydukov

## Partners

In partnership with:
- [Bauhaus-Universität Weimar — Chair Informatics in Architecture and Urbanism](https://www.uni-weimar.de/en/architecture-and-urbanism/chairs/infau/news/)
- [DecodingSpaces](https://decodingspaces.de/)

## Acknowledgments

Adapted from [Bauhaus-InfAU/weimar-web](https://github.com/Bauhaus-InfAU/weimar-web) (data only)
