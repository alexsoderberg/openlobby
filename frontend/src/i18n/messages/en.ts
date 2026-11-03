import { GROUP_NAME_MAX_LENGTH, type ApiErrorCode } from "../../api";

export const en = {
  appName: "OpenLobby",
  logInWithDiscord: "Log in with Discord",
  logOut: "Log out",
  tryAgain: "Try again",
  backToStart: "Back to your groups",

  loginHeading: "Log in to OpenLobby",
  loginIntro: "Use your Discord account. You do not need a new account.",
  sessionLoading: "Checking your login.",
  sessionExpired: "Your session has ended. Log in again to continue.",

  loginErrors: {
    login_denied:
      "You did not approve the login in Discord, so you are still logged out. Log in again and approve it to continue.",
    login_failed:
      "The login did not work, so you are still logged out. Try again.",
  },

  groupsHeading: "Your groups",
  groupsLoading: "Loading your groups.",
  groupsEmpty:
    "You are not in any group yet. Ask a member for an invite link to join one.",
  createGroupHeading: "Create a group",
  groupNameLabel: "Group name",
  groupNameHint: `1 to ${GROUP_NAME_MAX_LENGTH} characters.`,
  createGroupSubmit: "Create group",
  groupCreated: "Group created. It is now in your groups.",

  groupLoading: "Loading the group.",
  membersHeading: "Members",
  groupAdminMarker: "Group admin",

  inviteHeading: "Invite",
  invitePlaceholder: "Joining with an invite link is not available yet.",

  notFoundHeading: "Page not found",
  notFoundText: "The address does not point to a page in OpenLobby.",

  genericError: "Something went wrong. Try again in a moment.",

  errors: {
    unauthenticated: "You are not logged in. Log in again to continue.",
    service_unavailable:
      "The service is not responding right now. Try again in a moment.",
    internal_error: "Something went wrong. Try again in a moment.",
    not_found: "The page or item was not found.",
    method_not_allowed: "This action is not allowed here.",
    invalid_request:
      "The request could not be read. Check what you entered and try again.",
    not_allowed: "You do not have permission to do this.",
    group_not_found:
      "This group does not exist, or you are not a member of it.",
    member_not_found: "This person is not a member of the group.",
    own_upcoming_lobbies_exist:
      "You have upcoming lobbies that you created. Delete them before you leave the group.",
    invalid_group_name: `The group name must be between 1 and ${GROUP_NAME_MAX_LENGTH} characters.`,
    invite_invalid: "This invite link is no longer valid. Ask for a new one.",
    invalid_max_uses: "The number of uses must be between 1 and 10.",
    lobby_not_found: "This lobby does not exist anymore.",
    lobby_in_past: "The lobby must start in the future.",
    lobby_end_not_after_start: "The lobby must end after it starts.",
    lobby_too_long: "A lobby must be shorter than 24 hours.",
    lobby_has_ended: "This lobby has already ended.",
    lobby_full: "This lobby is full.",
    invalid_game:
      "Choose a game from the list, or enter a name of 1 to 50 characters.",
    invalid_capacity:
      "The number of players must be at least 1, or empty for no limit.",
    game_taken: "A game with this name already exists.",
    game_not_found: "This game does not exist anymore.",
  } satisfies Record<ApiErrorCode, string>,
};

export type Messages = typeof en;
