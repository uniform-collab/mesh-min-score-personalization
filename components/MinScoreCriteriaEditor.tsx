"use client";

import React, { useMemo } from "react";
import { Input, useMeshLocation } from "@uniformdev/mesh-sdk-react";
import { InputComboBox } from "@uniformdev/design-system";
import { useDimensions, useQuirks } from "./hooks/useDimensionsAndQuirks";
import {
  useGroupedDimensionsAndQuirks,
  DimensionMenuOption,
} from "./utils/dimensionUtils";

export interface MinScoreCriteria {
  minScore?: number;
  dim?: string;
}

interface MinScoreCriteriaEditorProps {
  // No props needed since we're using useMeshLocation internally
}

const MinScoreCriteriaEditor: React.FC<MinScoreCriteriaEditorProps> = () => {
  const { value, setValue, isReadOnly, metadata } = useMeshLocation<
    "personalizationCriteria",
    MinScoreCriteria
  >("personalizationCriteria");

  const minScore =
    typeof value?.minScore === "number" ? value.minScore : undefined;
  const dim = typeof value?.dim === "string" ? value.dim : "";

  const apiKey = process.env.NEXT_PUBLIC_UNIFORM_API_KEY || "";
  const projectId = metadata.projectId;

  // Use custom hooks to fetch data
  const { data: dimensions = [], isLoading: dimensionsLoading } = useDimensions(
    projectId,
    apiKey
  );
  const { data: quirksResponse, isLoading: quirksLoading } = useQuirks(
    projectId,
    apiKey
  );
  const quirks = quirksResponse?.quirks || [];

  // Group dimensions and quirks
  const groupedOptions = useGroupedDimensionsAndQuirks(dimensions, quirks);

  // Find the currently selected dimension/quirk
  const selectedOption = useMemo(() => {
    if (!dim) return undefined;

    const allOptions: DimensionMenuOption[] = [];
    groupedOptions.forEach((group) => {
      if ("options" in group) {
        allOptions.push(...group.options);
      }
    });

    return allOptions.find((option) => option.value === dim);
  }, [dim, groupedOptions]);

  const isLoading = dimensionsLoading || quirksLoading;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        maxWidth: "400px",
        padding: "16px",
        margin: "0 auto",
        position: "relative",
        zIndex: 1000,
      }}
    >
      <div style={{ position: "relative", zIndex: 1001 }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Dimension
        </label>
        <InputComboBox
          placeholder="Select a dimension or quirk..."
          value={selectedOption}
          options={groupedOptions}
          isLoading={isLoading}
          isDisabled={isReadOnly}
          getOptionValue={(option) => option.label}
          onChange={(selectedOption) => {
            setValue(() => ({
              newValue: {
                ...value,
                dim: selectedOption?.value || undefined,
              },
            }));
          }}
          styles={{
            valueContainer: (provided, state) => ({
              ...provided,
              padding: "var(--spacing-sm)",
            }),
          }}
        />
      </div>
      <Input
        type="number"
        label="Minimum score required"
        placeholder="e.g. 10"
        value={typeof minScore === "number" ? String(minScore) : ""}
        onChange={(e) =>
          setValue(() => ({
            newValue: {
              ...value,
              minScore: e.currentTarget.value
                ? Number(e.currentTarget.value)
                : undefined,
            },
          }))
        }
        disabled={isReadOnly}
      />
    </div>
  );
};

export default MinScoreCriteriaEditor;
