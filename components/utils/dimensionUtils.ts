import { useMemo } from "react";
import { Quirk } from "@uniformdev/context/api";
import { DimensionDefinition } from "../hooks/useDimensionsAndQuirks";

export interface DimensionMenuOption {
  label: string;
  value: string;
  original: DimensionDefinition | Quirk;
  indented?: boolean;
}

export interface GroupedOption {
  label: string;
  options: DimensionMenuOption[];
}

// Utility function to group dimensions and quirks
export const useGroupedDimensionsAndQuirks = (
  dimensions: DimensionDefinition[] = [],
  quirks: Quirk[] = []
): (DimensionMenuOption | GroupedOption)[] => {
  return useMemo(() => {
    const groups: { [key: string]: DimensionMenuOption[] } = {
      Signal: [],
      Audience: [],
      Intent: [],
      Enrichment: [],
      Quirk: [],
    };

    // Group dimensions by type
    dimensions.forEach((dim) => {
      const groupName = dim.type.charAt(0).toUpperCase() + dim.type.slice(1);
      if (groups[groupName]) {
        groups[groupName].push({
          label: dim.name,
          value: dim.id,
          original: dim,
        });
      }
    });

    // Add quirks to Quirk group
    quirks.forEach((quirk) => {
      groups.Quirk.push({
        label: quirk.name || quirk.id,
        value: quirk.id,
        original: quirk,
      });
    });

    // Convert to grouped options format, filtering out empty groups
    const result: (DimensionMenuOption | GroupedOption)[] = [];
    
    Object.entries(groups).forEach(([groupName, options]) => {
      if (options.length > 0) {
        result.push({
          label: groupName,
          options,
        });
      }
    });

    return result;
  }, [dimensions, quirks]);
};
