import {
  GAME_NAME_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  INVITE_MAX_USES_LIMIT,
  RESERVED_GAME_NAME,
  type ApiErrorCode,
} from "../../api";

export const en = {
  brandLead: "Open",
  brandAccent: "Lobby",
  logInWithDiscord: "Log in with Discord",
  logOut: "Log out",
  tryAgain: "Try again",
  cancel: "Cancel",
  backToStart: "Back to your groups",
  backToHome: "Back to the start page",

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

  landing: {
    topBarLogIn: "Log in",
    eyebrow: "Game nights, without the group chat chaos",
    // Two lines, each with its own reveal. Joined with a space they read as one headline.
    headlineLines: ["Game night,", "planned properly."],
    headlineHighlight: "planned",
    lead: "Create a group, invite your friends with a link, and keep the whole crew in one place.",
    howItWorks: "How it works",
    stepsHeading: "How it works",
    steps: [
      {
        title: "Gather your group",
        text: "Log in with Discord and create a group for your crew. You become its admin.",
      },
      {
        title: "Invite with a link",
        text: "Share a link with the friends you want. Each link expires on its own, and you can revoke it any time.",
      },
    ],
    previewHeading: "Inside the app, it feels the same.",
    footer: "made for game nights",
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

  inviteLoading: "Checking the invite link.",
  inviteIntro: "You have been invited to this group.",
  joinGroupSubmit: "Join group",
  joinGroupBusy: "Joining the group.",
  inviteAlreadyMember: "You are already a member of this group.",
  inviteInvalidHeading: "Invite link not valid",

  inviteLinksHeading: "Invite links",
  inviteLinksLoading: "Loading invite links.",
  inviteLinksEmpty:
    "There are no active invite links. Create one to invite someone.",
  inviteLinkCreatedBy: (name: string) => `Created by ${name}`,
  inviteLinkUnknownCreator: "Unknown member",
  inviteLinkUses: (used: number, max: number) => `${used}/${max}`,
  inviteLinkUsesWord: "uses",
  inviteLinkExpires: (time: string) => `Expires ${time}`,
  inviteLinkUrlLabel: "Invite link",
  inviteLinkCopy: "Copy link",
  inviteLinkCopied: "Link copied.",
  inviteLinkCopyFailed:
    "The link could not be copied. Select the link and copy it by hand.",
  inviteLinkRevoke: "Revoke link",
  inviteLinkRevokeConfirm:
    "Revoke this link? It stops working at once and cannot be restored.",
  inviteLinkRevokeSubmit: "Yes, revoke link",
  inviteLinkKeep: "Keep link",
  inviteLinkRevoked: "Link revoked. It no longer works.",
  inviteLinkCreated:
    "Invite link created. Copy it and send it to the people you want to invite.",
  inviteMaxUsesLabel: "Number of uses",
  inviteMaxUsesHint:
    "Each person who joins uses one. The link stops working when the uses run out or it expires.",
  createInviteLinkSubmit: "Create invite link",

  gameListLink: "Game list",
  gameListHeading: "Game list",
  gameListLoading: "Loading the game list.",
  gameListEmpty: "There are no games in the list yet. Add the first one below.",
  gameListDenied:
    "Only a system admin can change the game list. You do not have access to this page.",
  gameUnlimited: "No player limit",
  gameMaxPlayers: (max: number) => `Up to ${max} players`,
  gameNameLabel: "Game name",
  gameNameHint: `1 to ${GAME_NAME_MAX_LENGTH} characters. "${RESERVED_GAME_NAME}" is reserved.`,
  gameMaxPlayersLabel: "Default max players",
  gameMaxPlayersHint: "Leave empty for no limit.",
  gameAddHeading: "Add a game",
  gameAddSubmit: "Add game",
  gameEdit: "Change",
  gameEditSubmit: "Save changes",
  gameEditCancel: "Cancel",
  gameRemove: "Remove",
  gameNameInvalid: `The name must be 1 to ${GAME_NAME_MAX_LENGTH} characters, and "${RESERVED_GAME_NAME}" is reserved.`,
  gameRemoveHeading: (name: string) => `Remove ${name}?`,
  gameRemoveConfirm:
    "The game leaves the game list for everyone. Lobbies that already use it keep their game name and max players.",
  gameRemoveSubmit: "Yes, remove game",
  gameRemoveKeep: "Keep game",
  gameAdded: "Game added.",
  gameChanged: "Game changed.",
  gameRemoved: "Game removed.",

  lobbiesHeading: "Upcoming lobbies",
  lobbiesLoading: "Loading the lobbies.",
  lobbiesEmpty: "No lobbies have been created yet",
  lobbyViewLabel: "View",
  lobbyViewList: "List",
  lobbyViewCalendar: "Calendar",
  lobbyPlayers: (count: number, max: number | null) =>
    max === null ? `${count} players` : `${count}/${max} players`,
  lobbyCreatedBy: (name: string) => `Created by ${name}`,
  lobbyUnknownCreator: "Unknown member",
  lobbyEndsNextDay: "next day",
  calendarWeekHeading: (range: string) => `Week ${range}`,
  calendarNextWeek: "Next week",
  calendarNoLobbiesOnDay: "No lobbies",

  lobbyCreateHeading: "Create a lobby",
  gamesLoading: "Loading the games.",
  lobbyGameLabel: "Game",
  lobbyGameChoose: "Choose a game",
  lobbyGameOther: RESERVED_GAME_NAME,
  lobbyCustomGameLabel: "Name of the game",
  lobbyCustomGameHint: `1 to ${GAME_NAME_MAX_LENGTH} characters.`,
  lobbyMaxPlayersLabel: "Max players",
  lobbyMaxPlayersHint:
    "Filled in from the game. Change it, or leave it empty for no limit.",
  lobbyDateLabel: "Date",
  lobbyStartLabel: "Start time",
  lobbyEndLabel: "End time",
  lobbyEndHint:
    "Your local time. An end time before the start time means the next day.",
  lobbyCreateSubmit: "Create lobby",
  lobbyCreated: "Lobby created. You are the first player.",
  lobbyTimeMissing: "Enter a date, a start time and an end time.",

  lobbyBackToGroup: "Back to the group",
  lobbyLoading: "Loading the lobby.",
  lobbyPlayersHeading: "Players",
  lobbyNoPlayers: "Nobody has joined this lobby yet.",
  lobbyNotFoundHeading: "Lobby not found",
  lobbyNotFoundText: "This lobby does not exist, or it has already ended.",
  lobbyDelete: "Delete lobby",
  lobbyDeleteHeading: (game: string) => `Delete the ${game} lobby?`,
  lobbyDeleteConfirm: "The lobby disappears for everyone in the group.",
  lobbyDeleteSubmit: "Yes, delete lobby",
  lobbyDeleteKeep: "Keep lobby",

  shell: {
    mainNav: "Main",
    groupsNav: "Groups",
    home: "Home",
    groups: "Groups",
    you: "You",
    createGroupButton: "Create a group",
    openProfile: (name: string) => `${name}, your profile`,
  },

  profileHeading: "You",
  profileNameLabel: "Signed in as",

  dashboard: {
    heading: "Dashboard",
    loading: "Loading your dashboard.",
    groupStripLabel: "Your groups",
    noGroups: "You are not in a group yet",
    noGroupsHint:
      "Press + to create one, or open an invite link from a friend.",
    nextUpHeading: "Next up",
    thisWeekHeading: "This week",
    nothingBooked: "Nothing booked",
    running: "Running",
    ended: "Ended",
    dayPillsLabel: "Choose a day",
    dayHasLobbies: "has lobbies",
    today: "today",
    playersMeter: "Players",
    countdownDays: (days: number, hours: number) => `in ${days} d ${hours} h`,
    countdownHours: (hours: number, minutes: number) =>
      `in ${hours} h ${minutes} min`,
    countdownMinutes: (minutes: number) => `in ${minutes} min`,
    countdownSoon: "in under a minute",
  },

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
    invalid_max_uses: `The number of uses must be between 1 and ${INVITE_MAX_USES_LIMIT}.`,
    lobby_not_found: "This lobby does not exist anymore.",
    lobby_in_past: "The lobby must start in the future.",
    lobby_end_not_after_start: "The lobby must end after it starts.",
    lobby_too_long: "A lobby must be shorter than 24 hours.",
    lobby_has_ended: "This lobby has already ended.",
    lobby_full: "This lobby is full.",
    invalid_game:
      "Choose a game from the list, or enter a name of 1 to 50 characters.",
    invalid_capacity:
      "The number of players must be from 1 to 2147483647, or empty for no limit.",
    game_taken: "A game with this name already exists.",
    game_not_found: "This game does not exist anymore.",
  } satisfies Record<ApiErrorCode, string>,
};

export type Messages = typeof en;
