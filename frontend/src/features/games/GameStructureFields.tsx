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
import { ConfirmDialog } from "../../ui";
import {
  emptyActivity,
  emptyMode,
  emptyRole,
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
 * The modes, game roles and activities of a game. Game roles on the game itself are offered only while the game
 * has no modes (ADR 0017 section 2). Removing a mode or an activity asks first; removing a game role does not,
 * because nothing is lost until the game is saved. `errorId` describes the part named by `errorSection`.
 */
export function GameStructureFields({
  id,
  draft,
  setDraft,
  requestFocus,
  errorId,
  errorSection,
  errorField,
}: {
  id: string;
  draft: StructureDraft;
  setDraft: SetDraft;
  requestFocus: RequestFocus;
  errorId: string;
  errorSection?: "roles" | "modes";
  errorField?: string;
}) {
  const m = useMessages();
  const [removal, setRemoval] = useState<Removal>();
  // A section is described only when the entry is unknown (a server failure); a known entry carries the error itself.
  const describedBy = (section: "roles" | "modes") =>
    errorSection === section && errorField === undefined ? errorId : undefined;

  return (
    <FieldErrorContext
      value={{
        fieldId: errorField && `${id}-${errorField}`,
        errorId: errorField && errorId,
      }}
    >
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
                <ModeItem
                  id={id}
                  mode={mode}
                  position={index + 1}
                  setDraft={setDraft}
                  requestFocus={requestFocus}
                  askRemoval={setRemoval}
                />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          id={`${id}-add-mode`}
          className="button button--secondary"
          onClick={() => {
            const mode = emptyMode();
            setDraft((d) => ({ ...d, modes: [...d.modes, mode] }));
            requestFocus(`${id}-${mode.key}-name`);
          }}
        >
          {m.gameModeAdd}
        </button>
      </fieldset>
      {removal && (
        <ConfirmDialog
          heading={removal.heading}
          body={removal.body}
          submitLabel={removal.submitLabel}
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
    </FieldErrorContext>
  );
}

function ModeItem({
  id,
  mode,
  position,
  setDraft,
  requestFocus,
  askRemoval,
}: {
  id: string;
  mode: ModeDraft;
  position: number;
  setDraft: SetDraft;
  requestFocus: RequestFocus;
  askRemoval: (removal: Removal) => void;
}) {
  const m = useMessages();
  const patch = (change: Partial<ModeDraft>) =>
    setDraft((d) => ({ ...d, modes: patchItem(d.modes, mode.key, change) }));
  const label = mode.name.trim() || m.gameModeLegend(position);

  return (
    <fieldset className="structure structure--mode">
      <legend>{m.gameModeLegend(position)}</legend>
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
                        focusId: `${id}-${mode.key}-add-activity`,
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
          id={`${id}-${mode.key}-add-activity`}
          className="button button--secondary"
          onClick={() => {
            const activity = emptyActivity();
            patch({ activities: [...mode.activities, activity] });
            requestFocus(`${id}-${activity.key}-name`);
          }}
        >
          {m.gameActivityAdd}
        </button>
      </fieldset>
      <button
        type="button"
        className="button button--secondary"
        aria-label={`${m.gameModeRemove}, ${label}`}
        onClick={() =>
          askRemoval({
            heading: m.gameModeRemoveHeading(label),
            body: m.gameModeRemoveConfirm,
            submitLabel: m.gameModeRemoveSubmit,
            keepLabel: m.gameModeRemoveKeep,
            focusId: `${id}-add-mode`,
            apply: (d) => ({ ...d, modes: removeItem(d.modes, mode.key) }),
          })
        }
      >
        {m.gameModeRemove}
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
        className="button button--secondary"
        aria-label={removeLabel}
        onClick={onRemove}
      >
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
