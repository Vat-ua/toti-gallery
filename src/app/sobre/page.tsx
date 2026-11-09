import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { getPublicIdentity } from "@/lib/public-identity";
import { sharingMetadata } from "@/lib/metadata";

export const metadata: Metadata = sharingMetadata({
  title: "Sobre",
  description: "Descubra a Toti Gallery, um espaço para compartilhar e valorizar projetos de pessoas da comunidade Toti.",
  path: "/sobre",
});

export default function AboutPage() {
  return <main id="conteudo" className="container inner-page">
    <Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Projetos</Link>
    <article className="page-intro about-content">
      <div className="page-heading"><div className="page-intro">
        <h1>Sobre a Toti Gallery</h1>
        <p>A Toti Gallery é um espaço para descobrir, compartilhar e valorizar projetos desenvolvidos por pessoas da comunidade Toti.</p>
      </div></div>

      <section className="about-section" aria-labelledby="about-origin">
        <h2 id="about-origin">Como surgiu</h2>
        <p>A Toti Gallery surgiu como um projeto independente durante o curso de desenvolvimento web da Toti. A ideia era criar um espaço onde as pessoas pudessem compartilhar seus trabalhos, conhecer os projetos de colegas e encontrar inspiração para criar algo novo.</p>
        <p>Aprender fazendo é parte importante desse processo. Ter onde mostrar o que criamos também pode ser um incentivo para experimentar mais, cuidar dos detalhes e melhorar o resultado.</p>
        <p>Aqui, há espaço tanto para experimentos e projetos em desenvolvimento quanto para trabalhos finais.</p>
      </section>

      <section className="about-section" aria-labelledby="about-participation">
        <h2 id="about-participation">Como participar</h2>
        <p>Qualquer pessoa pode explorar a galeria, descobrir projetos e conhecer quem os criou. Para publicar e gerenciar seus próprios projetos, é necessário ter uma conta cadastrada pela administração.</p>
        <Suspense fallback={null}><DemoInvitation/></Suspense>
      </section>
    </article>
  </main>;
}

async function DemoInvitation() {
  const identity = await getPublicIdentity();
  return identity.status === "ready" && !identity.user ? <p>Quer experimentar? No <Link href="/demo">modo de demonstração</Link>, você pode criar e editar projetos sem cadastro. As alterações ficam salvas apenas no seu navegador.</p> : null;
}
