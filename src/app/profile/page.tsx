import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, createT } from "@/lib/i18n/server";
import { ProfileVoiceForm } from "@/components/ProfileVoiceForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const uiLocale = getLocale(cookieStore, 'en');
  const t = createT(uiLocale);

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-1">{t('profile.title')}</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        {user.displayName || user.username}
      </p>
      <ProfileVoiceForm initialVoice={user.voice} />
    </div>
  );
}