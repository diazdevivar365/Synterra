import { redirect } from 'next/navigation';

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/settings/general`);
}
