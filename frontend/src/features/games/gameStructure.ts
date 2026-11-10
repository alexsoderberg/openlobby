import {
  ACTIVITY_NAME_MAX_LENGTH,
  GAME_ROLE_NAME_MAX_LENGTH,
  INVALID_ACTIVITY,
  INVALID_CAPACITY,
  INVALID_GAME_ROLE,
  INVALID_GENRE,
  INVALID_MODE,
  MODE_NAME_MAX_LENGTH,
  isNameLength,
  parseMaxPlayers,
  trimLikeServer,
  type Game,
  type GameModeInput,
  type GameRoleInput,
} from "../../api";
import { ACTIVITY_TAKEN, GAME_ROLE_TAKEN, MODE_TAKEN } from "./gameErrors";

/** What the admin is typing: the entries of a game, with text for every number so a half-typed value is kept. */
export type RoleDraft = {
  key: string;
  id?: string;
  name: string;
  slots: string;
};
export type ActivityDraft = { key: string; id?: string; name: string };
export type ModeDraft = {
  key: string;
  id?: string;
  name: string;
  maxPlayers: string;
  gameRoles: RoleDraft[];
  activities: ActivityDraft[];
};
export type StructureDraft = { gameRoles: RoleDraft[]; modes: ModeDraft[] };

/** A parse failure names the field to focus: the part of its element ID after the form's ID. */
export type StructureFailure = { ok: false; code: string; field: string };
type Parsed<T> = { ok: true; value: T } | StructureFailure;

// Module-level so that a key is never reused, also across forms: the keys become element IDs.
let lastNewKey = 0;
const newKey = () => `new-${++lastNewKey}`;

export const emptyRole = (): RoleDraft => ({
  key: newKey(),
  name: "",
  slots: "1",
});
export const emptyActivity = (): ActivityDraft => ({ key: newKey(), name: "" });
export const emptyMode = (): ModeDraft => ({
  key: newKey(),
  name: "",
  maxPlayers: "",
  gameRoles: [],
  activities: [],
});

export function draftFromGame(game?: Game): StructureDraft {
  const roles = (list: Game["gameRoles"]): RoleDraft[] =>
    (list ?? []).map((role) => ({
      key: role.id,
      id: role.id,
      name: role.name,
      slots: String(role.slots),
    }));
  return {
    gameRoles: roles(game?.gameRoles),
    modes: (game?.modes ?? []).map((mode) => ({
      key: mode.id,
      id: mode.id,
      name: mode.name,
      // The stored max of a mode with game roles is their sum, which the form shows as a total.
      maxPlayers: mode.gameRoles.length > 0 ? "" : String(mode.maxPlayers),
      gameRoles: roles(mode.gameRoles),
      activities: mode.activities.map(({ id, name }) => ({
        key: id,
        id,
        name,
      })),
    })),
  };
}

export function patchItem<T extends { key: string }>(
  list: T[],
  key: string,
  patch: Partial<T>,
): T[] {
  return list.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

export const removeItem = <T extends { key: string }>(list: T[], key: string) =>
  list.filter((item) => item.key !== key);

/** A whole number in the max players range. Empty is not a number here: slots and a mode's max are required. */
function parseWhole(text: string): number | undefined {
  return parseMaxPlayers(text) ?? undefined;
}

/** The slots that are valid so far; the total shown next to the roles. */
export const sumSlots = (roles: RoleDraft[]) =>
  roles.reduce((sum, role) => sum + (parseWhole(role.slots) ?? 0), 0);

const fail = (code: string, field: string): StructureFailure => ({
  ok: false,
  code,
  field,
});

/**
 * Quick feedback only; the server applies the same rules and is the source of truth. The sum of the slots
 * is left to the server.
 */
function parseRoles(roles: RoleDraft[]): Parsed<GameRoleInput[]> {
  const value: GameRoleInput[] = [];
  for (const role of roles) {
    const name = trimLikeServer(role.name);
    if (!isNameLength(name, GAME_ROLE_NAME_MAX_LENGTH))
      return fail(INVALID_GAME_ROLE, `${role.key}-name`);
    const slots = parseWhole(role.slots);
    if (slots === undefined) return fail(INVALID_CAPACITY, `${role.key}-slots`);
    value.push({ id: role.id, name, slots });
  }
  return { ok: true, value };
}

function parseActivities(
  activities: ActivityDraft[],
): Parsed<{ id?: string; name: string }[]> {
  const value = [];
  for (const activity of activities) {
    const name = trimLikeServer(activity.name);
    if (!isNameLength(name, ACTIVITY_NAME_MAX_LENGTH))
      return fail(INVALID_ACTIVITY, `${activity.key}-name`);
    value.push({ id: activity.id, name });
  }
  return { ok: true, value };
}

/** A mode has game roles (its max is their sum) or a max players value, never both. */
function parseModes(modes: ModeDraft[]): Parsed<GameModeInput[]> {
  const value: GameModeInput[] = [];
  for (const mode of modes) {
    const name = trimLikeServer(mode.name);
    if (!isNameLength(name, MODE_NAME_MAX_LENGTH))
      return fail(INVALID_MODE, `${mode.key}-name`);
    const roles = parseRoles(mode.gameRoles);
    if (!roles.ok) return roles;
    const maxPlayers =
      roles.value.length > 0 ? null : parseWhole(mode.maxPlayers);
    if (maxPlayers === undefined)
      return fail(INVALID_CAPACITY, `${mode.key}-max`);
    const activities = parseActivities(mode.activities);
    if (!activities.ok) return activities;
    value.push({
      id: mode.id,
      name,
      maxPlayers,
      gameRoles: roles.value,
      activities: activities.value,
    });
  }
  return { ok: true, value };
}

/** The one place for the rule: the game's own default max and game roles apply only while the game has no modes (ADR 0017 section 2). */
export const usesOwnLimit = (draft: StructureDraft) => draft.modes.length === 0;

/** The default max field is hidden when the own limit is unused, or when the game's roles give the max. */
export const hidesDefaultMax = (draft: StructureDraft) =>
  !usesOwnLimit(draft) || draft.gameRoles.length > 0;

export function removeActivity(
  draft: StructureDraft,
  modeKey: string,
  activityKey: string,
): StructureDraft {
  return {
    ...draft,
    modes: draft.modes.map((mode) =>
      mode.key === modeKey
        ? { ...mode, activities: removeItem(mode.activities, activityKey) }
        : mode,
    ),
  };
}

/** The roles and modes as the request carries them. A game with modes sends no game roles, so the server keeps the stored ones. */
export function parseStructure(
  draft: StructureDraft,
): Parsed<{ gameRoles?: GameRoleInput[]; modes: GameModeInput[] }> {
  const gameRoles = usesOwnLimit(draft)
    ? parseRoles(draft.gameRoles)
    : undefined;
  if (gameRoles && !gameRoles.ok) return gameRoles;
  const modes = parseModes(draft.modes);
  if (!modes.ok) return modes;
  return {
    ok: true,
    value: { gameRoles: gameRoles?.value, modes: modes.value },
  };
}

export type ErrorSection = "name" | "max" | "genre" | "roles" | "modes";

export const isStructureSection = (
  section?: ErrorSection,
): section is "roles" | "modes" => section === "roles" || section === "modes";

const MODE_CODES: readonly string[] = [
  INVALID_MODE,
  MODE_TAKEN,
  INVALID_ACTIVITY,
  ACTIVITY_TAKEN,
];
const ROLE_CODES: readonly string[] = [INVALID_GAME_ROLE, GAME_ROLE_TAKEN];

/** Which part of the form an error code is about. Roles are on the modes while the game has modes. */
export function errorSection(
  code: string,
  draft: StructureDraft,
): ErrorSection {
  const owner = usesOwnLimit(draft) ? "roles" : "modes";
  if (code === INVALID_GENRE) return "genre";
  if (MODE_CODES.includes(code)) return "modes";
  if (ROLE_CODES.includes(code)) return owner;
  if (code !== INVALID_CAPACITY) return "name";
  return hidesDefaultMax(draft) ? owner : "max";
}
