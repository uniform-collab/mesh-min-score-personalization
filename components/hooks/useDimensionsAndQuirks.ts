import { useQuery } from "@tanstack/react-query";
import { CachedContextClient, Quirk } from "@uniformdev/context/api";

// Updated interface to match the actual Uniform Context API response
export interface UniformDimension {
  dim: string;
  category: "AGG" | "ENR" | "SIG";
  subcategory?: string;
  name: string;
  min: number;
  cap: number;
}

export interface DimensionDefinition {
  id: string;
  name: string;
  type: "signal" | "audience" | "intent" | "enrichment";
}

// Response structure from CachedContextClient
export interface DimensionsResponse {
  dimensions: UniformDimension[];
}

export interface QuirksResponse {
  quirks: Quirk[];
}

// Create a client factory function to ensure proper configuration per request
const createContextClient = (projectId: string, apiKey: string) => {
  return new CachedContextClient({
    apiHost: "https://uniform.app",
    apiKey,
    projectId,
  });
};

// Transform Uniform dimensions to our expected format
const transformUniformDimensions = (uniformDimensions: UniformDimension[]): DimensionDefinition[] => {
  return uniformDimensions.map((dim) => ({
    id: dim.dim,
    name: dim.name,
    type: mapCategoryToType(dim.category, dim.subcategory),
  }));
};

// Map Uniform categories to our type system
const mapCategoryToType = (category: string, subcategory?: string): "signal" | "audience" | "intent" | "enrichment" => {
  switch (category) {
    case "SIG":
      return "signal";
    case "ENR":
      return "enrichment";
    case "AGG":
      // Use subcategory to determine if it's audience or intent
      if (subcategory && subcategory.toLowerCase().includes("intent")) {
        return "intent";
      }
      return "audience";
    default:
      return "signal"; // Default fallback
  }
};

// Custom hook for dimensions
export const useDimensions = (projectId: string, apiKey: string) => {
  return useQuery({
    queryKey: ["dimensions", projectId],
    queryFn: async () => {
      const client = createContextClient(projectId, apiKey);
      try {
        const response = await client.dimensions.get() as DimensionsResponse;
        // Transform the response to our expected format
        return transformUniformDimensions(response.dimensions || []);
      } catch (error) {
        console.error("Failed to fetch dimensions from CachedContextClient:", error);
        throw error;
      }
    },
    enabled: !!projectId && !!apiKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Custom hook for quirks
export const useQuirks = (projectId: string, apiKey: string) => {
  return useQuery({
    queryKey: ["quirks", projectId],
    queryFn: async () => {
      const client = createContextClient(projectId, apiKey);
      try {
        const response = await client.quirks.get() as QuirksResponse;
        return response;
      } catch (error) {
        console.error("Failed to fetch quirks from CachedContextClient:", error);
        throw error;
      }
    },
    enabled: !!projectId && !!apiKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};
