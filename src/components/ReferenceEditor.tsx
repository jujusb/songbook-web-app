'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { saveSongReferencesAction } from '@/app/actions';
import { ReferenceVisualPicker } from '@/components/ReferenceVisualPicker';

interface ReferenceLocation {
  line?: number;
  verse?: string;
  chorus?: string;
  highlight?: string;
  highlights?: Record<string, string>;
}

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  texts?: Record<string, string>;
  highlight?: string;
  highlights?: Record<string, string>;
  locations?: ReferenceLocation[];
}

export function ReferenceEditor({
  references: initial,
  songId,
  languages,
  content,
  lang,
  onClose,
}: {
  references: Reference[];
  songId: string;
  languages: string[];
  content: string;
  lang: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [refs, setRefs] = useState<Reference[]>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'form' | 'visual'>('form');

  const updateRef = (index: number, field: keyof Reference, value: unknown) => {
    setRefs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  };

  const updateRefTexts = (index: number, lang: string, value: string) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[index] };
      const texts = { ...(ref.texts || {}) };
      if (value) {
        texts[lang] = value;
      } else {
        delete texts[lang];
      }
      if (Object.keys(texts).length > 0) {
        ref.texts = texts;
      } else {
        ref.texts = undefined;
      }
      next[index] = ref;
      return next;
    });
    setDirty(true);
  };

  const updateRefHighlights = (index: number, lang: string, value: string) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[index] };
      const highlights = { ...(ref.highlights || {}) };
      if (value) {
        highlights[lang] = value;
      } else {
        delete highlights[lang];
      }
      if (Object.keys(highlights).length > 0) {
        ref.highlights = highlights;
      } else {
        ref.highlights = undefined;
      }
      next[index] = ref;
      return next;
    });
    setDirty(true);
  };

  const addLocation = (refIndex: number) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[refIndex] };
      const locations = [...(ref.locations || [])];
      locations.push({ verse: '', chorus: '', line: undefined, highlight: '', highlights: {} });
      ref.locations = locations;
      next[refIndex] = ref;
      return next;
    });
    setDirty(true);
  };

  const updateLocation = (refIndex: number, locIndex: number, field: keyof ReferenceLocation, value: unknown) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[refIndex] };
      const locations = [...(ref.locations || [])];
      locations[locIndex] = { ...locations[locIndex], [field]: value };
      ref.locations = locations;
      next[refIndex] = ref;
      return next;
    });
    setDirty(true);
  };

  const updateLocationHighlights = (refIndex: number, locIndex: number, lang: string, value: string) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[refIndex] };
      const locations = [...(ref.locations || [])];
      const loc = { ...locations[locIndex] };
      const highlights = { ...(loc.highlights || {}) };
      if (value) {
        highlights[lang] = value;
      } else {
        delete highlights[lang];
      }
      if (Object.keys(highlights).length > 0) {
        loc.highlights = highlights;
      } else {
        loc.highlights = undefined;
      }
      locations[locIndex] = loc;
      ref.locations = locations;
      next[refIndex] = ref;
      return next;
    });
    setDirty(true);
  };

  const removeLocation = (refIndex: number, locIndex: number) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[refIndex] };
      const locations = (ref.locations || []).filter((_, i) => i !== locIndex);
      ref.locations = locations.length > 0 ? locations : undefined;
      next[refIndex] = ref;
      return next;
    });
    setDirty(true);
  };

  const addRef = () => {
    setRefs((prev) => [
      ...prev,
      { type: 'link', label: '', target: '', text: '', highlight: '' },
    ]);
    setDirty(true);
  };

  const removeRef = (index: number) => {
    setRefs((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  /**
   * Attach a visually-picked location to an existing reference, migrating any
   * legacy flat verse/chorus/line fields into the locations array.
   */
  const addLocationToRef = (refIndex: number, loc: ReferenceLocation) => {
    setRefs((prev) => {
      const next = [...prev];
      const ref = { ...next[refIndex] };
      const locations = [...(ref.locations || [])];
      locations.push(loc);
      const cleaned: Reference = { ...ref, locations };
      delete cleaned.line;
      delete cleaned.verse;
      delete cleaned.chorus;
      next[refIndex] = cleaned;
      return next;
    });
    setDirty(true);
  };

  /** Append a new reference created from the visual picker. */
  const addNewRef = (ref: Reference) => {
    setRefs((prev) => [...prev, ref]);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSongReferencesAction(songId, refs);
      setDirty(false);
    } catch (err) {
      console.error('Save references failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 bg-black/50">
      <div className={`bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 w-full ${mode === 'visual' ? 'max-w-full' : 'max-w-full'} max-h-[85vh] flex flex-col`}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 gap-3">
          <h2 className="font-semibold text-lg">{t('song.referencesEditor')}</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 mr-2">
              <button
                onClick={() => setMode('form')}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  mode === 'form'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => setMode('visual')}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  mode === 'visual'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {t('editor.visual')}
              </button>
            </div>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        {/* Body */}
        {mode === 'visual' ? (
          <ReferenceVisualPicker
            source={content}
            refs={refs}
            lang={lang}
            languages={languages}
            onAddLocationToRef={addLocationToRef}
            onAddNewRef={addNewRef}
          />
        ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {refs.map((ref, ri) => (
            <div
              key={ri}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  #{ri + 1}
                </span>
                <button
                  onClick={() => removeRef(ri)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>

              {/* Type + Label + Target */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-neutral-500 mb-0.5">Type</label>
                  <select
                    value={ref.type}
                    onChange={(e) => updateRef(ri, 'type', e.target.value)}
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent"
                  >
                    <option value="link">Link</option>
                    <option value="song">Song</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-0.5">{t('song.edit')} Label</label>
                  <input
                    type="text"
                    value={ref.label}
                    onChange={(e) => updateRef(ri, 'label', e.target.value)}
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-0.5">Target</label>
                  <input
                    type="text"
                    value={ref.target}
                    onChange={(e) => updateRef(ri, 'target', e.target.value)}
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent"
                  />
                </div>
              </div>

              {/* Text (default) */}
              <div>
                <label className="block text-xs text-neutral-500 mb-0.5">Text (default)</label>
                <textarea
                  rows={2}
                  value={ref.text || ''}
                  onChange={(e) => updateRef(ri, 'text', e.target.value || undefined)}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent resize-none"
                />
              </div>

              {/* Per-language texts */}
              {languages.length > 1 && (
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Text per language</label>
                  <div className="space-y-1">
                    {languages.map((lang) => (
                      <div key={lang} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-6 text-neutral-400 uppercase">{lang}</span>
                        <input
                          type="text"
                          value={(ref.texts || {})[lang] || ''}
                          onChange={(e) => updateRefTexts(ri, lang, e.target.value)}
                          className="flex-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Highlight (default) */}
              <div>
                <label className="block text-xs text-neutral-500 mb-0.5">Highlight (default)</label>
                <input
                  type="text"
                  value={ref.highlight || ''}
                  onChange={(e) => updateRef(ri, 'highlight', e.target.value || undefined)}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent"
                />
              </div>

              {/* Per-language highlights */}
              {languages.length > 1 && (
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Highlight per language</label>
                  <div className="space-y-1">
                    {languages.map((lang) => (
                      <div key={lang} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-6 text-neutral-400 uppercase">{lang}</span>
                        <input
                          type="text"
                          value={(ref.highlights || {})[lang] || ''}
                          onChange={(e) => updateRefHighlights(ri, lang, e.target.value)}
                          className="flex-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locations */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Locations</span>
                  <button
                    onClick={() => addLocation(ri)}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    + Add
                  </button>
                </div>
                {(ref.locations || []).map((loc, li) => (
                  <div
                    key={li}
                    className="ml-2 pl-3 border-l-2 border-neutral-200 dark:border-neutral-700 space-y-1.5 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">#{li + 1}</span>
                      <button
                        onClick={() => removeLocation(ri, li)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-0.5">Verse</label>
                        <input
                          type="text"
                          value={loc.verse || ''}
                          onChange={(e) => updateLocation(ri, li, 'verse', e.target.value || undefined)}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-0.5">Chorus</label>
                        <input
                          type="text"
                          value={loc.chorus || ''}
                          onChange={(e) => updateLocation(ri, li, 'chorus', e.target.value || undefined)}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-0.5">Line</label>
                        <input
                          type="number"
                          value={loc.line ?? ''}
                          onChange={(e) => updateLocation(ri, li, 'line', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-0.5">Highlight (per location)</label>
                      <input
                        type="text"
                        value={loc.highlight || ''}
                        onChange={(e) => updateLocation(ri, li, 'highlight', e.target.value || undefined)}
                        className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-transparent"
                      />
                    </div>
                    {languages.length > 1 && (
                      <div>
                        <label className="block text-xs text-neutral-500 mb-0.5">Highlight per language</label>
                        <div className="space-y-0.5">
                          {languages.map((lang) => (
                            <div key={lang} className="flex items-center gap-2">
                              <span className="text-xs font-mono w-6 text-neutral-400 uppercase">{lang}</span>
                              <input
                                type="text"
                                value={(loc.highlights || {})[lang] || ''}
                                onChange={(e) => updateLocationHighlights(ri, li, lang, e.target.value)}
                                className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 bg-transparent"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add reference button */}
          <button
            onClick={addRef}
            className="w-full py-2 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-400 transition-colors"
          >
            + Add Reference
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
