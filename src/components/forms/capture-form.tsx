"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { Camera, CircleHelp, Save, Send, ShieldCheck } from "lucide-react";
import type {
  CategoryDto,
  DynamicFieldDefinitionDto,
  EntryDetailDto,
  MicronContextDto,
} from "@/components/data/types";
import { submitJson, uploadImage, validateImage } from "@/components/forms/form-api";
import {
  micronProfilesFor,
  taxonomyExplanations,
  type MicronContextType,
} from "@/lib/taxonomy/micron-contexts";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "120 caractères maximum."),
  shortDescription: z
    .string()
    .trim()
    .min(12, "Ajoute une courte description d’au moins 12 caractères.")
    .max(280, "280 caractères maximum."),
  fullDescription: z
    .string()
    .trim()
    .min(40, "Le rapport doit contenir au moins 40 caractères.")
    .max(10_000, "Le rapport est trop long."),
  categoryId: z.string().min(1, "Choisis une catégorie."),
  subcategoryId: z.string().optional(),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
  confirmEditorial: z.boolean().refine(Boolean, {
    message: "Confirme le caractère éditorial de la contribution.",
  }),
});

type CaptureValues = z.infer<typeof schema>;
type CreatedEntry = { id?: string | number; slug?: string };
type DynamicValue = string | string[];
type MicronContextPayload = {
  context: MicronContextType;
  mode: "SINGLE" | "RANGE" | "MULTIPLE" | "FULL_SPECTRUM" | "MIXED";
  singleValue?: number;
  minimumValue?: number;
  maximumValue?: number;
  multipleValues: number[];
  displayLabel: string;
  sourceType: "DECLARED";
};

function uniqueFields(fields: DynamicFieldDefinitionDto[]) {
  return Array.from(new Map(fields.map((field) => [String(field.id), field])).values());
}

function normalizedInitialFields(fields?: Record<string, unknown>) {
  const result: Record<string, DynamicValue> = {};
  for (const [id, value] of Object.entries(fields ?? {})) {
    if (Array.isArray(value)) result[id] = value.map(String);
    else if (value !== null && value !== undefined) result[id] = String(value);
  }
  return result;
}

function sameMicronPreset(
  preset: ReturnType<typeof micronProfilesFor>[number]["presets"][number],
  context: MicronContextDto,
) {
  return (
    preset.mode === context.mode &&
    (preset.singleValue ?? null) === (context.singleValue ?? null) &&
    (preset.minimumValue ?? null) === (context.minimumValue ?? null) &&
    (preset.maximumValue ?? null) === (context.maximumValue ?? null) &&
    JSON.stringify(preset.multipleValues ?? []) === JSON.stringify(context.multipleValues ?? [])
  );
}

function initialMicronControls(categories: CategoryDto[], entry?: EntryDetailDto) {
  const selections: Partial<Record<MicronContextType, string>> = {};
  const custom: Partial<Record<MicronContextType, { minimum: string; maximum: string }>> = {};
  if (!entry) return { selections, custom };
  const category = categories.find((item) => String(item.id) === String(entry.category?.id));
  const subcategory = category?.subcategories?.find(
    (item) => String(item.id) === String(entry.subcategory?.id),
  );
  const profiles = micronProfilesFor(category?.slug, subcategory?.slug, subcategory?.micronPresets);
  for (const context of entry.micronContexts ?? []) {
    const profile = profiles.find((item) => item.context === context.context);
    const preset = profile?.presets.find((item) => sameMicronPreset(item, context));
    if (preset) selections[context.context] = preset.value;
    else {
      selections[context.context] = "custom";
      custom[context.context] = {
        minimum: String(context.singleValue ?? context.minimumValue ?? ""),
        maximum: String(context.maximumValue ?? ""),
      };
    }
  }
  return { selections, custom };
}

function isEmptyDynamicValue(value: DynamicValue | undefined) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function DynamicFieldControl({
  definition,
  value,
  onChange,
}: {
  definition: DynamicFieldDefinitionDto;
  value: DynamicValue | undefined;
  onChange: (value: DynamicValue) => void;
}) {
  const id = `capture-field-${definition.id}`;
  const describedBy = definition.helpText ? `${id}-help` : undefined;
  const type = definition.fieldType;
  const numberRules = definition.validation ?? {};
  const minimum = typeof numberRules.min === "number" ? numberRules.min : undefined;
  const maximum = typeof numberRules.max === "number" ? numberRules.max : undefined;
  const step = typeof numberRules.step === "number" ? numberRules.step : undefined;
  const common = {
    id,
    name: `field-${definition.id}`,
    required: Boolean(definition.isRequired),
    "aria-describedby": describedBy,
  };

  let control;
  if (type === "LONG_TEXT") {
    control = (
      <textarea
        {...common}
        rows={4}
        value={typeof value === "string" ? value : ""}
        placeholder={definition.placeholder ?? undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  } else if (type === "BOOLEAN") {
    control = (
      <select
        {...common}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Non précisé</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    );
  } else if (type === "SELECT") {
    control = (
      <select
        {...common}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choisir</option>
        {(definition.options ?? []).map((option) => (
          <option value={option.value} key={String(option.id ?? option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (type === "MULTISELECT" || type === "MULTI_SELECT") {
    control = (
      <select
        {...common}
        multiple
        value={Array.isArray(value) ? value : []}
        onChange={(event) =>
          onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))
        }
      >
        {(definition.options ?? []).map((option) => (
          <option value={option.value} key={String(option.id ?? option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        {...common}
        type={
          type === "NUMBER" ? "number" : type === "URL" ? "url" : type === "DATE" ? "date" : "text"
        }
        inputMode={type === "NUMBER" ? "decimal" : undefined}
        min={type === "NUMBER" ? minimum : undefined}
        max={type === "NUMBER" ? maximum : undefined}
        step={type === "NUMBER" ? step : undefined}
        value={typeof value === "string" ? value : ""}
        placeholder={definition.placeholder ?? undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {definition.label}
        {definition.unit ? ` (${definition.unit})` : ""}
        {definition.isRequired && <span> *</span>}
      </label>
      {control}
      {definition.helpText && (
        <p className="field__hint" id={describedBy}>
          {definition.helpText}
        </p>
      )}
    </div>
  );
}

export function CaptureForm({
  categories,
  initialEntry,
  allowSubmit = true,
  moderationMessage,
  returnHref = "/profil/fiches",
}: {
  categories: CategoryDto[];
  initialEntry?: EntryDetailDto;
  allowSubmit?: boolean;
  moderationMessage?: string | null;
  returnHref?: string;
}) {
  const router = useRouter();
  const editing = Boolean(initialEntry?.id);
  const initialMicrons = initialMicronControls(categories, initialEntry);
  const [image, setImage] = useState<File>();
  const [dynamicValues, setDynamicValues] = useState<Record<string, DynamicValue>>(() =>
    normalizedInitialFields(initialEntry?.fields),
  );
  const [micronSelections, setMicronSelections] = useState<
    Partial<Record<MicronContextType, string>>
  >(initialMicrons.selections);
  const [customMicrons, setCustomMicrons] = useState<
    Partial<Record<MicronContextType, { minimum: string; maximum: string }>>
  >(initialMicrons.custom);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CaptureValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialEntry?.name ?? "",
      shortDescription: initialEntry?.shortDescription ?? "",
      fullDescription: initialEntry?.fullDescription ?? "",
      categoryId: initialEntry?.category?.id ? String(initialEntry.category.id) : "",
      subcategoryId: initialEntry?.subcategory?.id ? String(initialEntry.subcategory.id) : "",
      rarity:
        initialEntry?.rarity && initialEntry.rarity !== "UNKNOWN"
          ? (initialEntry.rarity as CaptureValues["rarity"])
          : "COMMON",
      confirmEditorial: editing,
    },
  });
  const selectedCategory = useWatch({ control, name: "categoryId" });
  const selectedSubcategory = useWatch({ control, name: "subcategoryId" });
  const category = categories.find(
    (item) => String(item.id) === selectedCategory || item.slug === selectedCategory,
  );
  const subcategories = category?.subcategories ?? [];
  const subcategory = subcategories.find(
    (item) => String(item.id) === selectedSubcategory || item.slug === selectedSubcategory,
  );
  const micronProfiles =
    subcategory?.micronRequirement === "ABSENT"
      ? []
      : micronProfilesFor(category?.slug, subcategory?.slug, subcategory?.micronPresets);
  const dynamicFields = uniqueFields([...(category?.fields ?? []), ...(subcategory?.fields ?? [])]);

  function serializedFields() {
    const fields: Record<string, string | number | boolean | string[]> = {};
    for (const definition of dynamicFields) {
      const id = String(definition.id);
      const raw = dynamicValues[id];
      if (isEmptyDynamicValue(raw)) continue;
      if (definition.fieldType === "NUMBER") {
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) fields[id] = numeric;
      } else if (definition.fieldType === "BOOLEAN") {
        fields[id] = raw === "true";
      } else if (raw !== undefined) {
        fields[id] = raw;
      }
    }
    return fields;
  }

  function micronContextPayloads() {
    const payloads: MicronContextPayload[] = [];
    for (const profile of micronProfiles) {
      const selection = micronSelections[profile.context] ?? "none";
      if (selection === "none") continue;
      if (selection === "custom") {
        const custom = customMicrons[profile.context];
        const minimumValue = Number(custom?.minimum);
        if (profile.context === "PRESSING_BAG") {
          if (!Number.isInteger(minimumValue) || minimumValue < 1 || minimumValue > 1_000) {
            return {
              error: `Indique une valeur valide pour Â« ${profile.label} Â».`,
              payloads: [],
            };
          }
          payloads.push({
            context: profile.context,
            mode: "SINGLE" as const,
            singleValue: minimumValue,
            multipleValues: [],
            displayLabel: `${minimumValue} Âµm`,
            sourceType: "DECLARED" as const,
          });
          continue;
        }
        const maximumValue = Number(custom?.maximum);
        if (
          !Number.isInteger(minimumValue) ||
          !Number.isInteger(maximumValue) ||
          minimumValue < 1 ||
          maximumValue > 1_000 ||
          minimumValue > maximumValue
        ) {
          return {
            error: `Indique une plage valide pour « ${profile.label} ».`,
            payloads: [],
          };
        }
        payloads.push({
          context: profile.context,
          mode: "RANGE" as const,
          minimumValue,
          maximumValue,
          multipleValues: [],
          displayLabel: `${minimumValue}–${maximumValue} µm`,
          sourceType: "DECLARED" as const,
        });
        continue;
      }
      const preset = profile.presets.find((item) => item.value === selection);
      if (!preset || preset.mode === "NONE") continue;
      payloads.push({
        context: profile.context,
        mode: preset.mode,
        singleValue: preset.singleValue,
        minimumValue: preset.minimumValue,
        maximumValue: preset.maximumValue,
        multipleValues: preset.multipleValues ?? [],
        displayLabel: preset.label,
        sourceType: "DECLARED" as const,
      });
    }
    if (subcategory?.micronRequirement === "REQUIRED" && payloads.length < micronProfiles.length) {
      return {
        error: "Renseigne les microns obligatoires pour cette sous-catÃ©gorie.",
        payloads: [],
      };
    }
    return { error: null, payloads };
  }

  const onSubmit: SubmitHandler<CaptureValues> = async (values, event) => {
    const nativeEvent = event?.nativeEvent;
    const submitter =
      nativeEvent instanceof SubmitEvent
        ? (nativeEvent.submitter as HTMLButtonElement | null)
        : null;
    const shouldSubmit = submitter?.value === "submit";
    setFeedback(null);
    const missingField = dynamicFields.find(
      (definition) =>
        definition.isRequired && isEmptyDynamicValue(dynamicValues[String(definition.id)]),
    );
    if (missingField) {
      setFeedback({
        type: "error",
        message: `Le champ « ${missingField.label} » est obligatoire.`,
      });
      return;
    }
    const imageError = validateImage(image);
    if (imageError) {
      setFeedback({ type: "error", message: imageError });
      return;
    }

    const micronResult = micronContextPayloads();
    if (micronResult.error) {
      setFeedback({ type: "error", message: micronResult.error });
      return;
    }
    const collectionMicron = micronResult.payloads.find(
      (item) => item.context === "COLLECTION_SEPARATION",
    );
    const body = {
      name: values.name,
      shortDescription: values.shortDescription,
      fullDescription: values.fullDescription,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId || null,
      rarity: values.rarity,
      fields: serializedFields(),
      micron: collectionMicron
        ? {
            mode: collectionMicron.mode,
            singleValue: collectionMicron.singleValue,
            minimumValue: collectionMicron.minimumValue,
            maximumValue: collectionMicron.maximumValue,
            multipleValues: collectionMicron.multipleValues,
            displayLabel: collectionMicron.displayLabel,
            sourceType: collectionMicron.sourceType,
          }
        : null,
      micronContexts: micronResult.payloads,
      tagIds: editing
        ? (initialEntry?.tags ?? []).flatMap((tag) =>
            tag.id === null || tag.id === undefined ? [] : [String(tag.id)],
          )
        : ([] as string[]),
    };
    let result = editing
      ? await submitJson<CreatedEntry>(
          `/api/entries/${encodeURIComponent(String(initialEntry?.id))}`,
          "PATCH",
          body,
        )
      : await submitJson<CreatedEntry>("/api/entries", "POST", body);
    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    const entryId = result.data?.id ?? initialEntry?.id;
    if (!entryId) {
      setFeedback({
        type: "error",
        message: "Le brouillon a été créé sans identifiant exploitable.",
      });
      return;
    }
    if (image) {
      try {
        const uploaded = await uploadImage(image, "entry-images", String(entryId));
        if (!uploaded?.path) throw new Error("Réponse de stockage incomplète.");
      } catch (error) {
        setFeedback({
          type: "error",
          message: `Le brouillon est enregistré, mais la photo n’a pas pu être associée : ${
            error instanceof Error ? error.message : "image refusée"
          }`,
        });
        return;
      }
    }

    if (shouldSubmit && allowSubmit) {
      result = await submitJson(
        `/api/entries/${encodeURIComponent(String(entryId))}/submit`,
        "POST",
        {},
      );
      if (!result.ok) {
        setFeedback({
          type: "error",
          message: `Brouillon enregistré, mais l’envoi en validation a échoué : ${result.message}`,
        });
        return;
      }
      setFeedback({
        type: "success",
        message: "Capture envoyée en validation.",
      });
    } else {
      setFeedback({
        type: "success",
        message: editing ? "Fiche mise à jour." : "Brouillon enregistré dans ton atelier.",
      });
    }
    router.push(returnHref);
    router.refresh();
  };

  return (
    <form className="form-panel form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      {moderationMessage && (
        <div className="form-feedback form-feedback--error" role="status">
          <strong>Modification demandée par l’équipe</strong>
          <p>{moderationMessage}</p>
        </div>
      )}
      <section className="form-section">
        <h2>Identification de la découverte</h2>
        <p>
          Décris uniquement ce que tu peux documenter. Les affirmations commerciales sont
          interdites.
        </p>
        <div className="form-grid">
          <div className="field field--wide">
            <label htmlFor="capture-name">
              Nom de la fiche <span>*</span>
            </label>
            <input
              id="capture-name"
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "capture-name-error" : undefined}
            />
            {errors.name && (
              <p className="field__error" id="capture-name-error">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="capture-category">
              Catégorie <span>*</span>
            </label>
            <select
              id="capture-category"
              {...register("categoryId", {
                onChange: () => {
                  setValue("subcategoryId", "");
                  setMicronSelections({});
                  setCustomMicrons({});
                },
              })}
              aria-invalid={Boolean(errors.categoryId)}
              aria-describedby={errors.categoryId ? "capture-category-error" : undefined}
            >
              <option value="">Choisir</option>
              {categories.map((item) => (
                <option value={String(item.id)} key={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="field__error" id="capture-category-error">
                {errors.categoryId.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="capture-subcategory">Sous-catégorie</label>
            <select
              id="capture-subcategory"
              {...register("subcategoryId", {
                onChange: () => {
                  setMicronSelections({});
                  setCustomMicrons({});
                },
              })}
              disabled={subcategories.length === 0}
            >
              <option value="">Aucune</option>
              {subcategories.map((item) => (
                <option value={String(item.id)} key={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
            {subcategory?.slug &&
              (subcategory.frenchExplanation || taxonomyExplanations[subcategory.slug]) && (
                <p className="field__hint taxonomy-explanation">
                  <CircleHelp aria-hidden="true" />{" "}
                  {subcategory.frenchExplanation || taxonomyExplanations[subcategory.slug]}
                </p>
              )}
          </div>
          <div className="field">
            <label htmlFor="capture-rarity">Rareté éditoriale</label>
            <select id="capture-rarity" {...register("rarity")}>
              <option value="COMMON">Commune</option>
              <option value="UNCOMMON">Peu commune</option>
              <option value="RARE">Rare</option>
              <option value="EPIC">Épique</option>
              <option value="LEGENDARY">Légendaire</option>
            </select>
          </div>
          <div className="field field--wide">
            <label htmlFor="capture-short">
              Résumé <span>*</span>
            </label>
            <textarea
              id="capture-short"
              rows={3}
              {...register("shortDescription")}
              aria-invalid={Boolean(errors.shortDescription)}
              aria-describedby={errors.shortDescription ? "capture-short-error" : undefined}
            />
            {errors.shortDescription && (
              <p className="field__error" id="capture-short-error">
                {errors.shortDescription.message}
              </p>
            )}
          </div>
        </div>
      </section>

      {dynamicFields.length > 0 && (
        <section className="form-section">
          <h2>Caractéristiques de la catégorie</h2>
          <p>Ces champs sont administrés par l’équipe et s’adaptent à la taxonomie.</p>
          <div className="form-grid">
            {dynamicFields.map((definition) => (
              <DynamicFieldControl
                definition={definition}
                value={dynamicValues[String(definition.id)]}
                onChange={(value) =>
                  setDynamicValues((current) => ({
                    ...current,
                    [String(definition.id)]: value,
                  }))
                }
                key={String(definition.id)}
              />
            ))}
          </div>
        </section>
      )}

      {micronProfiles.length > 0 && (
        <section className="form-section contextual-microns">
          <h2>Microns déclarés</h2>
          <p>
            Les microns de collecte et ceux du sac de pressage sont enregistrés séparément. Une
            valeur inconnue ne bloque jamais la fiche.
          </p>
          <div className="form-grid">
            {micronProfiles.map((profile) => {
              const id = `capture-micron-${profile.context.toLocaleLowerCase()}`;
              const selected = micronSelections[profile.context] ?? "none";
              const custom = customMicrons[profile.context] ?? { minimum: "", maximum: "" };
              return (
                <div className="field field--wide contextual-micron" key={profile.context}>
                  <label htmlFor={id}>{profile.label}</label>
                  <select
                    id={id}
                    value={selected}
                    onChange={(event) =>
                      setMicronSelections((current) => ({
                        ...current,
                        [profile.context]: event.target.value,
                      }))
                    }
                  >
                    {profile.presets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                    {profile.allowCustomRange && (
                      <option value="custom">
                        {profile.context === "PRESSING_BAG"
                          ? "Valeur personnalisée"
                          : "Plage personnalisée"}
                      </option>
                    )}
                  </select>
                  <p className="field__hint">
                    <CircleHelp aria-hidden="true" /> {profile.helpText}
                  </p>
                  {selected === "custom" && (
                    <div className="form-grid form-grid--compact">
                      <div className="field">
                        <label htmlFor={`${id}-minimum`}>
                          {profile.context === "PRESSING_BAG" ? "Valeur (µm)" : "Minimum (µm)"}
                        </label>
                        <input
                          id={`${id}-minimum`}
                          type="number"
                          min="1"
                          max="1000"
                          inputMode="numeric"
                          value={custom.minimum}
                          onChange={(event) =>
                            setCustomMicrons((current) => ({
                              ...current,
                              [profile.context]: { ...custom, minimum: event.target.value },
                            }))
                          }
                        />
                      </div>
                      {profile.context !== "PRESSING_BAG" && (
                        <div className="field">
                          <label htmlFor={`${id}-maximum`}>Maximum (µm)</label>
                          <input
                            id={`${id}-maximum`}
                            type="number"
                            min="1"
                            max="1000"
                            inputMode="numeric"
                            value={custom.maximum}
                            onChange={(event) =>
                              setCustomMicrons((current) => ({
                                ...current,
                                [profile.context]: { ...custom, maximum: event.target.value },
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="form-section">
        <h2>Rapport et média</h2>
        <div className="field">
          <label htmlFor="capture-full">
            Description complète <span>*</span>
          </label>
          <textarea
            id="capture-full"
            rows={10}
            {...register("fullDescription")}
            aria-invalid={Boolean(errors.fullDescription)}
            aria-describedby={errors.fullDescription ? "capture-full-error" : undefined}
          />
          {errors.fullDescription && (
            <p className="field__error" id="capture-full-error">
              {errors.fullDescription.message}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="capture-image">
            <Camera size={17} aria-hidden="true" /> Photo principale
          </label>
          {initialEntry?.images && initialEntry.images.length > 0 && (
            <div className="entry-edit-images" aria-label="Images actuellement enregistrées">
              {initialEntry.images.map((entryImage, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- signed/public storage URLs are dynamic.
                <img
                  src={entryImage.url}
                  alt={
                    entryImage.altText ??
                    entryImage.alt ??
                    `Image ${index + 1} de ${initialEntry.name}`
                  }
                  key={String(entryImage.id ?? entryImage.url)}
                />
              ))}
            </div>
          )}
          <input
            id="capture-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setImage(event.target.files?.[0])}
          />
          <p className="field__hint">
            JPEG, PNG, WebP ou AVIF · 8 Mo maximum. Une nouvelle image est ajoutée sans effacer
            automatiquement les médias existants.
          </p>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" {...register("confirmEditorial")} />
          <span>
            Je confirme que cette contribution est informative et éditoriale, sans vente, prix,
            commande ni mise en relation commerciale.
          </span>
        </label>
        {errors.confirmEditorial && (
          <p className="field__error">{errors.confirmEditorial.message}</p>
        )}
      </section>

      {feedback && (
        <div
          className={`form-feedback${feedback.type === "error" ? " form-feedback--error" : ""}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      )}
      <div className="button-row">
        <button
          className="button button--secondary"
          type="submit"
          name="intent"
          value="draft"
          disabled={isSubmitting}
        >
          <Save size={17} aria-hidden="true" />{" "}
          {isSubmitting
            ? "Enregistrement…"
            : editing
              ? "Enregistrer les modifications"
              : "Enregistrer le brouillon"}
        </button>
        {allowSubmit && (
          <button
            className="button"
            type="submit"
            name="intent"
            value="submit"
            disabled={isSubmitting}
          >
            <Send size={17} aria-hidden="true" />
            {editing ? "Renvoyer pour validation" : "Envoyer en validation"}
          </button>
        )}
      </div>
      <p className="field__hint">
        <ShieldCheck size={14} aria-hidden="true" /> La publication n’est jamais automatique : un
        membre autorisé vérifie la capture.
      </p>
    </form>
  );
}
