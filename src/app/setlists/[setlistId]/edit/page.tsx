import type { Metadata } from "next";
import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp } from "@/lib/config";
import { cookies } from "next/headers";
import { getLocale, createT } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import { getSetlist, getSetlistVersion, listSongs, getSongTranslations, getShareBaseUrl, listSetlistVersionContents , parseSetlistVersionDate } from "@/lib/content";
import { getSession, canEdit, canCreateSetlist, canManageSetlistShares, canManageSetlistHistory } from "@/lib/auth";
import { SetlistEditor } from "@/components/SetlistEditor";
import { SetlistShareControls } from "@/components/SetlistShareControls";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ version?: string; newDate?: string; date?: string }>;
}): Promise<Metadata> {
  const { setlistId } = await params;
  const { version, newDate, date } = await searchParams;
  const t = createT(getLocale(await cookies()));
  try {
    const setlist = await getSetlist(setlistId);
    const isNewDate = newDate === "1" || newDate === "true";
    let when = setlist.date || "";
    if (isNewDate) when = date || "";
    else if (version && version !== "current") {
      const dated = await getSetlistVersion(setlistId, version).catch(() => null);
      when = dated?.date || parseSetlistVersionDate(version) || when;
    }
    if (isNewDate) {
      return { title: when ? t("setlistApp.metaNewDateWhen", { title: setlist.title, when }) : t("setlistApp.metaNewDate", { title: setlist.title }) };
    }
    return { title: when ? t("setlistApp.metaEditWhen", { title: setlist.title, when }) : t("setlistApp.metaEdit", { title: setlist.title }) };
  } catch {
    return { title: t("setlist.editSetlist") };
  }
}

export default async function SetlistEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ version?: string; newDate?: string; date?: string; empty?: string }>;
}) {
  const { setlistId } = await params;
  const { version: versionParam, newDate: newDateParam, date: dateParam, empty: emptyParam } = await searchParams;
  const startEmpty = emptyParam === "1";
  const isNewDate = newDateParam === "1" || newDateParam === "true";
  const prefillDate = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : "";

  let setlist;
  try {
    setlist =
      !isNewDate && versionParam && versionParam !== 'current'
        ? await getSetlistVersion(setlistId, versionParam)
        : await getSetlist(setlistId);
  } catch {
    notFound();
  }

  const t = createT(getLocale(await cookies()));
  const session = await getSession();
  if (!session) redirect("/login");

  const role = session.role ?? null;
  const isEditor = canEdit(role);
  const isOwner = setlist.ownerId === session.userId;

  // Only owners (with setlist rights) and editors may edit; references are read-only.
  const mayEdit = !setlist.sharedFrom && (isEditor || (isOwner && canCreateSetlist(role)));
  if (!mayEdit) {
    redirect(`/setlists/${setlistId}`);
  }

  if (isNewDate && !canManageSetlistHistory(role, setlist, session.userId)) {
    redirect(`/setlists/${setlistId}`);
  }

  const showShareControls = !isNewDate && (isEditor || (isOwner && canManageSetlistShares(role)));
  const publicUrl = await getShareBaseUrl();

  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  // Every dated version, so the date calendar can open an existing date or start a new one.
  const versionContents = await listSetlistVersionContents(setlistId);
  const datedVersions = versionContents
    .map((version) => ({ label: version.label, date: version.eventDate || version.date || "" }))
    .filter((version) => /^\d{4}-\d{2}-\d{2}$/.test(version.date));
  const baseSetlist = await getSetlist(setlistId).catch(() => null);
  const currentDate = baseSetlist?.date ?? "";

  const previousVersions = isNewDate
    ? versionContents.filter(
        (version) => version.label !== setlist.date && version.eventDate !== setlist.date,
      )
    : [];

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {isNewDate ? t("setlistApp.newDateHeading", { title: setlist.title }) : t("setlistApp.editHeading", { title: setlist.title })}
      </h1>

      {showShareControls && (
        <SetlistShareControls
          setlistId={setlist.id}
          isPublic={setlist.public ?? false}
          shareToken={setlist.shareToken}
          shareSlug={setlist.shareSlug}
          publicUrl={publicUrl}
        />
      )}

      <SetlistEditor
        allowedLinkHosts={getSetlistLinkAllowedHosts()}
        allowHttpLinks={getSetlistLinkAllowHttp()}
        availableSongs={songsWithLangs}
        initialSetlist={{
          id: setlist.id,
          title: setlist.title,
          description: setlist.description || "",
          image: setlist.image || "",
          date: isNewDate
            ? prefillDate
            : setlist.date ||
              (versionParam ? datedVersions.find((v) => v.label === versionParam)?.date : undefined) ||
              "",
          songs: setlist.songs,
        }}
        isNew={false}
        newDate={isNewDate}
        previousVersions={previousVersions}
        currentDate={currentDate}
        startEmpty={isNewDate && startEmpty}
        datedVersions={datedVersions}
        versionLabel={!isNewDate && versionParam && versionParam !== 'current' ? versionParam : undefined}
      />
    </div>
  );
}
