import { redirect } from "next/navigation";

// Esta rota não é mais usada — auth migrado para bcrypt + iron-session
export default function AuthCallbackPage() {
  redirect("/login");
}
