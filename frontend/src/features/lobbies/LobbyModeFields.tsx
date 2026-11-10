import type { Game, GameMode, GameRole } from "../../api";
import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { LobbyRoleFields } from "./LobbyRoleFields";

type FieldError = (name: string) => string | undefined;

/**
 * The mode and activity choices of the chosen game, and what limits the lobby: role slots with the
 * creator's seat, or max players. Nothing is offered for "Other" or a game without modes.
 */
export function LobbyModeFields({
  id,
  game,
  mode,
  roles,
  modeValue,
  onModeChange,
  errorFor,
}: {
  id: string;
  game?: Game;
  mode?: GameMode;
  /** The game roles of the chosen mode, or of the game; empty when max players limits the lobby. */
  roles: GameRole[];
  modeValue: string;
  onModeChange: (value: string) => void;
  errorFor: FieldError;
}) {
  const m = useMessages();
  const modes = game?.modes ?? [];
  const ownerKey = `${game?.id}:${mode?.id}`;
  return (
    <>
      {modes.length > 0 && (
        <LobbyField id={`${id}-mode`} label={m.lobbyModeLabel}>
          <select
            {...fieldProps(`${id}-mode`, false, errorFor("mode"))}
            name="mode"
            value={modeValue}
            onChange={(event) => onModeChange(event.target.value)}
          >
            <option value="">{m.lobbyModeNone}</option>
            {modes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </LobbyField>
      )}
      {mode && mode.activities.length > 0 && (
        <LobbyField id={`${id}-activity`} label={m.lobbyActivityLabel}>
          <select
            {...fieldProps(`${id}-activity`, false, errorFor("activity"))}
            key={mode.id}
            name="activity"
          >
            <option value="">{m.lobbyActivityNone}</option>
            {mode.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </LobbyField>
      )}
      {roles.length > 0 ? (
        <LobbyRoleFields
          key={ownerKey}
          id={id}
          roles={roles}
          slotsErrorId={errorFor("maxPlayers")}
          seatErrorId={errorFor("seat")}
        />
      ) : (
        <MaxPlayersField
          key={ownerKey}
          id={id}
          suggested={suggestedMax(game, mode)}
          hint={mode ? m.lobbyModeMaxPlayersHint : m.lobbyMaxPlayersHint}
          errorId={errorFor("maxPlayers")}
        />
      )}
    </>
  );
}

/** The mode's limit; the game's default only for a game without modes, since a game with modes does not use it. */
function suggestedMax(game?: Game, mode?: GameMode) {
  if (mode) return mode.maxPlayers;
  return game?.modes?.length ? null : game?.defaultMaxPlayers;
}

/** A suggestion only. The owner keys this field, so a new game or mode replaces what was typed. */
function MaxPlayersField({
  id,
  suggested,
  hint,
  errorId,
}: {
  id: string;
  suggested?: number | null;
  hint: string;
  errorId?: string;
}) {
  const m = useMessages();
  return (
    <LobbyField id={`${id}-max`} label={m.lobbyMaxPlayersLabel} hint={hint}>
      <input
        {...fieldProps(`${id}-max`, true, errorId)}
        name="maxPlayers"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={suggested ?? ""}
      />
    </LobbyField>
  );
}
