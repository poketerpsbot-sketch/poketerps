import { describe, expect, it } from "vitest";

import {
  formatDynamicFieldValue,
  isGenericDynamicFieldLabel,
  prepareDynamicFieldDisplay,
} from "@/components/entries/entry-detail-fields";

describe("entry detail dynamic fields", () => {
  it("keeps real business labels from the field definition", () => {
    const result = prepareDynamicFieldDisplay([
      { id: "1", label: "Producteur déclaré", value: "Terps army" },
      { id: "2", label: "Variété déclarée", value: "Grape Gaz" },
    ]);

    expect(result.labeledFields).toEqual([
      { id: "1", label: "Producteur déclaré", value: "Terps army", unit: undefined },
      { id: "2", label: "Variété déclarée", value: "Grape Gaz", unit: undefined },
    ]);
    expect(result.declaredValues).toEqual([]);
  });

  it("groups legacy generic labels under one readable section", () => {
    const result = prepareDynamicFieldDisplay([
      { label: "Caractéristique 1", value: "Grape Gaz" },
      { label: "Caractéristique 2", value: "Terps army" },
      { label: "Caractéristique 3", value: "hash" },
      { label: "Caractéristique 4", value: "hash" },
    ]);

    expect(result.labeledFields).toEqual([]);
    expect(result.declaredValues).toEqual(["Grape Gaz", "Terps army", "hash"]);
  });

  it("omits empty values and values already shown elsewhere", () => {
    const result = prepareDynamicFieldDisplay(
      [
        { label: "Texture", value: "" },
        { label: "Matière de départ", value: "Hash Rosin" },
        { label: "Caractéristique 1", value: "hash rosin" },
        { label: "Caractéristique 2", value: "  Grape Gaz  " },
      ],
      ["Hash Rosin"],
    );

    expect(result.labeledFields).toEqual([]);
    expect(result.declaredValues).toEqual(["Grape Gaz"]);
  });

  it("normalizes boolean and list values for display only", () => {
    expect(formatDynamicFieldValue(true)).toBe("Oui");
    expect(formatDynamicFieldValue(["fuel", "chimique"])).toBe("fuel, chimique");
    expect(isGenericDynamicFieldLabel("Caractéristique 3")).toBe(true);
    expect(isGenericDynamicFieldLabel("Producteur déclaré")).toBe(false);
  });
});
