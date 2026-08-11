"use client";

import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, ImagePlus, Save, Sparkles } from "lucide-react";

import type { ContestFormValue, ContestType } from "@/components/contests/types";
import { localDateTime } from "@/components/contests/contest-utils";
import { uploadImage, validateImage } from "@/components/forms/form-api";

const contestTypes: Array<{ value: ContestType; label: string; help: string }> = [
  {
    value: "WEIGHT_GUESS",
    label: "Devine le poids",
    help: "Les membres proposent un poids secret.",
  },
  { value: "DRAW", label: "Tirage au sort", help: "Une participation simple, puis un tirage." },
  { value: "CREATIVE", label: "Créatif", help: "Une création ou une fiche est évaluée." },
  { value: "ENTRY", label: "Fiche PokéTerps", help: "La participation exige une fiche publiée." },
  { value: "GAME", label: "Jeu", help: "Quiz, défi ou mini-jeu communautaire." },
  {
    value: "EXTERNAL_LINK",
    label: "Lien externe",
    help: "L’action principale se fait sur un autre site.",
  },
  { value: "COMMUNITY", label: "Communauté", help: "Défi libre pour animer la communauté." },
  { value: "OTHER", label: "Autre", help: "Configuration personnalisée." },
];

function isoFromLocal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
}

function defaultValue(): ContestFormValue {
  const startsAt = new Date();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    slug: "",
    title: "",
    summary: "",
    description: "",
    rules: "",
    imageUrl: null,
    status: "DRAFT",
    isFeatured: false,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    scoringMode: "MANUAL",
    criteria: {},
    reward: {},
    rewardBadgeId: null,
    maxParticipants: null,
    requireEntry: false,
    contestType: "OTHER",
    instructions: "",
    participationSteps: [],
    externalUrl: null,
    telegramUrl: null,
    instagramUrl: null,
    terms: null,
    additionalInformation: null,
    registrationsOpen: true,
    registrationStartsAt: startsAt.toISOString(),
    registrationEndsAt: endsAt.toISOString(),
    publicIntro: null,
    shortRules: null,
    fullRules: null,
    longDescription: null,
    mainImageUrl: null,
    resultImageUrl: null,
    registrationsManuallyClosed: false,
    resultPublicationMode: "MANUAL",
    secretWeight: null,
    weightUnit: null,
    customWeightUnit: null,
    allowGuessEditing: false,
    tieBreakerMode: "FIRST_SUBMISSION",
    notifyTelegramOnPublish: true,
    notifyParticipantsOnResult: true,
    links: [],
  };
}

export function AdminContestForm({
  initialValue,
  submitLabel = "Créer le concours",
  pending = false,
  onSubmit,
}: {
  initialValue?: ContestFormValue;
  submitLabel?: string;
  pending?: boolean;
  onSubmit: (value: ContestFormValue) => Promise<void> | void;
}) {
  const baseId = useId();
  const [value, setValue] = useState<ContestFormValue>(() => initialValue ?? defaultValue());
  const [mode, setMode] = useState<"QUICK" | "ADVANCED">("QUICK");
  const [step, setStep] = useState(1);
  const [startNow, setStartNow] = useState(!initialValue);
  const [unlimited, setUnlimited] = useState(value.maxParticipants === null);
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<File | null>(null);
  const [error, setError] = useState("");

  const field = <K extends keyof ContestFormValue>(key: K, next: ContestFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value === "publish" ? "publish" : "draft";
    const startsAt = startNow ? new Date().toISOString() : value.startsAt;
    if (!value.title.trim()) return setError("Ajoute un titre au concours.");
    if (new Date(value.endsAt) <= new Date(startsAt)) {
      return setError("La fin du concours doit être après son ouverture.");
    }
    if (value.contestType === "WEIGHT_GUESS" && (!value.secretWeight || !value.weightUnit)) {
      return setError("Ajoute le poids secret et son unité.");
    }
    const mainImageError = validateImage(mainImage ?? undefined);
    const resultImageError = validateImage(resultImage ?? undefined);
    if (mainImageError || resultImageError)
      return setError(mainImageError ?? resultImageError ?? "Image invalide.");
    try {
      const [mainUpload, resultUpload] = await Promise.all([
        mainImage
          ? uploadImage(mainImage, "contest-images", initialValue ? undefined : undefined)
          : null,
        resultImage
          ? uploadImage(resultImage, "contest-results", initialValue ? undefined : undefined)
          : null,
      ]);
      await onSubmit({
        ...value,
        title: value.title.trim(),
        status: intent === "publish" ? "OPEN" : "DRAFT",
        startsAt,
        registrationStartsAt: startsAt,
        registrationEndsAt: value.endsAt,
        maxParticipants: unlimited ? null : value.maxParticipants,
        summary: value.shortDescription?.trim() || value.summary.trim(),
        description: value.longDescription?.trim() || value.description.trim(),
        rules: value.fullRules?.trim() || value.rules.trim(),
        instructions: value.participantInstructions?.trim() || value.instructions.trim(),
        mainImageUrl: mainUpload?.publicUrl ?? value.mainImageUrl ?? value.imageUrl,
        mainImageBucket: mainUpload?.path ? "contest-images" : value.mainImageBucket,
        mainImagePath: mainUpload?.path ?? value.mainImagePath,
        resultImageBucket: resultUpload?.path ? "contest-results" : value.resultImageBucket,
        resultImagePath: resultUpload?.path ?? value.resultImagePath,
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "L’image n’a pas pu être envoyée.",
      );
    }
  }

  return (
    <form className="admin-contest-form admin-contest-wizard" onSubmit={submit}>
      <div className="admin-contest-mode" role="group" aria-label="Niveau de configuration">
        <button
          className={mode === "QUICK" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("QUICK")}
        >
          Création rapide
        </button>
        <button
          className={mode === "ADVANCED" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("ADVANCED")}
        >
          Options avancées
        </button>
      </div>

      <ol className="admin-contest-steps" aria-label="Étapes de création">
        {["Concept", "Dates", "Contenu", "Vérification"].map((label, index) => (
          <li
            className={step === index + 1 ? "is-active" : step > index + 1 ? "is-complete" : ""}
            key={label}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="admin-contest-form__section">
          <header>
            <Sparkles aria-hidden="true" />
            <div>
              <h3>Quel concours veux-tu lancer ?</h3>
              <p>Choisis un modèle, puis donne-lui un titre. Le reste est facultatif.</p>
            </div>
          </header>
          <div className="contest-type-grid">
            {contestTypes.map((type) => (
              <button
                className={value.contestType === type.value ? "is-active" : ""}
                type="button"
                key={type.value}
                onClick={() => field("contestType", type.value)}
              >
                <strong>{type.label}</strong>
                <small>{type.help}</small>
              </button>
            ))}
          </div>
          <div className="form-grid">
            <div className="field field--wide">
              <label htmlFor={`${baseId}-title`}>Titre *</label>
              <input
                id={`${baseId}-title`}
                required
                maxLength={180}
                value={value.title}
                onChange={(event) => field("title", event.target.value)}
              />
            </div>
            <div className="field field--wide">
              <label htmlFor={`${baseId}-short`}>Petite phrase publique (facultatif)</label>
              <textarea
                id={`${baseId}-short`}
                maxLength={320}
                value={value.shortDescription ?? value.summary}
                onChange={(event) => field("shortDescription", event.target.value || null)}
              />
            </div>
            <div className="field field--wide">
              <label htmlFor={`${baseId}-main-image`}>
                <ImagePlus aria-hidden="true" /> Photo principale (facultatif)
              </label>
              <input
                id={`${baseId}-main-image`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => setMainImage(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="admin-contest-form__section">
          <header>
            <CalendarClock aria-hidden="true" />
            <div>
              <h3>Quand et pour combien de personnes ?</h3>
              <p>Les inscriptions utilisent exactement ces dates, dans le fuseau Europe/Zurich.</p>
            </div>
          </header>
          <div className="form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={startNow}
                onChange={(event) => setStartNow(event.target.checked)}
              />
              <span>Ouvrir dès la publication</span>
            </label>
            {!startNow && (
              <div className="field">
                <label htmlFor={`${baseId}-starts`}>Ouverture *</label>
                <input
                  id={`${baseId}-starts`}
                  type="datetime-local"
                  required
                  value={localDateTime(value.startsAt)}
                  onChange={(event) => field("startsAt", isoFromLocal(event.target.value))}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor={`${baseId}-ends`}>Fin *</label>
              <input
                id={`${baseId}-ends`}
                type="datetime-local"
                required
                value={localDateTime(value.endsAt)}
                onChange={(event) => field("endsAt", isoFromLocal(event.target.value))}
              />
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(event) => setUnlimited(event.target.checked)}
              />
              <span>Places illimitées</span>
            </label>
            {!unlimited && (
              <div className="field">
                <label htmlFor={`${baseId}-maximum`}>Nombre de places</label>
                <input
                  id={`${baseId}-maximum`}
                  type="number"
                  min={1}
                  max={1000000}
                  value={value.maxParticipants ?? 1}
                  onChange={(event) => field("maxParticipants", Number(event.target.value))}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="admin-contest-form__section">
          <header>
            <Sparkles aria-hidden="true" />
            <div>
              <h3>Contenu utile</h3>
              <p>N’ajoute que ce qui aide réellement les participants.</p>
            </div>
          </header>
          <div className="form-grid">
            <div className="field field--wide">
              <label htmlFor={`${baseId}-intro`}>Présentation publique</label>
              <textarea
                id={`${baseId}-intro`}
                maxLength={20000}
                value={value.publicIntro ?? ""}
                onChange={(event) => field("publicIntro", event.target.value || null)}
              />
            </div>
            <div className="field field--wide">
              <label htmlFor={`${baseId}-short-rules`}>
                Règles courtes visibles avant participation
              </label>
              <textarea
                id={`${baseId}-short-rules`}
                maxLength={2000}
                value={value.shortRules ?? ""}
                onChange={(event) => field("shortRules", event.target.value || null)}
              />
            </div>
            <div className="field field--wide">
              <label htmlFor={`${baseId}-instructions`}>
                Instructions révélées après participation
              </label>
              <textarea
                id={`${baseId}-instructions`}
                maxLength={20000}
                value={value.participantInstructions ?? value.instructions}
                onChange={(event) => field("participantInstructions", event.target.value || null)}
              />
            </div>
            <div className="field field--wide">
              <label htmlFor={`${baseId}-steps`}>Étapes, une par ligne</label>
              <textarea
                id={`${baseId}-steps`}
                value={value.participationSteps.join("\n")}
                onChange={(event) =>
                  field(
                    "participationSteps",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .slice(0, 12),
                  )
                }
              />
            </div>
            {mode === "ADVANCED" && (
              <>
                <div className="field">
                  <label htmlFor={`${baseId}-link`}>Lien participant</label>
                  <input
                    id={`${baseId}-link`}
                    type="url"
                    value={value.externalUrl ?? ""}
                    onChange={(event) => field("externalUrl", event.target.value || null)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${baseId}-rules`}>Règlement complet</label>
                  <textarea
                    id={`${baseId}-rules`}
                    maxLength={20000}
                    value={value.fullRules ?? value.rules}
                    onChange={(event) => field("fullRules", event.target.value || null)}
                  />
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={value.requireEntry}
                    onChange={(event) => field("requireEntry", event.target.checked)}
                  />
                  <span>Exiger une fiche publiée</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={value.isFeatured}
                    onChange={(event) => field("isFeatured", event.target.checked)}
                  />
                  <span>Mettre à la une</span>
                </label>
              </>
            )}
            {value.contestType === "WEIGHT_GUESS" && (
              <>
                <div className="field">
                  <label htmlFor={`${baseId}-weight`}>Poids secret *</label>
                  <input
                    id={`${baseId}-weight`}
                    type="number"
                    min="0"
                    step="any"
                    value={value.secretWeight ?? ""}
                    onChange={(event) =>
                      field("secretWeight", event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${baseId}-unit`}>Unité *</label>
                  <select
                    id={`${baseId}-unit`}
                    value={value.weightUnit ?? ""}
                    onChange={(event) =>
                      field("weightUnit", event.target.value as ContestFormValue["weightUnit"])
                    }
                  >
                    <option value="">Choisir</option>
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="CUSTOM">Personnalisée</option>
                  </select>
                </div>
                {value.weightUnit === "CUSTOM" && (
                  <div className="field">
                    <label htmlFor={`${baseId}-custom-unit`}>Nom de l’unité</label>
                    <input
                      id={`${baseId}-custom-unit`}
                      maxLength={30}
                      value={value.customWeightUnit ?? ""}
                      onChange={(event) => field("customWeightUnit", event.target.value || null)}
                    />
                  </div>
                )}
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={value.allowGuessEditing ?? false}
                    onChange={(event) => field("allowGuessEditing", event.target.checked)}
                  />
                  <span>Autoriser la modification d’une estimation</span>
                </label>
                <div className="field field--wide">
                  <label htmlFor={`${baseId}-result-image`}>Photo secrète du résultat</label>
                  <input
                    id={`${baseId}-result-image`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(event) => setResultImage(event.target.files?.[0] ?? null)}
                  />
                </div>
              </>
            )}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={value.notifyTelegramOnPublish ?? false}
                onChange={(event) => field("notifyTelegramOnPublish", event.target.checked)}
              />
              <span>Annoncer la publication sur Telegram</span>
            </label>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="admin-contest-form__section contest-preview-card">
          <header>
            <Sparkles aria-hidden="true" />
            <div>
              <h3>Dernière vérification</h3>
              <p>Les détails privés ne seront visibles qu’après une participation acceptée.</p>
            </div>
          </header>
          <dl>
            <div>
              <dt>Type</dt>
              <dd>{contestTypes.find((type) => type.value === value.contestType)?.label}</dd>
            </div>
            <div>
              <dt>Titre</dt>
              <dd>{value.title || "À compléter"}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>
                {new Intl.DateTimeFormat("fr-CH", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Europe/Zurich",
                }).format(new Date(value.endsAt))}
              </dd>
            </div>
            <div>
              <dt>Places</dt>
              <dd>{unlimited ? "Illimitées" : value.maxParticipants}</dd>
            </div>
          </dl>
        </section>
      )}

      {error && (
        <p className="admin-action-feedback" role="alert">
          {error}
        </p>
      )}
      <div className="button-row admin-contest-wizard__actions">
        {step > 1 && (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setStep((current) => current - 1)}
          >
            <ArrowLeft aria-hidden="true" /> Retour
          </button>
        )}
        {step < 4 ? (
          <button
            className="button button--dark"
            type="button"
            onClick={() => setStep((current) => current + 1)}
          >
            Continuer <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              className="button button--secondary"
              type="submit"
              name="intent"
              value="draft"
              disabled={pending}
            >
              <Save aria-hidden="true" /> Enregistrer en brouillon
            </button>
            <button
              className="button button--dark"
              type="submit"
              name="intent"
              value="publish"
              disabled={pending}
            >
              <Sparkles aria-hidden="true" /> {pending ? "Enregistrement…" : submitLabel}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
