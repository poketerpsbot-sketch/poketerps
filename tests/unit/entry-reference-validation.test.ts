import { describe, expect, it } from "vitest";

import { assertExplicitMicronConsistency, validateDynamicFieldValue } from "@/lib/services/entries";

describe("entry reference validation", () => {
  it("rejects values outside active SELECT options", () => {
    expect(() =>
      validateDynamicFieldValue(
        { label: "État de la matière", fieldType: "SELECT", validationRules: {} },
        "invented-state",
        new Set(["cured", "fresh-frozen", "frozen", "unknown"]),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DYNAMIC_FIELD_VALUE" }));
    expect(() =>
      validateDynamicFieldValue(
        { label: "État de la matière", fieldType: "SELECT", validationRules: {} },
        "fresh-frozen",
        new Set(["cured", "fresh-frozen", "frozen", "unknown"]),
      ),
    ).not.toThrow();
  });

  it("enforces numeric rules from the configured field", () => {
    expect(() =>
      validateDynamicFieldValue(
        { label: "Poids", fieldType: "NUMBER", validationRules: { min: 0, max: 10 } },
        11,
        new Set(),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_DYNAMIC_FIELD_VALUE" }));
  });

  it("rejects divergent legacy and contextual collection microns", () => {
    expect(() =>
      assertExplicitMicronConsistency(
        {
          mode: "SINGLE",
          singleValue: 73,
          multipleValues: [],
          sourceType: "DECLARED",
        },
        [
          {
            context: "COLLECTION_SEPARATION",
            mode: "SINGLE",
            singleValue: 90,
            multipleValues: [],
            sourceType: "DECLARED",
          },
        ],
      ),
    ).toThrowError(expect.objectContaining({ code: "INCONSISTENT_MICRON_VALUES" }));
  });
});
