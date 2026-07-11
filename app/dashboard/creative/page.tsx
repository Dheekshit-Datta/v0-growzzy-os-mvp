import { redirect } from "next/navigation"

export default function LegacyCreativeRedirectPage() {
  redirect("/dashboard/creatives/generate")
}
