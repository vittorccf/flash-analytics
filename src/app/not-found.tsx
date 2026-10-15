import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Página não encontrada</h1>
        <Link href="/" className={`${buttonClass()} mt-6`}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
