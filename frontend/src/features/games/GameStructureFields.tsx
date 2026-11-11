import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useMessages } from "../../i18n";
import { ConfirmDialog, Icon, IconButton } from "../../ui";
import {
  emptyActivity,
  emptyMode,
  emptyRole,
  modePlayers,
  patchItem,
  removeActivity,
  removeItem,
  sumSlots,
  usesOwnLimit,
  type ModeDraft,
  type RoleDraft,
  type StructureDraft,
} from "./gameStructure";

/** The element ID of the entry a local failure is about, and the ID of the error that describes it. */
const FieldErrorContext = createContext<{ fieldId?: string; errorId?: string }>(
  {},
);

type SetDraft = Dispatch<SetStateAction<StructureDraft>>;
type RequestFocus = (elementId: string) => void;

/**
 * The form's error as the structure shows it. `section` is set for an error about the game roles or the modes;
 * `field` names the entry of a local failure, and `modeKey` the mode that entry belongs to.
 */
export type StructureError = {
  errorId: string;
  section?: "roles" | "modes";
  field?: string;
  modeKey?: string;
};

const fieldError = (id: string, { field, errorId }: StructureError) => ({
  fieldId: field && `${id}-${field}`,
  errorId: field && errorId,
});

/** The IDs the game view and the mode view move focus between. */
export const modeRowId = (id: string, modeKey: string) =>
  `${id}-${modeKey}-row`;
export const modeHeadingId = (id: string, modeKey: string) =>
  `${id}-${modeKey}-heading`;
const addModeId = (id: string) => `${id}-add-mode`;

/**
 * The game's part of the structure: its own game roles, offered only while the game has no modes (ADR 0017
 * section 2), and its modes as rows. A row opens that mode's view; the form shows one level at a time.
 * Removing a game role does not ask, because nothing is lost until the game is saved.
 */
export function GameStructureFields({
  id,
  draft,
  setDraft,
  requestFocus,
  error,
  onOpenMode,
}: {
  id: string;
  draft: StructureDraft;
  setDraft: SetDraft;
  requestFocus: RequestFocus;
  error: StructureError;
  onOpenMode: (modeKey: string, focusId: string) => void;
}) {
  const m = useMessages();
  // A section is described only when the entry is unknown (a server failure); a known entry carries the error itself.
  const describedBy = (section: "roles" | "modes") =>
    error.section === section && error.field === undefined
      ? error.errorId
      : undefined;

  return (
    <FieldErrorContext value={fieldError(id, error)}>
      {usesOwnLimit(draft) && (
        <RoleFieldset
          id={id}
          ownerKey="game"
          section="roles"
          describedBy={describedBy("roles")}
          roles={draft.gameRoles}
          onChange={(gameRoles) => setDraft((d) => ({ ...d, gameRoles }))}
          requestFocus={requestFocus}
        />
      )}
      <fieldset
        className="structure"
        data-section="modes"
        aria-describedby={describedBy("modes")}
      >
        <legend>{m.gameModesLegend}</legend>
        <p className="form-hint">{m.gameModesHint}</p>
        {draft.modes.length > 0 && (
          <ul className="structure-list" role="list">
            {draft.modes.map((mode, index) => (
              <li key={mode.key}>
                <ModeRow
                  id={modeRowId(id, mode.key)}
                  mode={mode}
                  position={index + 1}
                  errorId={
                    error.modeKey === mode.key ? error.errorId : undefined
                  }
                  onOpen={() =>
                    onOpenMode(mode.key, modeHeadingId(id, mode.key))
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          id={addModeId(id)}
          className="button button--secondary"
          onClick={() => {
            const mode = emptyMode();
            setDraft((d) => ({ ...d, modes: [...d.modes, mode] }));
            onOpenMode(mode.key, `${id}-${mode.key}-name`);
          }}
        >
          <Icon name="plus" />
          {m.gameModeAdd}
        </button>
      </fieldset>
    </FieldErrorContext>
  );
}

/** A mode in the game view: its name and limits, and the way into its own view. `errorId` is set when the form's error is in this mode. */
function ModeRow({
  id,
  mode,
  position,
  errorId,
  onOpen,
}: {
  id: string;
  mode: ModeDraft;
  position: number;
  errorId?: string;
  onOpen: () => void;
}) {
  const m = useMessages();
  // The name names the button; the summary and the error describe it, so a screen reader hears them apart.
  const describedBy = [`${id}-summary`, errorId && `${id}-error ${errorId}`]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      id={id}
      className="mode-row"
      aria-labelledby={`${id}-name`}
      aria-describedby={describedBy}
      onClick={onOpen}
    >
      <span className="mode-row__text">
        <span id={`${id}-name`} className="mode-row__name">
          {mode.name.trim() || m.gameModeLegend(position)}
        </span>
        <span id={`${id}-summary`} className="form-hint">
          {m.gameModeSummary(modePlayers(mode), mode.activities.length)}
        </span>
        {errorId && (
          <span id={`${id}-error`} className="field-error">
            {m.gameModeHasError}
          </span>
        )}
      </span>
      <span className="mode-row__chevron" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/** A removal waiting for the admin's answer. `apply` removes the entry from the draft. */
type Removal = {
  heading: string;
  body: string;
  submitLabel: string;
  keepLabel: string;
  apply: (draft: StructureDraft) => StructureDraft;
  focusId: string;
};

/**
 * One mode on its own: name, max players or game roles, and activities as flat lists, with the way back to the
 * game. Its edits stay in the form's draft until the game is saved. Removing the mode or an activity asks first.
 */
export function ModeView({
  id,
  mode,
  position,
  setDraft,
  requestFocus,
  error,
  onBack,
}: {
  id: string;
  mode: ModeDraft;
  position: number;
  setDraft: SetDraft;
  requestFocus: RequestFocus;
  error: StructureError;
  onBack: () => void;
}) {
  const m = useMessages();
  const [removal, setRemoval] = useState<Removal>();
  const patch = (change: Partial<ModeDraft>) =>
    setDraft((d) => ({ ...d, modes: patchItem(d.modes, mode.key, change) }));
  const label = mode.name.trim() || m.gameModeLegend(position);
  const headingId = modeHeadingId(id, mode.key);

  return (
    <FieldErrorContext value={fieldError(id, error)}>
      <section className="mode-view" aria-labelledby={headingId}>
        <IconButton icon="back" label={m.gameModeBack} onClick={onBack} />
        <h3 id={headingId} tabIndex={-1} className="mode-view__heading">
          {label}
        </h3>
        <StructureField
          id={`${id}-${mode.key}-name`}
          label={m.gameModeNameLabel}
          value={mode.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
        {mode.gameRoles.length === 0 && (
          <StructureField
            id={`${id}-${mode.key}-max`}
            label={m.gameModeMaxLabel}
            hint={m.gameModeMaxHint}
            inputMode="numeric"
            value={mode.maxPlayers}
            onChange={(event) => patch({ maxPlayers: event.target.value })}
          />
        )}
        <RoleFieldset
          id={id}
          ownerKey={mode.key}
          roles={mode.gameRoles}
          onChange={(gameRoles) => patch({ gameRoles })}
          requestFocus={requestFocus}
        />
        <ActivityFieldset
          id={id}
          mode={mode}
          patch={patch}
          requestFocus={requestFocus}
          askRemoval={setRemoval}
        />
        <button
          type="button"
          className="button button--danger"
          aria-label={`${m.gameModeRemove}, ${label}`}
          onClick={() =>
            setRemoval({
              heading: m.gameModeRemoveHeading(label),
              body: m.gameModeRemoveConfirm,
              submitLabel: m.gameModeRemoveSubmit,
              keepLabel: m.gameModeRemoveKeep,
              focusId: addModeId(id),
              // The view of a removed mode closes by itself: the form finds no open mode any more.
              apply: (d) => ({ ...d, modes: removeItem(d.modes, mode.key) }),
            })
          }
        >
          <Icon name="remove" />
          {m.gameModeRemove}
        </button>
        {removal && (
          <ConfirmDialog
            heading={removal.heading}
            body={removal.body}
            submitLabel={removal.submitLabel}
            submitIcon="remove"
            danger
            keepLabel={removal.keepLabel}
            busy={false}
            onConfirm={async () => {
              setDraft(removal.apply);
              requestFocus(removal.focusId);
              setRemoval(undefined);
              return undefined;
            }}
            onClose={() => setRemoval(undefined)}
          />
        )}
      </section>
    </FieldErrorContext>
  );
}

function ActivityFieldset({
  id,
  mode,
  patch,
  requestFocus,
  askRemoval,
}: {
  id: string;
  mode: ModeDraft;
  patch: (change: Partial<ModeDraft>) => void;
  requestFocus: RequestFocus;
  askRemoval: (removal: Removal) => void;
}) {
  const m = useMessages();
  const addId = `${id}-${mode.key}-add-activity`;
  return (
    <fieldset className="structure">
      <legend>{m.gameActivitiesLegend}</legend>
      <p className="form-hint">{m.gameActivitiesHint}</p>
      {mode.activities.length > 0 && (
        <ul className="structure-list" role="list">
          {mode.activities.map((activity, index) => {
            const activityLabel =
              activity.name.trim() || m.gameActivityLegend(index + 1);
            return (
              <li key={activity.key}>
                <StructureRow
                  legend={m.gameActivityLegend(index + 1)}
                  removeLabel={`${m.gameActivityRemove}, ${activityLabel}`}
                  onRemove={() =>
                    askRemoval({
                      heading: m.gameActivityRemoveHeading(activityLabel),
                      body: m.gameActivityRemoveConfirm,
                      submitLabel: m.gameActivityRemoveSubmit,
                      keepLabel: m.gameActivityRemoveKeep,
                      focusId: addId,
                      apply: (d) => removeActivity(d, mode.key, activity.key),
                    })
                  }
                >
                  <StructureField
                    id={`${id}-${activity.key}-name`}
                    label={m.gameActivityNameLabel}
                    value={activity.name}
                    onChange={(event) =>
                      patch({
                        activities: patchItem(mode.activities, activity.key, {
                          name: event.target.value,
                        }),
                      })
                    }
                  />
                </StructureRow>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        id={addId}
        className="button button--secondary"
        onClick={() => {
          const activity = emptyActivity();
          patch({ activities: [...mode.activities, activity] });
          requestFocus(`${id}-${activity.key}-name`);
        }}
      >
        <Icon name="plus" />
        {m.gameActivityAdd}
      </button>
    </fieldset>
  );
}

/** The game roles of one owner, the game or a mode. `section` marks the game's own list for error focus. */
function RoleFieldset({
  id,
  ownerKey,
  section,
  describedBy,
  roles,
  onChange,
  requestFocus,
}: {
  id: string;
  ownerKey: string;
  section?: string;
  describedBy?: string;
  roles: RoleDraft[];
  onChange: (roles: RoleDraft[]) => void;
  requestFocus: RequestFocus;
}) {
  const m = useMessages();
  const addId = `${id}-${ownerKey}-add-role`;
  return (
    <fieldset
      className="structure"
      data-section={section}
      aria-describedby={describedBy}
    >
      <legend>{m.gameRolesLegend}</legend>
      <p className="form-hint">{m.gameRolesHint}</p>
      {roles.length > 0 && (
        <>
          <ul className="structure-list" role="list">
            {roles.map((role, index) => (
              <li key={role.key}>
                <StructureRow
                  legend={m.gameRoleLegend(index + 1)}
                  removeLabel={`${m.gameRoleRemove}, ${role.name.trim() || m.gameRoleLegend(index + 1)}`}
                  onRemove={() => {
                    onChange(removeItem(roles, role.key));
                    requestFocus(addId);
                  }}
                >
                  <StructureField
                    id={`${id}-${role.key}-name`}
                    label={m.gameRoleNameLabel}
                    value={role.name}
                    onChange={(event) =>
                      onChange(
                        patchItem(roles, role.key, {
                          name: event.target.value,
                        }),
                      )
                    }
                  />
                  <StructureField
                    id={`${id}-${role.key}-slots`}
                    label={m.gameRoleSlotsLabel}
                    inputMode="numeric"
                    value={role.slots}
                    onChange={(event) =>
                      onChange(
                        patchItem(roles, role.key, {
                          slots: event.target.value,
                        }),
                      )
                    }
                  />
                </StructureRow>
              </li>
            ))}
          </ul>
          <p className="form-hint">{m.gameRolesTotal(sumSlots(roles))}</p>
        </>
      )}
      <button
        type="button"
        id={addId}
        className="button button--secondary"
        onClick={() => {
          const role = emptyRole();
          onChange([...roles, role]);
          requestFocus(`${id}-${role.key}-name`);
        }}
      >
        <Icon name="plus" />
        {m.gameRoleAdd}
      </button>
    </fieldset>
  );
}

/** One entry with its remove button. The legend names the entry for a screen reader and is not shown. */
function StructureRow({
  legend,
  removeLabel,
  onRemove,
  children,
}: {
  legend: string;
  removeLabel: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const m = useMessages();
  return (
    <fieldset className="structure-row">
      <legend className="visually-hidden">{legend}</legend>
      {children}
      <button
        type="button"
        className="button button--danger"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <Icon name="remove" />
        {m.gameRemove}
      </button>
    </fieldset>
  );
}

/** A labelled text field of an entry, with an optional hint. */
function StructureField({
  id,
  label,
  hint,
  ...input
}: ComponentProps<"input"> & { id: string; label: string; hint?: string }) {
  const hintId = `${id}-hint`;
  const failed = useContext(FieldErrorContext);
  const errorId = failed.fieldId === id ? failed.errorId : undefined;
  const describedBy = [hint && hintId, errorId].filter(Boolean).join(" ");
  return (
    <div className="structure-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        aria-invalid={errorId !== undefined || undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint && (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
