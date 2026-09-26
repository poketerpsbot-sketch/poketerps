import type { DynamicFieldValueDto } from "@/components/data/types";

export type PreparedDynamicField = {
  id?: DynamicFieldValueDto["id"];
  label: string;
  value: string;
  unit?: string | null;
};

export type DynamicFieldDisplay = {
  labeledFields: PreparedDynamicField[];
  declaredValues: string[];
};

function normalizedText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr");
}

export function isGenericDynamicFieldLabel(label: string | null | undefined) {
  return /^caracteristique(?:\s+\d+)?$/i.test(normalizedText(label ?? ""));
}

export function formatDynamicFieldValue(value: DynamicFieldValueDto["value"]) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string") return value.trim();
  return String(value);
}

export function prepareDynamicFieldDisplay(
  fields: DynamicFieldValueDto[],
  knownValues: Array<string | null | undefined> = [],
): DynamicFieldDisplay {
  const knownValueKeys = new Set(
    knownValues.map((value) => normalizedText(value ?? "")).filter(Boolean),
  );
  const labeledFields: PreparedDynamicField[] = [];
  const declaredValues: string[] = [];
  const declaredValueKeys = new Set<string>();

  for (const field of fields) {
    const value = formatDynamicFieldValue(field.value);
    const valueKey = normalizedText(value);
    if (!valueKey || knownValueKeys.has(valueKey)) continue;

    if (isGenericDynamicFieldLabel(field.label)) {
      if (!declaredValueKeys.has(valueKey)) {
        declaredValues.push(value);
        declaredValueKeys.add(valueKey);
      }
      continue;
    }

    labeledFields.push({
      id: field.id,
      label: field.label.trim(),
      value,
      unit: field.unit,
    });
  }

  return { labeledFields, declaredValues };
}
