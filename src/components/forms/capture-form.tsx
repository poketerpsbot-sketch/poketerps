"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { Camera, Save, Send, ShieldCheck } from "lucide-react";
import type { CategoryDto, DynamicFieldDefinitionDto } from "@/components/data/types";
import { submitJson, uploadImage, validateImage } from "@/components/forms/form-api";

const micronModes = ["NONE", "SINGLE", "RANGE", "MULTIPLE", "FULL_SPECTRUM", "MIXED"] as const;

const schema = z
  .object({
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
    micronMode: z.enum(micronModes),
    micronSingle: z.number().int().min(1).max(1_000).optional(),
    micronMin: z.number().int().min(1).max(1_000).optional(),
    micronMax: z.number().int().min(1).max(1_000).optional(),
    micronMultiple: z.string().trim().max(160).optional(),
    micronLabel: z.string().trim().max(120).optional(),
    micronNotes: z.string().trim().max(1_000).optional(),
    confirmEditorial: z.boolean().refine(Boolean, {
      message: "Confirme le caractère éditorial de la contribution.",
    }),
  })
  .superRefine((value, context) => {
    if (value.micronMode === "SINGLE" && value.micronSingle === undefined) {
      context.addIssue({
        code: "custom",
        path: ["micronSingle"],
        message: "Indique la valeur en microns.",
      });
    }
    if (value.micronMode === "RANGE") {
      if (value.micronMin === undefined || value.micronMax === undefined) {
        context.addIssue({
          code: "custom",
          path: ["micronMin"],
          message: "Indique les deux limites de la plage.",
        });
      } else if (value.micronMin > value.micronMax) {
        context.addIssue({
          code: "custom",
          path: ["micronMax"],
          message: "La valeur maximale doit être supérieure à la minimale.",
        });
      }
    }
    if (
      value.micronMode === "MULTIPLE" &&
      !value.micronMultiple?.split(",").some((item) => item.trim())
    ) {
      context.addIssue({
        code: "custom",
        path: ["micronMultiple"],
        message: "Indique au moins une valeur.",
      });
    }
  });

type CaptureValues = z.infer<typeof schema>;
type CreatedEntry = { id?: string | number; slug?: string };
type DynamicValue = string | string[];

function numberValue(value: unknown) {
  return value === "" || value === null || value === undefined ? undefined : Number(value);
}

function uniqueFields(fields: DynamicFieldDefinitionDto[]) {
  return Array.from(new Map(fields.map((field) => [String(field.id), field])).values());
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

export function CaptureForm({ categories }: { categories: CategoryDto[] }) {
  const router = useRouter();
  const [image, setImage] = useState<File>();
  const [dynamicValues, setDynamicValues] = useState<Record<string, DynamicValue>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CaptureValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: "",
      subcategoryId: "",
      rarity: "COMMON",
      micronMode: "NONE",
      confirmEditorial: false,
    },
  });
  const selectedCategory = useWatch({ control, name: "categoryId" });
  const selectedSubcategory = useWatch({ control, name: "subcategoryId" });
  const micronMode = useWatch({ control, name: "micronMode" });
  const category = categories.find(
    (item) => String(item.id) === selectedCategory || item.slug === selectedCategory,
  );
  const subcategories = category?.subcategories ?? [];
  const subcategory = subcategories.find(
    (item) => String(item.id) === selectedSubcategory || item.slug === selectedSubcategory,
  );
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

  function micronPayload(values: CaptureValues) {
    if (values.micronMode === "NONE") return null;
    const multipleValues =
      values.micronMode === "MULTIPLE"
        ? (values.micronMultiple ?? "")
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isInteger(item) && item > 0 && item <= 1_000)
        : [];
    return {
      mode: values.micronMode,
      singleValue: values.micronMode === "SINGLE" ? values.micronSingle : undefined,
      minimumValue: values.micronMode === "RANGE" ? values.micronMin : undefined,
      maximumValue: values.micronMode === "RANGE" ? values.micronMax : undefined,
      multipleValues,
      displayLabel: values.micronLabel || undefined,
      sourceType: "DECLARED" as const,
      notes: values.micronNotes || undefined,
    };
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

    const body = {
      name: values.name,
      shortDescription: values.shortDescription,
      fullDescription: values.fullDescription,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId || null,
      rarity: values.rarity,
      fields: serializedFields(),
      micron: micronPayload(values),
      tagIds: [] as string[],
    };
    let result = await submitJson<CreatedEntry>("/api/entries", "POST", body);
    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    const entryId = result.data?.id;
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

    if (shouldSubmit) {
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
        message: "Brouillon enregistré dans ton atelier.",
      });
    }
    router.push("/profil/fiches");
    router.refresh();
  };

  return (
    <form className="form-panel form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
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
              {...register("categoryId")}
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
              {...register("subcategoryId")}
              disabled={subcategories.length === 0}
            >
              <option value="">Aucune</option>
              {subcategories.map((item) => (
                <option value={String(item.id)} key={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
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

      <section className="form-section">
        <h2>Microns déclarés</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="capture-micron-mode">Mode</label>
            <select id="capture-micron-mode" {...register("micronMode")}>
              <option value="NONE">Non précisé</option>
              <option value="SINGLE">Valeur unique</option>
              <option value="RANGE">Plage</option>
              <option value="MULTIPLE">Plusieurs valeurs</option>
              <option value="FULL_SPECTRUM">Full Spectrum</option>
              <option value="MIXED">Mixed Micron</option>
            </select>
          </div>
          {micronMode === "SINGLE" && (
            <div className="field">
              <label htmlFor="capture-micron-single">Valeur (µm)</label>
              <Controller
                control={control}
                name="micronSingle"
                render={({ field }) => (
                  <input
                    id="capture-micron-single"
                    type="number"
                    min="1"
                    max="1000"
                    inputMode="numeric"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(numberValue(event.target.value))}
                    aria-invalid={Boolean(errors.micronSingle)}
                  />
                )}
              />
              {errors.micronSingle && <p className="field__error">{errors.micronSingle.message}</p>}
            </div>
          )}
          {micronMode === "RANGE" && (
            <>
              <div className="field">
                <label htmlFor="capture-micron-min">Minimum (µm)</label>
                <Controller
                  control={control}
                  name="micronMin"
                  render={({ field }) => (
                    <input
                      id="capture-micron-min"
                      type="number"
                      min="1"
                      max="1000"
                      inputMode="numeric"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(numberValue(event.target.value))}
                      aria-invalid={Boolean(errors.micronMin)}
                    />
                  )}
                />
                {errors.micronMin && <p className="field__error">{errors.micronMin.message}</p>}
              </div>
              <div className="field">
                <label htmlFor="capture-micron-max">Maximum (µm)</label>
                <Controller
                  control={control}
                  name="micronMax"
                  render={({ field }) => (
                    <input
                      id="capture-micron-max"
                      type="number"
                      min="1"
                      max="1000"
                      inputMode="numeric"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(numberValue(event.target.value))}
                      aria-invalid={Boolean(errors.micronMax)}
                    />
                  )}
                />
                {errors.micronMax && <p className="field__error">{errors.micronMax.message}</p>}
              </div>
            </>
          )}
          {micronMode === "MULTIPLE" && (
            <div className="field field--wide">
              <label htmlFor="capture-micron-multiple">Valeurs séparées par des virgules</label>
              <input
                id="capture-micron-multiple"
                inputMode="numeric"
                placeholder="45, 73, 90"
                {...register("micronMultiple")}
                aria-invalid={Boolean(errors.micronMultiple)}
              />
              {errors.micronMultiple && (
                <p className="field__error">{errors.micronMultiple.message}</p>
              )}
            </div>
          )}
          {micronMode !== "NONE" && (
            <>
              <div className="field">
                <label htmlFor="capture-micron-label">Libellé affiché</label>
                <input
                  id="capture-micron-label"
                  placeholder="Ex. 73–159 µm déclaré"
                  {...register("micronLabel")}
                />
              </div>
              <div className="field">
                <label htmlFor="capture-micron-notes">Notes</label>
                <input id="capture-micron-notes" {...register("micronNotes")} />
              </div>
            </>
          )}
        </div>
      </section>

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
          <input
            id="capture-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setImage(event.target.files?.[0])}
          />
          <p className="field__hint">
            JPEG, PNG, WebP ou AVIF · 8 Mo maximum. La photo est envoyée uniquement après la
            création du brouillon.
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
          {isSubmitting ? "Enregistrement…" : "Enregistrer le brouillon"}
        </button>
        <button
          className="button"
          type="submit"
          name="intent"
          value="submit"
          disabled={isSubmitting}
        >
          <Send size={17} aria-hidden="true" /> Envoyer en validation
        </button>
      </div>
      <p className="field__hint">
        <ShieldCheck size={14} aria-hidden="true" /> La publication n’est jamais automatique : un
        membre autorisé vérifie la capture.
      </p>
    </form>
  );
}
