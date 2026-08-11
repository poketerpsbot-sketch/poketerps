"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

export type AdminCategory = {
  id: string | number;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  technicalName?: string | null;
  displayName?: string | null;
  frenchExplanation?: string | null;
  disclaimer?: string | null;
  sortOrder?: number | null;
  isVisible?: boolean;
};

export type AdminSubcategory = {
  id: string | number;
  categoryId: string | number;
  name: string;
  slug: string;
  description?: string | null;
  technicalName?: string | null;
  displayName?: string | null;
  frenchExplanation?: string | null;
  micronRequirement?: "ABSENT" | "OPTIONAL" | "REQUIRED";
  allowedMicronContexts?: Array<"COLLECTION_SEPARATION" | "PRESSING_BAG">;
  micronPresetIds?: Array<string | number>;
  sortOrder?: number | null;
  isVisible?: boolean;
};

export type AdminMicronPreset = {
  id: string | number;
  slug: string;
  context: "COLLECTION_SEPARATION" | "PRESSING_BAG";
  mode: "NONE" | "SINGLE" | "RANGE" | "MULTIPLE" | "FULL_SPECTRUM" | "MIXED";
  label: string;
  technicalName?: string | null;
  displayName?: string | null;
  frenchExplanation?: string | null;
  singleValue?: number | null;
  minimumValue?: number | null;
  maximumValue?: number | null;
  multipleValues?: number[] | null;
  sortOrder?: number | null;
  isActive?: boolean;
};

type FieldOption = {
  id: string | number;
  value: string;
  label: string;
  description?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
};

export type AdminDynamicField = {
  id: string | number;
  categoryId: string | number;
  subcategoryId?: string | number | null;
  key: string;
  label: string;
  description?: string | null;
  fieldType: string;
  unit?: string | null;
  placeholder?: string | null;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  isVisible?: boolean;
  sortOrder?: number | null;
  options?: FieldOption[];
};

type Feedback = { tone: "success" | "error"; message: string } | null;

function optionalNumber(data: FormData, key: string): number | null {
  const raw = String(data.get(key) ?? "").trim();
  return raw ? Number(raw) : null;
}

function multipleNumbers(data: FormData): number[] | null {
  const values = String(data.get("multipleValues") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
  return values.length ? values : null;
}

function MicronPresetPicker({
  presets,
  selected = [],
}: {
  presets: AdminMicronPreset[];
  selected?: Array<string | number>;
}) {
  const selectedIds = new Set(selected.map(String));
  return (
    <fieldset className="admin-micron-presets">
      <legend>Valeurs micron proposées</legend>
      <p className="field__hint">
        Seules les valeurs cochées seront proposées pour cette sous-catégorie.
      </p>
      {(["COLLECTION_SEPARATION", "PRESSING_BAG"] as const).map((context) => {
        const contextPresets = presets.filter(
          (preset) => preset.context === context && preset.isActive !== false,
        );
        if (!contextPresets.length) return null;
        return (
          <div key={context}>
            <strong>
              {context === "COLLECTION_SEPARATION" ? "Collecte / séparation" : "Sac de pressage"}
            </strong>
            <div className="admin-micron-presets__grid">
              {contextPresets.map((preset) => (
                <label className="checkbox-field" key={String(preset.id)}>
                  <input
                    type="checkbox"
                    name="micronPresetIds"
                    value={String(preset.id)}
                    defaultChecked={selectedIds.has(String(preset.id))}
                  />
                  <span>{preset.displayName || preset.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function TaxonomyAdmin({
  categories,
  subcategories,
  fields,
  micronPresets,
  secondaryError,
}: {
  categories: AdminCategory[];
  subcategories: AdminSubcategory[];
  fields: AdminDynamicField[];
  micronPresets: AdminMicronPreset[];
  secondaryError?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function create(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    body: (data: FormData) => Record<string, unknown>,
    success: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(endpoint);
    setFeedback(null);
    const result = await submitJson(endpoint, "POST", body(new FormData(form)));
    setPending("");
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.message });
      return;
    }
    form.reset();
    setFeedback({ tone: "success", message: success });
    router.refresh();
  }

  async function toggle(endpoint: string, isVisible: boolean) {
    setPending(endpoint);
    setFeedback(null);
    const result = await submitJson(endpoint, "PATCH", { isVisible: !isVisible });
    setPending("");
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.message });
      return;
    }
    setFeedback({ tone: "success", message: "Visibilité mise à jour." });
    router.refresh();
  }

  async function update(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    body: (data: FormData) => Record<string, unknown>,
    success: string,
  ) {
    event.preventDefault();
    setPending(endpoint);
    setFeedback(null);
    const result = await submitJson(endpoint, "PATCH", body(new FormData(event.currentTarget)));
    setPending("");
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.message });
      return;
    }
    setFeedback({ tone: "success", message: success });
    router.refresh();
  }

  async function updateSubcategory(event: FormEvent<HTMLFormElement>, subcategoryId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const endpoint = `/api/admin/subcategories/${encodeURIComponent(subcategoryId)}`;
    setPending(endpoint);
    setFeedback(null);
    const result = await submitJson(endpoint, "PATCH", {
      name: String(data.get("name") ?? ""),
      description: String(data.get("description") ?? "") || null,
      technicalName: String(data.get("technicalName") ?? "") || null,
      displayName: String(data.get("displayName") ?? "") || null,
      frenchExplanation: String(data.get("frenchExplanation") ?? "") || null,
      micronRequirement: String(data.get("micronRequirement") ?? "ABSENT"),
      allowedMicronContexts: data.getAll("allowedMicronContexts").map(String),
      micronPresetIds: data.getAll("micronPresetIds").map(String),
      sortOrder: Number(data.get("sortOrder") ?? 0),
    });
    setPending("");
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.message });
      return;
    }
    setFeedback({ tone: "success", message: "Sous-catégorie configurée." });
    router.refresh();
  }

  return (
    <div className="page-stack">
      {feedback && (
        <p
          className={`form-feedback${feedback.tone === "error" ? " form-feedback--error" : ""}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      {secondaryError && (
        <p className="form-feedback form-feedback--error" role="alert">
          Certaines données de taxonomie n’ont pas pu être chargées : {secondaryError}
        </p>
      )}

      <details className="content-panel admin-disclosure">
        <summary>Créer un élément de taxonomie</summary>
        <div className="admin-form-columns">
          <form
            className="form-stack"
            onSubmit={(event) =>
              create(
                event,
                "/api/admin/categories",
                (data) => ({
                  name: String(data.get("name") ?? ""),
                  technicalName: String(data.get("technicalName") ?? "") || null,
                  displayName: String(data.get("displayName") ?? "") || null,
                  frenchExplanation: String(data.get("frenchExplanation") ?? "") || null,
                  icon: String(data.get("icon") ?? "") || null,
                  description: String(data.get("description") ?? "") || null,
                  disclaimer: String(data.get("disclaimer") ?? "") || null,
                  sortOrder: Number(data.get("sortOrder") ?? 0),
                  isVisible: true,
                }),
                "Catégorie créée.",
              )
            }
          >
            <h2>Nouvelle catégorie</h2>
            <div className="field">
              <label htmlFor="category-name">Nom</label>
              <input id="category-name" name="name" required minLength={2} maxLength={120} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="category-icon">Icône</label>
                <input id="category-icon" name="icon" maxLength={24} placeholder="🌿" />
              </div>
              <div className="field">
                <label htmlFor="category-order">Ordre</label>
                <input
                  id="category-order"
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={0}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="category-description">Description</label>
              <textarea id="category-description" name="description" rows={3} maxLength={1_500} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="category-technical-name">Nom technique</label>
                <input id="category-technical-name" name="technicalName" maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="category-display-name">Nom affiché</label>
                <input id="category-display-name" name="displayName" maxLength={160} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="category-french-explanation">Explication française</label>
              <textarea
                id="category-french-explanation"
                name="frenchExplanation"
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="field">
              <label htmlFor="category-disclaimer">Avertissement éditorial</label>
              <textarea id="category-disclaimer" name="disclaimer" rows={2} maxLength={1_500} />
            </div>
            <button className="button" type="submit" disabled={pending === "/api/admin/categories"}>
              <Plus size={16} aria-hidden="true" />
              {pending === "/api/admin/categories" ? "Création…" : "Créer la catégorie"}
            </button>
          </form>

          <form
            className="form-stack"
            onSubmit={(event) =>
              create(
                event,
                "/api/admin/micron-presets",
                (data) => ({
                  slug: String(data.get("slug") ?? ""),
                  label: String(data.get("label") ?? ""),
                  displayName: String(data.get("displayName") ?? "") || null,
                  frenchExplanation: String(data.get("frenchExplanation") ?? "") || null,
                  context: String(data.get("context") ?? "COLLECTION_SEPARATION"),
                  mode: String(data.get("mode") ?? "SINGLE"),
                  singleValue: optionalNumber(data, "singleValue"),
                  minimumValue: optionalNumber(data, "minimumValue"),
                  maximumValue: optionalNumber(data, "maximumValue"),
                  multipleValues: multipleNumbers(data),
                  sortOrder: Number(data.get("sortOrder") ?? 0),
                  isActive: true,
                }),
                "Valeur micron créée.",
              )
            }
          >
            <h2>Nouvelle valeur micron</h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="micron-preset-label">Libellé</label>
                <input id="micron-preset-label" name="label" required maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="micron-preset-slug">Slug</label>
                <input
                  id="micron-preset-slug"
                  name="slug"
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="pressing-bag-90-um"
                />
              </div>
              <div className="field">
                <label htmlFor="micron-preset-context">Contexte</label>
                <select id="micron-preset-context" name="context">
                  <option value="COLLECTION_SEPARATION">Collecte / séparation</option>
                  <option value="PRESSING_BAG">Sac de pressage</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="micron-preset-mode">Type de valeur</label>
                <select id="micron-preset-mode" name="mode" defaultValue="SINGLE">
                  <option value="SINGLE">Valeur unique</option>
                  <option value="RANGE">Plage</option>
                  <option value="MULTIPLE">Valeurs multiples</option>
                  <option value="FULL_SPECTRUM">Full Spectrum</option>
                  <option value="MIXED">Mixed Micron</option>
                  <option value="NONE">Choix sans valeur / personnalisé</option>
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="micron-preset-single">Valeur unique (µm)</label>
                <input
                  id="micron-preset-single"
                  name="singleValue"
                  type="number"
                  min={1}
                  max={1000}
                />
              </div>
              <div className="field">
                <label htmlFor="micron-preset-minimum">Minimum (µm)</label>
                <input
                  id="micron-preset-minimum"
                  name="minimumValue"
                  type="number"
                  min={1}
                  max={1000}
                />
              </div>
              <div className="field">
                <label htmlFor="micron-preset-maximum">Maximum (µm)</label>
                <input
                  id="micron-preset-maximum"
                  name="maximumValue"
                  type="number"
                  min={1}
                  max={1000}
                />
              </div>
              <div className="field">
                <label htmlFor="micron-preset-multiple">Valeurs (séparées par des virgules)</label>
                <input id="micron-preset-multiple" name="multipleValues" placeholder="45, 73, 90" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="micron-preset-display">Nom affiché</label>
              <input id="micron-preset-display" name="displayName" maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="micron-preset-explanation">Explication française</label>
              <textarea id="micron-preset-explanation" name="frenchExplanation" rows={2} />
            </div>
            <div className="field">
              <label htmlFor="micron-preset-order">Ordre</label>
              <input id="micron-preset-order" name="sortOrder" type="number" defaultValue={0} />
            </div>
            <button
              className="button"
              type="submit"
              disabled={pending === "/api/admin/micron-presets"}
            >
              <Plus size={16} aria-hidden="true" />
              {pending === "/api/admin/micron-presets" ? "Création…" : "Créer la valeur micron"}
            </button>
          </form>

          <form
            className="form-stack"
            onSubmit={(event) =>
              create(
                event,
                "/api/admin/subcategories",
                (data) => ({
                  categoryId: String(data.get("categoryId") ?? ""),
                  name: String(data.get("name") ?? ""),
                  technicalName: String(data.get("technicalName") ?? "") || null,
                  displayName: String(data.get("displayName") ?? "") || null,
                  frenchExplanation: String(data.get("frenchExplanation") ?? "") || null,
                  description: String(data.get("description") ?? "") || null,
                  micronRequirement: String(data.get("micronRequirement") ?? "ABSENT"),
                  allowedMicronContexts: data.getAll("allowedMicronContexts").map(String),
                  micronPresetIds: data.getAll("micronPresetIds").map(String),
                  sortOrder: Number(data.get("sortOrder") ?? 0),
                  isVisible: true,
                }),
                "Sous-catégorie créée.",
              )
            }
          >
            <h2>Nouvelle sous-catégorie</h2>
            <div className="field">
              <label htmlFor="subcategory-category">Catégorie parente</label>
              <select id="subcategory-category" name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Choisir une catégorie
                </option>
                {categories.map((category) => (
                  <option value={String(category.id)} key={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="subcategory-name">Nom</label>
              <input id="subcategory-name" name="name" required minLength={2} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="subcategory-description">Description</label>
              <textarea
                id="subcategory-description"
                name="description"
                rows={3}
                maxLength={1_500}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="subcategory-technical-name">Nom technique</label>
                <input id="subcategory-technical-name" name="technicalName" maxLength={160} />
              </div>
              <div className="field">
                <label htmlFor="subcategory-display-name">Nom affiché</label>
                <input id="subcategory-display-name" name="displayName" maxLength={160} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="subcategory-french-explanation">Explication française</label>
              <textarea
                id="subcategory-french-explanation"
                name="frenchExplanation"
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="field">
              <label htmlFor="subcategory-micron-requirement">Politique micron</label>
              <select
                id="subcategory-micron-requirement"
                name="micronRequirement"
                defaultValue="ABSENT"
              >
                <option value="ABSENT">Absent</option>
                <option value="OPTIONAL">Facultatif</option>
                <option value="REQUIRED">Obligatoire</option>
              </select>
            </div>
            <div className="button-row">
              <label className="checkbox-field">
                <input type="checkbox" name="allowedMicronContexts" value="COLLECTION_SEPARATION" />
                <span>Collecte / séparation</span>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" name="allowedMicronContexts" value="PRESSING_BAG" />
                <span>Sac de pressage</span>
              </label>
            </div>
            <MicronPresetPicker presets={micronPresets} />
            <div className="field">
              <label htmlFor="subcategory-order">Ordre</label>
              <input
                id="subcategory-order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>
            <button
              className="button"
              type="submit"
              disabled={pending === "/api/admin/subcategories" || categories.length === 0}
            >
              <Plus size={16} aria-hidden="true" />
              {pending === "/api/admin/subcategories" ? "Création…" : "Créer la sous-catégorie"}
            </button>
          </form>

          <form
            className="form-stack"
            onSubmit={(event) =>
              create(
                event,
                "/api/admin/dynamic-fields",
                (data) => ({
                  categoryId: String(data.get("categoryId") ?? ""),
                  subcategoryId: String(data.get("subcategoryId") ?? "") || null,
                  key: String(data.get("key") ?? ""),
                  label: String(data.get("label") ?? ""),
                  fieldType: String(data.get("fieldType") ?? "TEXT"),
                  unit: String(data.get("unit") ?? "") || null,
                  isRequired: data.get("isRequired") === "on",
                  isFilterable: data.get("isFilterable") === "on",
                  isSearchable: data.get("isSearchable") === "on",
                  isVisible: true,
                  sortOrder: 0,
                }),
                "Champ dynamique créé.",
              )
            }
          >
            <h2>Nouveau champ dynamique</h2>
            <div className="field">
              <label htmlFor="field-category">Catégorie</label>
              <select id="field-category" name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Choisir une catégorie
                </option>
                {categories.map((category) => (
                  <option value={String(category.id)} key={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="field-subcategory">Sous-catégorie (optionnel)</label>
              <select id="field-subcategory" name="subcategoryId" defaultValue="">
                <option value="">Toutes les sous-catégories</option>
                {subcategories.map((subcategory) => (
                  <option value={String(subcategory.id)} key={String(subcategory.id)}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="field-key">Clé technique</label>
                <input
                  id="field-key"
                  name="key"
                  required
                  pattern="[a-z0-9_]+"
                  maxLength={80}
                  placeholder="origine"
                />
              </div>
              <div className="field">
                <label htmlFor="field-label">Libellé</label>
                <input id="field-label" name="label" required maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="field-type">Type</label>
                <select id="field-type" name="fieldType" defaultValue="TEXT">
                  <option value="TEXT">Texte court</option>
                  <option value="LONG_TEXT">Texte long</option>
                  <option value="NUMBER">Nombre</option>
                  <option value="BOOLEAN">Oui / non</option>
                  <option value="SELECT">Choix unique</option>
                  <option value="MULTI_SELECT">Choix multiple</option>
                  <option value="DATE">Date</option>
                  <option value="URL">URL</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="field-unit">Unité</label>
                <input id="field-unit" name="unit" maxLength={32} />
              </div>
            </div>
            <div className="button-row">
              <label className="checkbox-field">
                <input type="checkbox" name="isRequired" />
                <span>Obligatoire</span>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" name="isFilterable" />
                <span>Filtrable</span>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" name="isSearchable" />
                <span>Recherchable</span>
              </label>
            </div>
            <button
              className="button"
              type="submit"
              disabled={pending === "/api/admin/dynamic-fields" || categories.length === 0}
            >
              <Plus size={16} aria-hidden="true" />
              {pending === "/api/admin/dynamic-fields" ? "Création…" : "Créer le champ"}
            </button>
          </form>
        </div>
      </details>

      <details className="content-panel admin-disclosure">
        <summary>Gérer les valeurs micron existantes ({micronPresets.length})</summary>
        <div className="admin-micron-editor-list">
          {micronPresets.map((preset) => {
            const presetEndpoint = `/api/admin/micron-presets/${encodeURIComponent(String(preset.id))}`;
            return (
              <form
                className="form-stack"
                key={String(preset.id)}
                onSubmit={(event) =>
                  update(
                    event,
                    presetEndpoint,
                    (data) => ({
                      slug: String(data.get("slug") ?? ""),
                      label: String(data.get("label") ?? ""),
                      technicalName: String(data.get("technicalName") ?? "") || null,
                      displayName: String(data.get("displayName") ?? "") || null,
                      frenchExplanation: String(data.get("frenchExplanation") ?? "") || null,
                      context: String(data.get("context") ?? "COLLECTION_SEPARATION"),
                      mode: String(data.get("mode") ?? "SINGLE"),
                      singleValue: optionalNumber(data, "singleValue"),
                      minimumValue: optionalNumber(data, "minimumValue"),
                      maximumValue: optionalNumber(data, "maximumValue"),
                      multipleValues: multipleNumbers(data),
                      sortOrder: Number(data.get("sortOrder") ?? 0),
                      isActive: data.get("isActive") === "on",
                    }),
                    "Valeur micron mise à jour.",
                  )
                }
              >
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={`preset-edit-label-${preset.id}`}>Libellé</label>
                    <input
                      id={`preset-edit-label-${preset.id}`}
                      name="label"
                      required
                      defaultValue={preset.label}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-slug-${preset.id}`}>Slug</label>
                    <input
                      id={`preset-edit-slug-${preset.id}`}
                      name="slug"
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      defaultValue={preset.slug}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-context-${preset.id}`}>Contexte</label>
                    <select
                      id={`preset-edit-context-${preset.id}`}
                      name="context"
                      defaultValue={preset.context}
                    >
                      <option value="COLLECTION_SEPARATION">Collecte / séparation</option>
                      <option value="PRESSING_BAG">Sac de pressage</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-mode-${preset.id}`}>Type</label>
                    <select
                      id={`preset-edit-mode-${preset.id}`}
                      name="mode"
                      defaultValue={preset.mode}
                    >
                      <option value="SINGLE">Valeur unique</option>
                      <option value="RANGE">Plage</option>
                      <option value="MULTIPLE">Valeurs multiples</option>
                      <option value="FULL_SPECTRUM">Full Spectrum</option>
                      <option value="MIXED">Mixed Micron</option>
                      <option value="NONE">Sans valeur / personnalisé</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-single-${preset.id}`}>Valeur (µm)</label>
                    <input
                      id={`preset-edit-single-${preset.id}`}
                      name="singleValue"
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={preset.singleValue ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-min-${preset.id}`}>Minimum (µm)</label>
                    <input
                      id={`preset-edit-min-${preset.id}`}
                      name="minimumValue"
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={preset.minimumValue ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-max-${preset.id}`}>Maximum (µm)</label>
                    <input
                      id={`preset-edit-max-${preset.id}`}
                      name="maximumValue"
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={preset.maximumValue ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-multiple-${preset.id}`}>
                      Valeurs séparées par des virgules
                    </label>
                    <input
                      id={`preset-edit-multiple-${preset.id}`}
                      name="multipleValues"
                      defaultValue={preset.multipleValues?.join(", ") ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-order-${preset.id}`}>Ordre</label>
                    <input
                      id={`preset-edit-order-${preset.id}`}
                      name="sortOrder"
                      type="number"
                      defaultValue={preset.sortOrder ?? 0}
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={`preset-edit-technical-${preset.id}`}>Nom technique</label>
                    <input
                      id={`preset-edit-technical-${preset.id}`}
                      name="technicalName"
                      defaultValue={preset.technicalName ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`preset-edit-display-${preset.id}`}>Nom affiché</label>
                    <input
                      id={`preset-edit-display-${preset.id}`}
                      name="displayName"
                      defaultValue={preset.displayName ?? ""}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`preset-edit-explanation-${preset.id}`}>
                    Explication française
                  </label>
                  <textarea
                    id={`preset-edit-explanation-${preset.id}`}
                    name="frenchExplanation"
                    defaultValue={preset.frenchExplanation ?? ""}
                  />
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={preset.isActive !== false}
                  />
                  <span>Valeur active</span>
                </label>
                <button className="button button--secondary" type="submit">
                  Enregistrer la valeur micron
                </button>
              </form>
            );
          })}
        </div>
      </details>

      <section className="admin-taxonomy-grid" aria-label="Catégories configurées">
        {categories.map((category) => {
          const categorySubcategories = subcategories.filter(
            (item) => String(item.categoryId) === String(category.id),
          );
          const categoryFields = fields.filter(
            (item) => String(item.categoryId) === String(category.id),
          );
          const endpoint = `/api/admin/categories/${encodeURIComponent(String(category.id))}`;
          return (
            <article className="content-panel admin-taxonomy-card" key={String(category.id)}>
              <header>
                <div>
                  <p className="eyebrow">{category.icon || "Catégorie"}</p>
                  <h2>{category.name}</h2>
                  <code>/{category.slug}</code>
                </div>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={pending === endpoint}
                  onClick={() => toggle(endpoint, category.isVisible !== false)}
                >
                  {category.isVisible === false ? (
                    <Eye size={15} aria-hidden="true" />
                  ) : (
                    <EyeOff size={15} aria-hidden="true" />
                  )}
                  {category.isVisible === false ? "Restaurer" : "Masquer"}
                </button>
              </header>
              <p>{category.description || "Aucune description éditoriale."}</p>
              <details className="admin-taxonomy-inline-config">
                <summary>Configurer la catégorie</summary>
                <form
                  className="form-stack"
                  onSubmit={(event) =>
                    update(
                      event,
                      endpoint,
                      (data) => ({
                        name: String(data.get("name") ?? ""),
                        technicalName: String(data.get("technicalName") ?? "") || null,
                        displayName: String(data.get("displayName") ?? "") || null,
                        frenchExplanation: String(data.get("frenchExplanation") ?? "") || null,
                        icon: String(data.get("icon") ?? "") || null,
                        description: String(data.get("description") ?? "") || null,
                        disclaimer: String(data.get("disclaimer") ?? "") || null,
                        sortOrder: Number(data.get("sortOrder") ?? 0),
                      }),
                      "Catégorie mise à jour.",
                    )
                  }
                >
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`category-edit-name-${category.id}`}>Nom</label>
                      <input
                        id={`category-edit-name-${category.id}`}
                        name="name"
                        required
                        defaultValue={category.name}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`category-edit-icon-${category.id}`}>Icône</label>
                      <input
                        id={`category-edit-icon-${category.id}`}
                        name="icon"
                        defaultValue={category.icon ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`category-edit-technical-${category.id}`}>
                        Nom technique
                      </label>
                      <input
                        id={`category-edit-technical-${category.id}`}
                        name="technicalName"
                        defaultValue={category.technicalName ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`category-edit-display-${category.id}`}>Nom affiché</label>
                      <input
                        id={`category-edit-display-${category.id}`}
                        name="displayName"
                        defaultValue={category.displayName ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`category-edit-order-${category.id}`}>Ordre</label>
                      <input
                        id={`category-edit-order-${category.id}`}
                        name="sortOrder"
                        type="number"
                        defaultValue={category.sortOrder ?? 0}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`category-edit-description-${category.id}`}>Description</label>
                    <textarea
                      id={`category-edit-description-${category.id}`}
                      name="description"
                      defaultValue={category.description ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`category-edit-explanation-${category.id}`}>
                      Explication française
                    </label>
                    <textarea
                      id={`category-edit-explanation-${category.id}`}
                      name="frenchExplanation"
                      defaultValue={category.frenchExplanation ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`category-edit-disclaimer-${category.id}`}>
                      Avertissement éditorial
                    </label>
                    <textarea
                      id={`category-edit-disclaimer-${category.id}`}
                      name="disclaimer"
                      defaultValue={category.disclaimer ?? ""}
                    />
                  </div>
                  <button className="button button--secondary" type="submit">
                    Enregistrer la catégorie
                  </button>
                </form>
              </details>
              <div className="admin-taxonomy-card__section">
                <h3>Sous-catégories ({categorySubcategories.length})</h3>
                {categorySubcategories.length ? (
                  <ul className="admin-chip-list">
                    {categorySubcategories.map((subcategory) => (
                      <li key={String(subcategory.id)}>
                        <span>{subcategory.name}</span>
                        <button
                          type="button"
                          aria-label={`${subcategory.isVisible === false ? "Restaurer" : "Masquer"} ${subcategory.name}`}
                          disabled={pending === `/api/admin/subcategories/${subcategory.id}`}
                          onClick={() =>
                            toggle(
                              `/api/admin/subcategories/${encodeURIComponent(String(subcategory.id))}`,
                              subcategory.isVisible !== false,
                            )
                          }
                        >
                          {subcategory.isVisible === false ? (
                            <Eye size={14} aria-hidden="true" />
                          ) : (
                            <EyeOff size={14} aria-hidden="true" />
                          )}
                        </button>
                        <details className="admin-taxonomy-inline-config">
                          <summary>Configurer</summary>
                          <form
                            className="form-stack"
                            onSubmit={(event) => updateSubcategory(event, String(subcategory.id))}
                          >
                            <div className="field">
                              <label htmlFor={`subcategory-name-${subcategory.id}`}>Nom</label>
                              <input
                                id={`subcategory-name-${subcategory.id}`}
                                name="name"
                                required
                                defaultValue={subcategory.name}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`subcategory-description-${subcategory.id}`}>
                                Description
                              </label>
                              <textarea
                                id={`subcategory-description-${subcategory.id}`}
                                name="description"
                                defaultValue={subcategory.description ?? ""}
                              />
                            </div>
                            <div className="form-grid">
                              <div className="field">
                                <label htmlFor={`subcategory-technical-${subcategory.id}`}>
                                  Nom technique
                                </label>
                                <input
                                  id={`subcategory-technical-${subcategory.id}`}
                                  name="technicalName"
                                  defaultValue={subcategory.technicalName ?? ""}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`subcategory-display-${subcategory.id}`}>
                                  Nom affiché
                                </label>
                                <input
                                  id={`subcategory-display-${subcategory.id}`}
                                  name="displayName"
                                  defaultValue={subcategory.displayName ?? subcategory.name}
                                />
                              </div>
                            </div>
                            <div className="field">
                              <label htmlFor={`subcategory-explanation-${subcategory.id}`}>
                                Explication française
                              </label>
                              <textarea
                                id={`subcategory-explanation-${subcategory.id}`}
                                name="frenchExplanation"
                                defaultValue={subcategory.frenchExplanation ?? ""}
                              />
                            </div>
                            <div className="form-grid">
                              <div className="field">
                                <label htmlFor={`subcategory-micron-${subcategory.id}`}>
                                  Politique micron
                                </label>
                                <select
                                  id={`subcategory-micron-${subcategory.id}`}
                                  name="micronRequirement"
                                  defaultValue={subcategory.micronRequirement ?? "ABSENT"}
                                >
                                  <option value="ABSENT">Absent</option>
                                  <option value="OPTIONAL">Facultatif</option>
                                  <option value="REQUIRED">Obligatoire</option>
                                </select>
                              </div>
                              <div className="field">
                                <label htmlFor={`subcategory-order-${subcategory.id}`}>Ordre</label>
                                <input
                                  id={`subcategory-order-${subcategory.id}`}
                                  name="sortOrder"
                                  type="number"
                                  defaultValue={subcategory.sortOrder ?? 0}
                                />
                              </div>
                            </div>
                            <div className="button-row">
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  name="allowedMicronContexts"
                                  value="COLLECTION_SEPARATION"
                                  defaultChecked={subcategory.allowedMicronContexts?.includes(
                                    "COLLECTION_SEPARATION",
                                  )}
                                />
                                <span>Collecte / séparation</span>
                              </label>
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  name="allowedMicronContexts"
                                  value="PRESSING_BAG"
                                  defaultChecked={subcategory.allowedMicronContexts?.includes(
                                    "PRESSING_BAG",
                                  )}
                                />
                                <span>Sac de pressage</span>
                              </label>
                            </div>
                            <MicronPresetPicker
                              presets={micronPresets}
                              selected={subcategory.micronPresetIds}
                            />
                            <button className="button button--secondary" type="submit">
                              Enregistrer
                            </button>
                          </form>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Aucune sous-catégorie.</p>
                )}
              </div>
              <div className="admin-taxonomy-card__section">
                <h3>Champs ({categoryFields.length})</h3>
                {categoryFields.length ? (
                  <div className="admin-field-list">
                    {categoryFields.map((field) => (
                      <div key={String(field.id)}>
                        <div>
                          <strong>{field.label}</strong>
                          <span>
                            {field.fieldType}
                            {field.unit ? ` · ${field.unit}` : ""}
                          </span>
                        </div>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={pending === `/api/admin/dynamic-fields/${field.id}`}
                          onClick={() =>
                            toggle(
                              `/api/admin/dynamic-fields/${encodeURIComponent(String(field.id))}`,
                              field.isVisible !== false,
                            )
                          }
                        >
                          {field.isVisible === false ? "Restaurer" : "Masquer"}
                        </button>
                        <details className="admin-taxonomy-inline-config">
                          <summary>Configurer le champ</summary>
                          <form
                            className="form-stack"
                            onSubmit={(event) =>
                              update(
                                event,
                                `/api/admin/dynamic-fields/${encodeURIComponent(String(field.id))}`,
                                (data) => ({
                                  key: String(data.get("key") ?? ""),
                                  label: String(data.get("label") ?? ""),
                                  description: String(data.get("description") ?? "") || null,
                                  fieldType: String(data.get("fieldType") ?? "TEXT"),
                                  unit: String(data.get("unit") ?? "") || null,
                                  placeholder: String(data.get("placeholder") ?? "") || null,
                                  sortOrder: Number(data.get("sortOrder") ?? 0),
                                  isRequired: data.get("isRequired") === "on",
                                  isFilterable: data.get("isFilterable") === "on",
                                  isSearchable: data.get("isSearchable") === "on",
                                }),
                                "Champ dynamique mis à jour.",
                              )
                            }
                          >
                            <div className="form-grid">
                              <div className="field">
                                <label htmlFor={`field-edit-key-${field.id}`}>Clé technique</label>
                                <input
                                  id={`field-edit-key-${field.id}`}
                                  name="key"
                                  required
                                  pattern="[a-z][a-z0-9_]*"
                                  defaultValue={field.key}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`field-edit-label-${field.id}`}>Libellé</label>
                                <input
                                  id={`field-edit-label-${field.id}`}
                                  name="label"
                                  required
                                  defaultValue={field.label}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`field-edit-type-${field.id}`}>Type</label>
                                <select
                                  id={`field-edit-type-${field.id}`}
                                  name="fieldType"
                                  defaultValue={field.fieldType}
                                >
                                  <option value="TEXT">Texte court</option>
                                  <option value="LONG_TEXT">Texte long</option>
                                  <option value="NUMBER">Nombre</option>
                                  <option value="BOOLEAN">Oui / non</option>
                                  <option value="SELECT">Choix unique</option>
                                  <option value="MULTI_SELECT">Choix multiple</option>
                                  <option value="DATE">Date</option>
                                  <option value="URL">URL</option>
                                </select>
                              </div>
                              <div className="field">
                                <label htmlFor={`field-edit-unit-${field.id}`}>Unité</label>
                                <input
                                  id={`field-edit-unit-${field.id}`}
                                  name="unit"
                                  defaultValue={field.unit ?? ""}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`field-edit-placeholder-${field.id}`}>
                                  Exemple / aide
                                </label>
                                <input
                                  id={`field-edit-placeholder-${field.id}`}
                                  name="placeholder"
                                  defaultValue={field.placeholder ?? ""}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`field-edit-order-${field.id}`}>Ordre</label>
                                <input
                                  id={`field-edit-order-${field.id}`}
                                  name="sortOrder"
                                  type="number"
                                  defaultValue={field.sortOrder ?? 0}
                                />
                              </div>
                            </div>
                            <div className="field">
                              <label htmlFor={`field-edit-description-${field.id}`}>
                                Explication
                              </label>
                              <textarea
                                id={`field-edit-description-${field.id}`}
                                name="description"
                                defaultValue={field.description ?? ""}
                              />
                            </div>
                            <div className="button-row">
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  name="isRequired"
                                  defaultChecked={field.isRequired}
                                />
                                <span>Obligatoire</span>
                              </label>
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  name="isFilterable"
                                  defaultChecked={field.isFilterable}
                                />
                                <span>Filtrable</span>
                              </label>
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  name="isSearchable"
                                  defaultChecked={field.isSearchable}
                                />
                                <span>Recherchable</span>
                              </label>
                            </div>
                            <button className="button button--secondary" type="submit">
                              Enregistrer le champ
                            </button>
                          </form>
                        </details>
                        {["SELECT", "MULTI_SELECT"].includes(field.fieldType) && (
                          <OptionForm
                            field={field}
                            pending={pending}
                            onPending={setPending}
                            onFeedback={setFeedback}
                            onDone={() => router.refresh()}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Aucun champ dynamique.</p>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function OptionForm({
  field,
  pending,
  onPending,
  onFeedback,
  onDone,
}: {
  field: AdminDynamicField;
  pending: string;
  onPending: (value: string) => void;
  onFeedback: (value: Feedback) => void;
  onDone: () => void;
}) {
  const endpoint = `/api/admin/dynamic-fields/${encodeURIComponent(String(field.id))}/options`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    onPending(endpoint);
    onFeedback(null);
    const result = await submitJson(endpoint, "POST", {
      value: String(data.get("value") ?? ""),
      label: String(data.get("label") ?? ""),
      isActive: true,
      sortOrder: field.options?.length ?? 0,
    });
    onPending("");
    if (!result.ok) {
      onFeedback({ tone: "error", message: result.message });
      return;
    }
    form.reset();
    onFeedback({ tone: "success", message: "Option ajoutée." });
    onDone();
  }

  async function updateOption(event: FormEvent<HTMLFormElement>, option: FieldOption) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const optionEndpoint = `/api/admin/dynamic-field-options/${encodeURIComponent(String(option.id))}`;
    onPending(optionEndpoint);
    onFeedback(null);
    const result = await submitJson(optionEndpoint, "PATCH", {
      value: String(data.get("value") ?? ""),
      label: String(data.get("label") ?? ""),
      description: String(data.get("description") ?? "") || null,
      sortOrder: Number(data.get("sortOrder") ?? 0),
      isActive: data.get("isActive") === "on",
    });
    onPending("");
    if (!result.ok) {
      onFeedback({ tone: "error", message: result.message });
      return;
    }
    onFeedback({ tone: "success", message: "Option mise à jour." });
    onDone();
  }
  return (
    <div className="admin-option-editor">
      {field.options?.map((option) => {
        const optionEndpoint = `/api/admin/dynamic-field-options/${encodeURIComponent(String(option.id))}`;
        return (
          <form
            className="admin-inline-form admin-inline-form--option"
            key={String(option.id)}
            onSubmit={(event) => updateOption(event, option)}
          >
            <input
              aria-label={`Valeur technique ${option.label}`}
              name="value"
              required
              defaultValue={option.value}
            />
            <input
              aria-label={`Libellé ${option.label}`}
              name="label"
              required
              defaultValue={option.label}
            />
            <input
              aria-label={`Explication ${option.label}`}
              name="description"
              defaultValue={option.description ?? ""}
              placeholder="Explication"
            />
            <input
              aria-label={`Ordre ${option.label}`}
              name="sortOrder"
              type="number"
              defaultValue={option.sortOrder ?? 0}
            />
            <label className="checkbox-field">
              <input type="checkbox" name="isActive" defaultChecked={option.isActive !== false} />
              <span>Active</span>
            </label>
            <button
              className="button button--secondary"
              type="submit"
              disabled={pending === optionEndpoint}
            >
              Enregistrer
            </button>
          </form>
        );
      })}
      <form className="admin-inline-form" onSubmit={submit}>
        <label className="sr-only" htmlFor={`option-value-${field.id}`}>
          Valeur technique
        </label>
        <input
          id={`option-value-${field.id}`}
          name="value"
          required
          pattern="[a-z0-9_-]+"
          placeholder="valeur"
        />
        <label className="sr-only" htmlFor={`option-label-${field.id}`}>
          Libellé
        </label>
        <input id={`option-label-${field.id}`} name="label" required placeholder="Libellé" />
        <button className="button" type="submit" disabled={pending === endpoint}>
          Ajouter
        </button>
      </form>
    </div>
  );
}
