import { notFound, redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { ArtistForm } from "@/components/ArtistForm";

export default async function NewArtistPage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  return (
    <ArtistForm
      initialArtist={{
        id: "",
        name: "",
        bio: "",
        website: "",
        tags: "",
      }}
      isNew={true}
    />
  );
}
