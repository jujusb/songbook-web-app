"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { revertSongToRevisionAction, publishRevisionAction } from "@/app/actions";

interface Revision {
  timestamp: string;
  file: string;
}

interface RevisionSidebarProps {
  songId: string;
  lang: string;
}

function RevisionItem({
  rev,
  publishedRevision,
  selectedRevision,
  showContent,
  revisionContent,
  formatTimestamp,
  loadRevisionContent,
  handleRevert,
  handlePublish,
  busy,
  t,
}: {
  rev: { timestamp: string; file: string };
  publishedRevision: string | null;
  selectedRevision: string | null;
  showContent: boolean;
  revisionContent: string;
  formatTimestamp: (ts: string) => string;
  loadRevisionContent: (timestamp: string) => void;
  handleRevert: (timestamp: string) => void;
  handlePublish: (timestamp: string) => void;
  busy: string | null;
  t: (key: string) => string;
}) {
  const isPublished = publishedRevision === rev.timestamp;
  return (
    <div key={rev.file} className="p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400 truncate">
            {formatTimestamp(rev.timestamp)}
          </span>
          {isPublished && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              {t('revisions.published')}
            </span>
          )}
          <button
            onClick={() => loadRevisionContent(rev.timestamp)}
            className="text-[10px] px-1.5 py-0.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {selectedRevision === rev.timestamp && showContent
              ? t('revisions.hide')
              : t('revisions.view')}
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => handleRevert(rev.timestamp)}
            disabled={busy !== null}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {busy === `revert-${rev.timestamp}`
              ? t('revisions.reverting')
              : t('revisions.revert')}
          </button>
          <button
            onClick={() => handlePublish(rev.timestamp)}
            disabled={busy !== null}
            className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {busy === `publish-${rev.timestamp}`
              ? t('revisions.publishing')
              : t('revisions.publish')}
          </button>
        </div>
      </div>

      {selectedRevision === rev.timestamp && showContent && (
        <div className="mt-2 p-2 bg-neutral-100 dark:bg-neutral-900 rounded text-[10px] max-h-48 overflow-auto">
          <pre className="font-mono whitespace-pre-wrap break-all">
            {revisionContent}
          </pre>
        </div>
      )}
    </div>
  );
}

export function RevisionSidebar({ songId, lang }: { songId: string; lang: string }) {
  const { t } = useTranslation();
  const [revisions, setRevisions] = useState<{ timestamp: string; file: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [revisionContent, setRevisionContent] = useState<string>("");
  const [showContent, setShowContent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [publishedRevision, setPublishedRevision] = useState<string | null>(null);

  useEffect(() => {
    loadRevisions();
    loadPublishedRevision();
  }, [songId, lang]);

  useEffect(() => {
    if (revisions.length > 0 && !showContent) {
      loadRevisionContent(revisions[0].timestamp);
    }
  }, [revisions]);

  const formatTimestamp = useCallback((ts: string) => {
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString();
    } catch {
      return ts;
    }
  }, []);

  const loadPublishedRevision = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/${songId}/translation?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setPublishedRevision(data.publishedRevision || null);
      }
    } catch {}
  }, [songId, lang]);

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/songs/${songId}/revisions?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to load revisions");
      const data = await res.json();
      setRevisions(data.revisions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load revisions");
    } finally {
      setLoading(false);
    }
  }, [songId, lang]);

  const loadRevisionContent = useCallback(async (timestamp: string) => {
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
  }, [songId, lang, selectedRevision, showContent]);

  const handleRevert = useCallback(async (timestamp: string) => {
    if (!confirm(t('revisions.confirmRevert'))) return;
    setBusy(`revert-${timestamp}`);
    setError(null);
    try {
      const res = await revertSongToRevisionAction(songId, lang, timestamp);
      if (!res.ok) throw new Error(res.error);
      setShowContent(false);
      setSelectedRevision(null);
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setBusy(null);
    }
  }, [songId, lang, t]);

  const handlePublish = useCallback(async (timestamp: string) => {
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
  }, [songId, lang, t]);

  if (loading) return <div className="p-4 text-center text-neutral-500">Loading revisions...</div>;

  const revisionList = useMemo(() => {
    if (revisions.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-center text-neutral-500 text-sm">
          {t('revisions.noRevisions')}
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
        {revisions.map((rev) => (
          <RevisionItem
            key={rev.file}
            rev={rev}
            publishedRevision={publishedRevision}
            selectedRevision={selectedRevision}
            showContent={showContent}
            revisionContent={revisionContent}
            formatTimestamp={formatTimestamp}
            loadRevisionContent={loadRevisionContent}
            handleRevert={handleRevert}
            handlePublish={handlePublish}
            busy={busy}
            t={t}
          />
        ))}
      </div>
    );
  }, [revisions, publishedRevision, selectedRevision, showContent, revisionContent, formatTimestamp, loadRevisionContent, handleRevert, handlePublish, busy, t]);

  if (loading) return <div className="p-4 text-center text-neutral-500">Loading revisions...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="font-semibold text-sm">{t('revisions.title')}</h3>
      </div>

      {error && (
        <div className="m-3 px-3 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}

      {revisionList}
    </div>
  );
}