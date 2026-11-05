"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/types";
import { Avatar, useToast } from "./ui";
import { Icon } from "./icon";
import { FieldError, useFormFeedback } from "./form-feedback";
import { validateProfile, validatePasswordChange } from "@/lib/account";
import { responseError } from "@/lib/form-validation";
import { validateImageFile } from "@/lib/image-policy";

function PasswordField({ id, label, autoComplete, help, error, clear }: { id: string; label: string; autoComplete: "current-password" | "new-password"; help?: string; error?: string; clear: () => void }) {
  const [visible, setVisible] = useState(false);
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-field">
      <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 15 : 1} maxLength={128} aria-invalid={!!error} onChange={clear} aria-describedby={[help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}/>
      <button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name="eye" size={17}/></button>
    </div>
    <FieldError id={`${id}-error`} text={error}/>
    {help && <small id={`${id}-help`}>{help}</small>}
  </div>;
}

export function AccountForm({ user, email, canChangePassword }: { user: Person; email: string; canChangePassword: boolean }) {
  const router = useRouter();
  const notify = useToast();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [github, setGithub] = useState(user.github || "");
  const [linkedin, setLinkedin] = useState(user.linkedin || "");
  const [avatar, setAvatar] = useState(user.avatar);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const profileFeedback = useFormFeedback();
  const passwordFeedback = useFormFeedback();
  const profileError = profileFeedback.error, passwordError = passwordFeedback.error;
  const fields = profileFeedback.fields;
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (avatar?.startsWith("blob:")) URL.revokeObjectURL(avatar); }, [avatar]);

  function signInAgain() {
    router.push("/entrar?next=%2Fminha-conta");
    router.refresh();
  }

  function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    profileFeedback.clear("avatar");
    try {
      validateImageFile(file);
      setPhotoFile(file);
      setAvatar(URL.createObjectURL(file));
    } catch (error) { profileFeedback.report(error); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (savingProfile) return;
    if (!profileFeedback.validate(() => validateProfile({ name, bio, github, linkedin, avatar: photoFile ? null : avatar }, avatar), formElement)) return;
    setSavingProfile(true);
    try {
      const form = new FormData();
      form.set("data", JSON.stringify({ name, bio, avatar: photoFile ? null : avatar, github, linkedin }));
      if (photoFile) form.set("image", photoFile);
      const response = await fetch("/api/account", { method: "PATCH", body: form });
      if (response.status === 401) { signInAgain(); return; }
      const data = await response.json();
      if (!response.ok) throw responseError(data, "Não foi possível salvar seu perfil.");
      setName(data.user.name); setBio(data.user.bio); setGithub(data.user.github || ""); setLinkedin(data.user.linkedin || ""); setAvatar(data.user.avatar);
      setPhotoFile(null);
      notify("Perfil atualizado.");
      router.refresh();
    } catch (error) { profileFeedback.report(error, formElement); }
    finally { setSavingProfile(false); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (savingPassword) return;
    if (!passwordFeedback.validate(() => validatePasswordChange(Object.fromEntries(data)), form)) return;
    setSavingPassword(true);
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      if (response.status === 401) { signInAgain(); return; }
      const result = await response.json();
      if (!response.ok) throw responseError(result, "Não foi possível alterar sua senha.");
      form.reset();
      notify("Senha alterada. As outras sessões foram encerradas.");
      router.refresh();
    } catch (error) { passwordFeedback.report(error, form); }
    finally { setSavingPassword(false); }
  }

  return <main id="conteudo" className="container inner-page">
    <Link href={`/pessoas/${user.slug}`} className="back-link"><Icon name="arrow-left" size={16}/>Meu perfil</Link>
    <div className="page-heading"><div className="page-intro"><h1>Editar perfil</h1><p>Atualize seu perfil e mantenha seu acesso seguro.</p></div></div>
    <div className="account-layout">
      <form noValidate aria-busy={savingProfile} onSubmit={saveProfile} aria-labelledby="account-profile-title">
        <h2 id="account-profile-title" className="account-section-title">Perfil</h2>
        <fieldset className="account-fieldset" disabled={savingProfile}>
          <div className="account-photo" data-field="avatar">
            <Avatar key={avatar || "initials"} person={{ name: name || user.name, avatar }} size={88}/>
            <div className="account-photo-actions">
              <input ref={fileRef} id="account-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadPhoto}/>
              <div className="account-photo-buttons">
                <button type="button" className="photo-change" aria-describedby={fields.avatar ? "account-avatar-error" : undefined} onClick={() => fileRef.current?.click()}><Icon name={avatar ? "edit" : "plus"} size={15}/>{avatar ? "Alterar foto" : "Adicionar foto"}</button>
                {avatar && <button type="button" className="photo-remove" aria-label="Remover foto" onClick={() => { setAvatar(null); setPhotoFile(null); }}><Icon name="trash" size={16}/>Remover</button>}
              </div>
              <small>JPG, PNG ou WebP, até 3 MB. Recorte quadrado, centralizado.</small>
            </div>
          </div>
          <FieldError id="account-avatar-error" text={fields.avatar}/>
          <div className="form-field"><label htmlFor="account-name">Nome</label><input id="account-name" name="name" aria-invalid={!!fields.name} aria-describedby={fields.name ? "account-name-error" : undefined} value={name} onChange={event => { setName(event.target.value); profileFeedback.clear("name"); }} autoComplete="name" required minLength={2} maxLength={70}/><FieldError id="account-name-error" text={fields.name}/></div>
          <div className="form-field"><label htmlFor="account-bio">Apresentação (opcional)</label><textarea id="account-bio" name="bio" aria-invalid={!!fields.bio} value={bio} onChange={event => { setBio(event.target.value); profileFeedback.clear("bio"); }} rows={4} maxLength={600} aria-describedby={`account-bio-help${fields.bio ? " account-bio-error" : ""}`}/><FieldError id="account-bio-error" text={fields.bio}/><small id="account-bio-help">Conte um pouco sobre você. Até 600 caracteres.</small></div>
          <div className="form-field"><label htmlFor="account-github">GitHub (opcional)</label><input id="account-github" name="github" aria-invalid={!!fields.github} aria-describedby={fields.github ? "account-github-error" : undefined} type="url" value={github} onChange={event => { setGithub(event.target.value); profileFeedback.clear("github"); }} placeholder="https://github.com/seu-usuario" maxLength={2000}/><FieldError id="account-github-error" text={fields.github}/></div>
          <div className="form-field"><label htmlFor="account-linkedin">LinkedIn (opcional)</label><input id="account-linkedin" name="linkedin" aria-invalid={!!fields.linkedin} aria-describedby={fields.linkedin ? "account-linkedin-error" : undefined} type="url" value={linkedin} onChange={event => { setLinkedin(event.target.value); profileFeedback.clear("linkedin"); }} placeholder="https://www.linkedin.com/in/seu-perfil" maxLength={2000}/><FieldError id="account-linkedin-error" text={fields.linkedin}/></div>
          <dl className="account-details" aria-label="Dados de acesso"><div><dt>Email</dt><dd>{email}</dd></div><div><dt>Turma</dt><dd>{user.cohort}</dd></div></dl>
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
          <div className="account-form-actions"><button type="submit" className="button button-dark">{savingProfile && <Icon name="loader" size={17} className="spinner"/>}{savingProfile ? "Salvando..." : "Salvar alterações"}</button></div>
        </fieldset>
      </form>
      <section className="account-security" aria-labelledby="account-password-title">
          <h2 id="account-password-title" className="account-section-title">Senha</h2>
          {canChangePassword ? <form noValidate aria-busy={savingPassword} onSubmit={savePassword} aria-labelledby="account-password-title">
            <p className="account-help">Confirme sua senha atual para definir uma nova.</p>
            <fieldset className="account-fieldset" disabled={savingPassword}>
              <PasswordField error={passwordFeedback.fields.currentPassword} clear={() => passwordFeedback.clear("currentPassword")} id="currentPassword" label="Senha atual" autoComplete="current-password"/>
              <PasswordField error={passwordFeedback.fields.newPassword} clear={() => passwordFeedback.clear("newPassword")} id="newPassword" label="Nova senha" autoComplete="new-password" help="Use de 15 a 128 caracteres."/>
              <PasswordField error={passwordFeedback.fields.confirmPassword} clear={() => passwordFeedback.clear("confirmPassword")} id="confirmPassword" label="Confirmar nova senha" autoComplete="new-password"/>
              {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
              <div className="account-form-actions"><button type="submit" className="button button-dark">{savingPassword && <Icon name="loader" size={17} className="spinner"/>}{savingPassword ? "Alterando..." : "Alterar senha"}</button></div>
            </fieldset>
          </form> : <p className="account-help">Sua conta usa o Google e ainda não tem uma senha. Peça à administração um link para definir uma senha e também entrar por email.</p>}
      </section>
    </div>
  </main>;
}
