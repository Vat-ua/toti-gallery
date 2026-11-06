import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { sharingMetadata } from "@/lib/metadata";

export const metadata: Metadata = sharingMetadata({
  title: "Sobre",
  description: "Conheça a Toti Gallery, uma iniciativa independente de estudantes para compartilhar projetos e aprender em comunidade.",
  path: "/sobre",
});

export default async function AboutPage() {
  const user = await getCurrentUser();
  return <main id="conteudo" className="container inner-page">
    <article className="page-intro about-content">
      <h1>Sobre a Toti Gallery</h1>
      <p>Uma galeria para compartilhar projetos desenvolvidos durante o aprendizado: de exercícios e experimentos a aplicações completas. Um espaço para conhecer outros trabalhos, encontrar inspiração e acompanhar quem está construindo.</p>

      <section className="about-section" aria-labelledby="about-origin">
        <h2 id="about-origin">Como surgiu</h2>
        <p>A Toti Gallery nasceu da iniciativa de estudantes que sentiram falta de um espaço para conhecer e compartilhar os projetos da comunidade. É um projeto independente, ainda sem vínculo oficial com a Toti Diversidade.</p>
      </section>

      <section className="about-section" aria-labelledby="about-participation">
        <h2 id="about-participation">Como participar</h2>
        <p>Qualquer pessoa pode explorar os projetos e os perfis públicos. Para publicar, é necessário ter um cadastro criado pela administração.{!user && <> Se você já tem acesso, <Link href="/entrar">entre na sua conta</Link>.</>}</p>
        {!user && <p>Quem quiser conhecer a experiência de publicação pode experimentar o <Link href="/demo">modo de demonstração</Link>, sem cadastro.</p>}
      </section>
    </article>
  </main>;
}
