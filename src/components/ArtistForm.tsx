"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function ArtistForm({
  initialArtist,
  isNew,
}: {
  initialArtist: {
    id: string;
    name: string;
    bio: string;
    website: string;
    tags: string;
  };
  isNew: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialArtist.name);
  const [bio, setBio] = useState(initialArtist.bio);
  const [website, setWebsite] = useState(initialArtist.website);
  const [tags, setTags] = useState(initialArtist.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = isNew
        ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : initialArtist.id;

      const res = await fetch("/api/artists", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: name.trim(),
          bio: bio.trim() || undefined,
          website: website.trim() || undefined,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save artist");
      }

      router.push(`/artists/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [name, bio, website, tags, isNew, initialArtist.id, router]);

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? "New Artist" : `Edit: ${initialArtist.name}`}
      </h1>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Artist or band name"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short biography..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="hymn-writer, worship, contemporary"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : isNew ? "Create Artist" : "Save Artist"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/browse")}
          className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
