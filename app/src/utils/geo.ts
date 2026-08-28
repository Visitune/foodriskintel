import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature } from "geojson";

// Country name mapping from TopoJSON to our normalized names
const TOPO_NAME_MAP: Record<string, string> = {
  "United States of America": "United States",
  "United Kingdom": "United Kingdom",
  "South Korea": "South Korea",
  "Czech Republic": "Czechia",
  "Dominican Republic": "Dominican Republic",
  "Equatorial Guinea": "Equatorial Guinea",
  "Solomon Is.": "Solomon Islands",
  "Solomon Islands": "Solomon Islands",
  "El Salvador": "El Salvador",
  "Costa Rica": "Costa Rica",
  "Puerto Rico": "Puerto Rico",
  "Trinidad and Tobago": "Trinidad and Tobago",
  "Falkland Is.": "Falkland Islands",
  "South Africa": "South Africa",
  "W. Sahara": "Western Sahara",
  "Dem. Rep. Congo": "Democratic Republic of the Congo",
  "Central African Rep.": "Central African Republic",
  "S. Sudan": "South Sudan",
  "Côte d'Ivoire": "Côte d'Ivoire",
  "Eq. Guinea": "Equatorial Guinea",
  "eSwatini": "Eswatini",
  "North Macedonia": "North Macedonia",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Marshall Is.": "Marshall Islands",
  "N. Cyprus": "Northern Cyprus",
  "Somaliland": "Somalia",
  "Kosovo": "Kosovo",
};

export async function loadGeoJSON(): Promise<FeatureCollection> {
  const response = await fetch(`${import.meta.env.BASE_URL}countries-110m.json`);
  const topology: Topology = await response.json();
  
  // Convert TopoJSON to GeoJSON
  const countries = topojson.feature(
    topology,
    topology.objects.countries as GeometryCollection
  );
  
  // Normalize country names
  const features = countries.features.map((feature) => {
    const name = (feature.properties as Record<string, unknown>)?.name as string || "";
    const normalizedName = TOPO_NAME_MAP[name] || name;
    return {
      ...feature,
      properties: {
        ...(feature.properties as Record<string, unknown>),
        name: normalizedName,
        originalName: name,
      },
    };
  });
  
  return {
    type: "FeatureCollection",
    features,
  };
}

// Match our country names to GeoJSON feature names
export function findFeatureForCountry(
  geoJSON: FeatureCollection,
  countryName: string
): Feature | undefined {
  // Try exact match
  let feature = geoJSON.features.find(
    (f) => (f.properties as Record<string, unknown>)?.name === countryName
  );
  
  if (feature) return feature;
  
  // Try reverse lookup
  const reverseMap: Record<string, string> = {
    "United States": "United States of America",
    "Czechia": "Czech Republic",
  };
  
  const geoName = reverseMap[countryName] || countryName;
  feature = geoJSON.features.find(
    (f) => {
      const props = f.properties as Record<string, unknown>;
      return props?.name === geoName || props?.originalName === geoName;
    }
  );
  
  return feature;
}
