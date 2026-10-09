"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { revertSongToRevisionAction, publishRevisionAction } from "@/app/actions";

interface Revision {
  timestamp: string;
  file: string;
}

interface RevisionPanelProps {
  songId: string;
  lang: string;
}

export function RevisionPanel({ songId, lang }: RevisionPanelProps) {
  const { t } = useTranslation();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [revisionContent, setRevisionContent] = useState<string>("");
  const [showContent, setShowContent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadRevisionContent = async (timestamp: string) => {
    if (selectedRevision === timestamp && showContent) {
      setShowContent(false);
      setSelectedRevision(null);
      return;
    }
    try {
      const res = await fetch(`/api/songs/${songId}/revisions/${timestamp}?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to load revision");
      const data = await res.json();
      setRevisionContent(data.content);
      setSelectedRevision(timestamp);
      setShowContent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load revision");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/songs/${songId}/revisions?lang=${lang}`);
        if (!res.ok) throw new Error("Failed to load revisions");
        const data = await res.json();
        const list: Revision[] = data.revisions || [];
        if (cancelled) return;
        setRevisions(list);
        if (list.length > 0) {
          const contentRes = await fetch(
            `/api/songs/${songId}/revisions/${list[0].timestamp}?lang=${lang}`
          );
          if (!contentRes.ok) throw new Error("Failed to load revision");
          const contentData = await contentRes.json();
          if (cancelled) return;
          setRevisionContent(contentData.content);
          setSelectedRevision(list[0].timestamp);
          setShowContent(true);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load revisions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [songId, lang]);

  const formatTimestamp = (ts: string) => {
    // ts is in ISO format like "2024-03-01T12:00:00.000Z"
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  const handleRevert = async (timestamp: string) => {
    if (!confirm(t('revisions.confirmRevert'))) return;
    setBusy(`revert-${timestamp}`);
    setError(null);
    try {
      const res = await revertSongToRevisionAction(songId, lang, timestamp);
      if (!res.ok) throw new Error(res.error);
      setShowContent(false);
      setSelectedRevision(null);
      // Reload page to show updated content
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async (timestamp: string) => {
    if (!confirm(t('revisions.confirmPublish'))) return;
    setBusy(`publish-${timestamp}`);
    setError(null);
    try {
      const res = await publishRevisionAction(songId, lang, timestamp);
      if (!res.ok) throw new Error(res.error);
      setShowContent(false);
      setSelectedRevision(null);
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-4 text-center text-neutral-500">Loading revisions...</div>;

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-lg font-semibold">{t('revisions.title')}</h3>
      </div>
      
      {error && (
        <div className="mx-4 mt-3 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {revisions.length === 0 ? (
        <div className="p-8 text-center text-neutral-500">
          {t('revisions.noRevisions')}
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {revisions.map((rev) => (
            <div key={rev.file} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
                    {formatTimestamp(rev.timestamp)}
                  </span>
                  <button
                    onClick={() => loadRevisionContent(rev.timestamp)}
                    className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {showContent && selectedRevision === rev.timestamp 
                      ? t('revisions.hide') 
                      : t('revisions.view')}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRevert(rev.timestamp)}
                    disabled={busy !== null}
                    className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {busy === `revert-${rev.timestamp}` 
                      ? t('revisions.reverting') 
                      : t('revisions.revert')}
                  </button>
                  <button
                    onClick={() => handlePublish(rev.timestamp)}
                    disabled={busy !== null}
                    className="text-xs px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {busy === `publish-${rev.timestamp}` 
                      ? t('revisions.publishing') 
                      : t('revisions.publish')}
                  </button>
                </div>
              </div>

              {showContent && selectedRevision === rev.timestamp && (
                <div className="mt-3 p-3 bg-neutral-100 dark:bg-neutral-900 rounded-md max-h-64 overflow-auto">
                  <pre className="font-mono text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-all">
                    {revisionContent}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}