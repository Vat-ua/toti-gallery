import Link from "next/link";
import type { Person } from "@/lib/types";
import { Avatar } from "./ui";
import { Icon } from "./icon";

export function ProfileSummary({ person, isOwner, projectCount, totalLikes }: {
  person: Person; isOwner: boolean; projectCount: number; totalLikes: number;
}) {
  return <section className="profile-summary">
    <Avatar person={person} size={108}/>
    <div className="profile-info">
      <h1>{person.name}</h1>
      <div className="profile-cohort">
        <Icon name="users" size={14}/>
        <span>{person.cohort}{person.courseName && <> — {person.courseName}</>}{person.year > 0 && <> · {person.year}</>}</span>
      </div>
      {person.bio && <p>{person.bio}</p>}
      <div className="profile-stats">
        <span><strong>{projectCount}</strong> {projectCount === 1 ? "projeto" : "projetos"}</span>
        <span><strong>{totalLikes}</strong> curtidas recebidas</span>
      </div>
    </div>
    {(isOwner || person.github || person.linkedin) && <div className="profile-actions">
      {(person.github || person.linkedin) && <div className="profile-socials">
        {person.github && <a className="button button-outline" href={person.github} target="_blank" rel="noopener noreferrer"><Icon name="github" size={16}/>GitHub<Icon name="arrow-up-right" size={14}/></a>}
        {person.linkedin && <a className="button button-outline" href={person.linkedin} target="_blank" rel="noopener noreferrer"><Icon name="linkedin" size={16}/>LinkedIn<Icon name="arrow-up-right" size={14}/></a>}
      </div>}
      {isOwner && <Link href="/minha-conta" className="button button-dark"><Icon name="edit" size={16}/>Editar perfil</Link>}
    </div>}
  </section>;
}
