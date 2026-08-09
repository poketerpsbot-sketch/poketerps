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
  sortOrder?: number | null;
  isVisible?: boolean;
};

type FieldOption = {
  id: string | number;
  value: string;
  label: string;
  isActive?: boolean;
};

export type AdminDynamicField = {
  id: string | number;
  categoryId: string | number;
  subcategoryId?: string | number | null;
  key: string;
  label: string;
  fieldType: string;
  unit?: string | null;
  isRequired?: boolean;
  isFilterable?: boolean;
  isVisible?: boolean;
  options?: FieldOption[];
};

type Feedback = { tone: "success" | "error"; message: string } | null;

export function TaxonomyAdmin({
  categories,
  subcategories,
  fields,
  secondaryError,
}: {
  categories: AdminCategory[];
  subcategories: AdminSubcategory[];
  fields: AdminDynamicField[];
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
                "/api/admin/subcategories",
                (data) => ({
                  categoryId: String(data.get("categoryId") ?? ""),
                  name: String(data.get("name") ?? ""),
                  description: String(data.get("description") ?? "") || null,
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
  return (
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
  );
}
