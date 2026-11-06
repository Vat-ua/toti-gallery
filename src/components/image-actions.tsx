import { Icon } from "./icon";

// Selection and removal stay in the form; the controls share one visual treatment.
export function ImageActions({ changeLabel, hasImage, removeLabel, onChange, onRemove, describedBy, disabled }: {
  changeLabel: string;
  hasImage: boolean;
  removeLabel: string;
  onChange: () => void;
  onRemove: () => void;
  describedBy?: string;
  disabled?: boolean;
}) {
  return <div className="image-actions">
    <button type="button" className="image-change" disabled={disabled} aria-describedby={describedBy} onClick={onChange}><Icon name={hasImage ? "edit" : "plus"} size={16}/>{changeLabel}</button>
    {hasImage && <button type="button" className="image-remove" disabled={disabled} aria-label={removeLabel} onClick={onRemove}><Icon name="trash" size={16}/>Remover</button>}
  </div>;
}
