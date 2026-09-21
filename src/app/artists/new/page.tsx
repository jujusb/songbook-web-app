import { redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { ArtistForm } from "@/components/ArtistForm";

export default async function NewArtistPage() {
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
