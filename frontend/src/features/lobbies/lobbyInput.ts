import {
  DEFAULT_MAX_PLAYERS_LIMIT,
  INVALID_CAPACITY,
  INVALID_GAME,
  isGameNameLength,
  parseMaxPlayers,
  trimLikeServer,
  type CreateLobbyInput,
} from "../../api";
import { LOBBY_SEAT_MISSING } from "./lobbyErrors";
import { lobbyTimesFrom } from "./lobbyTime";

/** The select value for the free-text choice. A game's value is its ID, which is a uuid and never this. */
export const OTHER_GAME = "other";

/** The seat value for flex. A game role's value is its ID, which is a uuid and never this. */
export const FLEX_SEAT = "flex";
/** The name of the seat radio buttons, in the create form and the join form. */
export const SEAT_FIELD = "seat";
const SLOT_PREFIX = "slot-";
/** The name of a role slot input: the prefix and the game role's ID. */
export const slotInputName = (gameRoleId: string) => SLOT_PREFIX + gameRoleId;

export type LobbyFields = {
  game: string;
  mode: string;
  activity: string;
  /** One entry per game role that the form shows; empty for a lobby without game roles. */
  slots: { gameRoleId: string; text: string }[];
  seat: string;
  customGameName: string;
  maxPlayers: string;
  date: string;
  start: string;
  end: string;
};

/** The part of the request that comes from the limit: max players, or the slots with the creator's seat. */
type CapacityPart = {
  ok: true;
  part: Pick<
    CreateLobbyInput,
    "maxPlayers" | "roleSlots" | "gameRoleId" | "flex"
  >;
};

type Failure = { ok: false; code: string };
export type LobbyInputResult = { ok: true; input: CreateLobbyInput } | Failure;

function gameOf(fields: LobbyFields) {
  if (fields.game === "") return undefined;
  if (fields.game !== OTHER_GAME) return { gameId: fields.game };
  const name = trimLikeServer(fields.customGameName);
  return isGameNameLength(name) ? { customGameName: name } : undefined;
}

/** A slot count: a whole number from 0 (the game role is left out) to the limit. */
export function parseSlot(text: string): number | undefined {
  const trimmed = trimLikeServer(text);
  const value = Number(trimmed);
  return /^\d+$/.test(trimmed) && value <= DEFAULT_MAX_PLAYERS_LIMIT
    ? value
    : undefined;
}

/** Slots and the creator's seat, or the max players of a lobby without game roles. */
function limitOf(fields: LobbyFields): CapacityPart | Failure {
  if (fields.slots.length === 0) {
    const maxPlayers = parseMaxPlayers(fields.maxPlayers);
    // A mode is never unlimited (ADR 0017 section 7), so an empty value is refused here.
    const unlimitedMode = maxPlayers === null && fields.mode !== "";
    return maxPlayers === undefined || unlimitedMode
      ? { ok: false, code: INVALID_CAPACITY }
      : { ok: true, part: { maxPlayers } };
  }
  const roleSlots = [];
  for (const { gameRoleId, text } of fields.slots) {
    const slots = parseSlot(text);
    if (slots === undefined) return { ok: false, code: INVALID_CAPACITY };
    roleSlots.push({ gameRoleId, slots });
  }
  if (fields.seat === "") return { ok: false, code: LOBBY_SEAT_MISSING };
  const seat =
    fields.seat === FLEX_SEAT ? { flex: true } : { gameRoleId: fields.seat };
  return { ok: true, part: { roleSlots, ...seat } };
}

/** Quick feedback only. The server applies the same rules and is the source of truth. */
export function parseLobbyInput(
  fields: LobbyFields,
  now: Date,
): LobbyInputResult {
  const game = gameOf(fields);
  if (!game) return { ok: false, code: INVALID_GAME };
  const limit = limitOf(fields);
  if (!limit.ok) return limit;
  const times = lobbyTimesFrom(fields.date, fields.start, fields.end, now);
  if (!times.ok) return times;
  const { startsAt, endsAt } = times;
  return {
    ok: true,
    input: {
      ...game,
      ...(fields.mode && { modeId: fields.mode }),
      ...(fields.activity && { activityId: fields.activity }),
      ...limit.part,
      startsAt,
      endsAt,
    },
  };
}

/** Reads the form's fields by name. */
export function readFields(form: HTMLFormElement): LobbyFields {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "");
  const slots = [...data.entries()]
    .filter(([name]) => name.startsWith(SLOT_PREFIX))
    .map(([name, value]) => ({
      gameRoleId: name.slice(SLOT_PREFIX.length),
      text: String(value),
    }));
  return {
    game: text("game"),
    mode: text("mode"),
    activity: text("activity"),
    slots,
    seat: text(SEAT_FIELD),
    customGameName: text("customGameName"),
    maxPlayers: text("maxPlayers"),
    date: text("date"),
    start: text("start"),
    end: text("end"),
  };
}
