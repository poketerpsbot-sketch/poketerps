"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

export type AdminSetting = {
  key: string;
  value: unknown;
  valueType?: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "URL" | string;
  description?: string | null;
  isPublic?: boolean;
  isRedacted?: boolean;
  updatedAt?: string | null;
};

function displayValue(setting: AdminSetting) {
  if (setting.valueType === "JSON" || typeof setting.value === "object") {
    return JSON.stringify(setting.value ?? {}, null, 2);
  }
  return String(setting.value ?? "");
}

export function SettingsAdmin({ settings }: { settings: AdminSetting[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function save(event: FormEvent<HTMLFormElement>, setting: AdminSetting) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = String(data.get("value") ?? "");
    const valueType = String(data.get("valueType") ?? setting.valueType ?? "STRING");
    let value: unknown = raw;
    if (valueType === "BOOLEAN") value = raw === "true";
    if (valueType === "NUMBER") {
      value = Number(raw);
      if (!Number.isFinite(value)) {
        setFeedback((current) => ({ ...current, [setting.key]: "Saisis un nombre valide." }));
        return;
      }
    }
    if (valueType === "JSON") {
      try {
        value = JSON.parse(raw) as unknown;
      } catch {
        setFeedback((current) => ({ ...current, [setting.key]: "Le JSON n’est pas valide." }));
        return;
      }
    }
    setPending(setting.key);
    setFeedback((current) => ({ ...current, [setting.key]: "" }));
    const result = await submitJson(
      `/api/admin/settings/${encodeURIComponent(setting.key)}`,
      "PATCH",
      {
        value,
        valueType,
        description: String(data.get("description") ?? "") || null,
        isPublic: data.get("isPublic") === "on",
      },
    );
    setPending("");
    setFeedback((current) => ({
      ...current,
      [setting.key]: result.ok ? "Paramètre enregistré." : result.message,
    }));
    if (result.ok) router.refresh();
  }

  return (
    <div className="admin-settings-grid">
      {settings.map((setting) => {
        const type = setting.valueType ?? "STRING";
        return (
          <form
            className="content-panel form-stack"
            onSubmit={(event) => save(event, setting)}
            key={setting.key}
          >
            <div>
              <p className="eyebrow">Paramètre</p>
              <h2>
                <code>{setting.key}</code>
              </h2>
            </div>
            <input type="hidden" name="valueType" value={type} />
            <div className="field">
              <label htmlFor={`setting-value-${setting.key}`}>Valeur</label>
              {setting.isRedacted ? (
                <input
                  id={`setting-value-${setting.key}`}
                  value="Valeur sensible masquée"
                  disabled
                  aria-describedby={`setting-redacted-${setting.key}`}
                />
              ) : type === "BOOLEAN" ? (
                <select
                  id={`setting-value-${setting.key}`}
                  name="value"
                  defaultValue={String(Boolean(setting.value))}
                >
                  <option value="true">Activé</option>
                  <option value="false">Désactivé</option>
                </select>
              ) : type === "JSON" ? (
                <textarea
                  id={`setting-value-${setting.key}`}
                  name="value"
                  rows={7}
                  defaultValue={displayValue(setting)}
                  spellCheck={false}
                />
              ) : (
                <input
                  id={`setting-value-${setting.key}`}
                  name="value"
                  type={type === "NUMBER" ? "number" : type === "URL" ? "url" : "text"}
                  step={type === "NUMBER" ? "any" : undefined}
                  defaultValue={displayValue(setting)}
                  required
                />
              )}
              {setting.isRedacted && (
                <p className="field__hint" id={`setting-redacted-${setting.key}`}>
                  Ce secret ne peut pas être lu ni remplacé depuis cette vue.
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`setting-description-${setting.key}`}>Description interne</label>
              <textarea
                id={`setting-description-${setting.key}`}
                name="description"
                rows={2}
                maxLength={1_500}
                defaultValue={setting.description ?? ""}
              />
            </div>
            <label className="checkbox-field">
              <input type="checkbox" name="isPublic" defaultChecked={Boolean(setting.isPublic)} />
              <span>Lisible par l’interface publique</span>
            </label>
            {feedback[setting.key] && (
              <p className="admin-action-feedback" aria-live="polite">
                {feedback[setting.key]}
              </p>
            )}
            <button
              className="button"
              type="submit"
              disabled={pending === setting.key || setting.isRedacted}
            >
              <Save size={16} aria-hidden="true" />
              {pending === setting.key ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        );
      })}
    </div>
  );
}
