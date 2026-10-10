"use client";

import { useState } from "react";
import { updateMyVoicePreferenceAction } from "@/app/actions";
import { useTranslation } from "@/lib/i18n";

const VOICES = ["tenor", "bass", "alto", "soprano"] as const;

type VoiceId = (typeof VOICES)[number];
type Selection = VoiceId | "none";

export function ProfileVoiceForm({ initialVoice }: { initialVoice?: string }) {
  const { t } = useTranslation();
  const [voice, setVoice] = useState<Selection>(
    initialVoice && VOICES.some((v) => v === initialVoice)
      ? (initialVoice as VoiceId)
      : "none",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionLabel = (section: VoiceId) =>
    t(`voice.sections.${section}`);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    const result = await updateMyVoicePreferenceAction(
      voice === "none" ? null : voice,
    );
    setSaving(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error === "INVALID_VOICE" ? "Invalid voice" : t('profile.failed'));
    }
  };

  const handleSelect = (id: VoiceId) => {
    if (voice !== id) setSaved(false);
    setVoice(id);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{t('profile.voice')}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.voiceDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {VOICES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleSelect(v)}
            aria-pressed={voice === v}
            className={`px-3 py-2 rounded-md border text-sm transition-colors ${
              voice === v
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-blue-500"
            }`}
          >
            {sectionLabel(v)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setVoice("none");
            setSaved(false);
          }}
          aria-pressed={voice === "none"}
          className={`px-3 py-2 rounded-md border text-sm transition-colors ${
            voice === "none"
              ? "bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200"
              : "border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-500"
          }`}
        >
          {t('profile.noVoice')}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400">
            {t('profile.saved')}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
      <p className="mt-4 text-xs text-neutral-500">{t('profile.notes')}</p>
    </div>
  );
}