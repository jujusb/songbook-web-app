import { ArtistForm } from "@/components/ArtistForm";

export default function NewArtistPage() {
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
