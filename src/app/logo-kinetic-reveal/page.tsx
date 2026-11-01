import { redirect } from "next/navigation";

export default function LogoKineticRevealPage() {
  redirect("/index.html?reveal=1");
}

