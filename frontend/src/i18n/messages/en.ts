import {
  DEFAULT_MAX_PLAYERS_LIMIT,
  GAME_NAME_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  INVITE_MAX_USES_LIMIT,
  RESERVED_GAME_NAME,
  type ApiErrorCode,
  type GameImageKind,
  type Genre,
  type RoleIcon,
} from "../../api";

export const en = {
  brandLead: "Open",
  brandAccent: "Lobby",
  logInWithDiscord: "Log in with Discord",
  logOut: "Log out",
  tryAgain: "Try again",
  cancel: "Cancel",
  backToGroups: "Back to your groups",
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
    headline: "Plan when your group plays",
    lead: "Games are scheduled as lobbies. Members of a group see the lobbies and join the ones they want.",
    stepsHeading: "How it works",
    steps: [
      { title: "Log in", text: "Log in with Discord." },
      {
        title: "Join or create a group",
        text: "Create a group, or open an invite link from a group member to join one.",
      },
      {
        title: "Create a lobby",
        text: "Choose a game, a start and end time and the max number of players.",
      },
      {
        title: "Join a lobby",
        text: "Group members join a lobby to take a spot, and can leave it again.",
      },
    ],
  },

  groupsHeading: "Your groups",
  groupsLoading: "Loading your groups.",
  groupsEmpty:
    "You are not in any group yet. Ask a member for an invite link to join one.",
  // The Group card (REQ-0024). The member count is the only text read for the members; "+N" is decoration.
  groupMemberCount: (count: number) =>
    count === 1 ? "1 member" : `${count} members`,
  groupMoreMembers: (count: number) => `+${count}`,
  groupNoUpcomingLobbies: "No upcoming lobbies",
  // The line under the Group view's name: "6 members, 4 upcoming lobbies" (REQ-0029 item 5).
  groupUpcomingLobbyCount: (count: number) =>
    count === 1 ? "1 upcoming lobby" : `${count} upcoming lobbies`,
  groupSummary: (members: string, lobbies: string) => `${members}, ${lobbies}`,
  createGroupHeading: "Create a group",
  groupNameLabel: "Group name",
  groupNameHint: `1 to ${GROUP_NAME_MAX_LENGTH} characters.`,
  createGroupSubmit: "Create group",
  groupCreated: "Group created. It is now in your groups.",

  groupLoading: "Loading the group.",
  membersHeading: "Members",
  // A neutral label in a member's row of the Member list (REQ-0029 item 5).
  groupAdminMarker: "Admin",
  makeAdmin: "Make group admin",
  makeAdminHeading: (member: string) => `Make ${member} a group admin?`,
  makeAdminConfirm:
    "A group admin can revoke the group's invite links and make members group admins. This cannot be undone.",
  makeAdminSubmit: "Yes, make group admin",
  makeAdminKeep: "Cancel",

  inviteLoading: "Checking the invite link.",
  inviteIntro: "You have been invited to this group.",
  joinGroupSubmit: "Join group",
  joinGroupBusy: "Joining the group.",
  inviteAlreadyMember: "You are already a member of this group.",
  inviteInvalidHeading: "Invite link not valid",

  inviteLinksHeading: "Invite links",
  inviteButton: "Invite",
  groupLeave: "Leave group",
  groupLeaveHeading: (group: string) => `Leave ${group}?`,
  groupLeaveConfirm:
    "Your player status on upcoming lobbies is removed and your invite links stop working.",
  groupLeaveSubmit: "Yes, leave group",
  groupLeaveKeep: "Stay in group",
  groupLeft: (group: string) => `You have left ${group}`,
  inviteHeading: (group: string) => `Invite people to ${group}`,
  inviteClose: "Close",
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
  gameGenreLabel: "Genre",
  genre: {
    none: "No genre",
    shooter: "Shooter",
    moba: "MOBA",
    racing: "Racing",
    strategy: "Strategy",
    survival: "Survival",
    party: "Party",
    rpg: "RPG",
    sports: "Sports",
  } satisfies Record<Genre | "none", string>,
  gameModeCount: (count: number) => (count === 1 ? "1 mode" : `${count} modes`),
  gameRolesLegend: "Game roles",
  gameRolesHint:
    "Each game role has a number of slots. Max players is the total of the slots.",
  gameRolesTotal: (total: number) => `Max players: ${total}`,
  gameRoleLegend: (position: number) => `Game role ${position}`,
  gameRoleNameLabel: "Game role name",
  gameRoleSlotsLabel: "Slots",
  gameRoleIconLabel: "Icon",
  roleIcon: {
    none: "No icon",
    shield: "Shield",
    "medical-cross": "Medical cross",
    dagger: "Dagger",
    crosshair: "Crosshair",
    wrench: "Wrench",
    star: "Star",
  } satisfies Record<RoleIcon, string>,
  gameRoleAdd: "Add game role",
  gameRoleRemove: "Remove game role",
  gameModesLegend: "Modes",
  gameModesHint:
    "A mode is a kind of play with its own limit: game roles, or a max players value. While the game has modes, its own default max players and game roles are not used.",
  gameModeLegend: (position: number) => `Mode ${position}`,
  gameModeNameLabel: "Mode name",
  gameModeMaxLabel: "Max players",
  gameModeMaxHint: "Used when the mode has no game roles.",
  gameModeSummary: (players: number | undefined, activities: number) =>
    [
      players === undefined
        ? "Max players not set"
        : players === 1
          ? "1 player"
          : `${players} players`,
      activities === 0
        ? ""
        : activities === 1
          ? "1 activity"
          : `${activities} activities`,
    ]
      .filter(Boolean)
      .join(" · "),
  gameModeHasError: "This mode has an error. Open it to fix it.",
  gameModeBack: "Back",
  gameModeAdd: "Add mode",
  gameModeRemove: "Remove mode",
  gameModeRemoveHeading: (name: string) => `Remove mode ${name}?`,
  gameModeRemoveConfirm:
    "The mode leaves the game, with its game roles and activities. Lobbies that already use it keep its name and max players.",
  gameModeRemoveSubmit: "Yes, remove mode",
  gameModeRemoveKeep: "Keep mode",
  gameActivitiesLegend: "Activities",
  gameActivitiesHint:
    "Specific things played in this mode, such as a dungeon. Optional.",
  gameActivityLegend: (position: number) => `Activity ${position}`,
  gameActivityNameLabel: "Activity name",
  gameActivityAdd: "Add activity",
  gameActivityRemove: "Remove activity",
  gameActivityRemoveHeading: (name: string) => `Remove activity ${name}?`,
  gameActivityRemoveConfirm:
    "The activity leaves the mode. Lobbies that already use it keep its name.",
  gameActivityRemoveSubmit: "Yes, remove activity",
  gameActivityRemoveKeep: "Keep activity",
  gameStructureCapacityInvalid: `Slots and max players must be whole numbers from 1 to ${DEFAULT_MAX_PLAYERS_LIMIT}, and the slots of one game or mode must add up to no more than ${DEFAULT_MAX_PLAYERS_LIMIT}.`,
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
  gameAdded:
    "Game added. Its form is open in the list, where you can add a logo and a cover.",
  gameImage: { logo: "Logo", cover: "Cover" } satisfies Record<
    GameImageKind,
    string
  >,
  gameImageHint: {
    logo: "PNG, JPEG or WebP. The image is saved as soon as you choose it.",
    cover:
      "PNG, JPEG or WebP. The image is saved as soon as you choose it. The app does not show covers at the moment.",
  } satisfies Record<GameImageKind, string>,
  gameImageChoose: "Choose image",
  gameImageRemove: "Remove image",
  gameImageSaving: "Saving the image.",
  gameImageSaved: "Image saved.",
  gameImageRemoved: "Image removed.",
  gameImageRemoveHeading: {
    logo: (game: string) => `Remove the logo of ${game}?`,
    cover: (game: string) => `Remove the cover of ${game}?`,
  } satisfies Record<GameImageKind, (game: string) => string>,
  gameImageRemoveConfirm: {
    logo: "Its lobbies show the game's initials instead. You can choose a new image at any time.",
    cover:
      "The app does not show covers at the moment. You can choose a new image at any time.",
  } satisfies Record<GameImageKind, string>,
  gameImageRemoveSubmit: "Yes, remove image",
  gameImageRemoveKeep: "Keep image",
  gameChanged: "Game changed.",
  gameRemoved: "Game removed.",

  lobbiesHeading: "Upcoming lobbies",
  lobbiesLoading: "Loading the lobbies.",
  lobbyViewLabel: "View",
  lobbyViewList: "List",
  lobbyViewCalendar: "Calendar",
  // "1/5 players" counts against the spots, so only a bare count of one is singular.
  lobbyPlayers: (count: number, max: number | null) =>
    max !== null
      ? `${count}/${max} players`
      : count === 1
        ? "1 player"
        : `${count} players`,
  lobbyLabelSeparator: " › ",
  // Between a lobby's start and its player count. Decorative: the line hides it where the count wraps.
  lobbyMetaSeparator: "·",
  // The label of a lobby with no game (ADR 0017 section 4).
  lobbyOpen: "Open",
  lobbyRoleSlotsLabel: "Game roles",
  lobbyRoleSlot: (name: string, count: number, slots: number) =>
    `${name} ${count}/${slots}`,
  // Read after "Tank 1/1" by screen readers only; the screen shows full by style (a filled badge, or a disabled seat).
  lobbyRoleSlotFullSuffix: ", full",
  // The group heading is the bare word; the list shows "Flex N".
  lobbyFlex: (count?: number) =>
    count === undefined ? "Flex" : `Flex ${count}`,
  lobbyCreatedBy: (name: string) => `Created by ${name}`,
  // The Line-up (REQ-0029 item 5): "to 14:35" under the large start time.
  lineUpEnds: (time: string) => `to ${time}`,
  // The spots at the right of a Line-up row, as a large figure and a word: "3/5 players", "3/3 Full", "1 player".
  lineUpSpotsFigure: (count: number, max: number | null) =>
    max === null ? `${count}` : `${count}/${max}`,
  lineUpSpotsWord: (count: number, max: number | null) => {
    if (max !== null && count >= max) return "Full";
    if (max === null && count === 1) return "player";
    return "players";
  },
  lobbyUnknownCreator: "Unknown member",
  calendarWeekHeading: (range: string) => `Week ${range}`,
  calendarNextWeek: "Next week",

  runningOrder: {
    scrollLabel: "Running order, scrolls sideways",
    nothingBooked: "Nothing booked",
    today: (date: string) => `${date}, today`,
    you: "you",
    // The name of a day's Create lobby button: its visible text first (WCAG 2.5.3), then the day.
    createOn: (day: string) => `Create lobby on ${day}`,
    // The short spots on a block, "4/5"; its name says "4/5 players". A lobby without a max shows lobbyPlayers.
    spots: (count: number, max: number) => `${count}/${max}`,
    // A block's start and end clock times, "22:00–02:00".
    times: (start: string, end: string) => `${start}–${end}`,
    // The name a screen reader reads for a block: the same facts as its visible text, with the midnight markers.
    blockName: (parts: {
      label: string;
      time: string;
      players: string;
      group: string;
      continuesBefore: boolean;
      continuesAfter: boolean;
      you: boolean;
    }) =>
      [
        parts.label,
        parts.time,
        parts.continuesBefore && "started the day before",
        parts.continuesAfter && "ends next day",
        parts.players,
        parts.group,
        parts.you && "you",
      ]
        .filter(Boolean)
        .join(", "),
  },

  lobbyCreateHeading: "Create a lobby",
  lobbyCreateButton: "Create lobby",
  gamesLoading: "Loading the games.",
  lobbyGameLabel: "Game",
  lobbyGameNone: "No game yet",
  lobbyGameHint:
    "With no game, the lobby is shown as Open. A player can set the game later.",
  lobbyGameOther: RESERVED_GAME_NAME,
  lobbyCustomGameLabel: "Name of the game",
  lobbyCustomGameHint: `1 to ${GAME_NAME_MAX_LENGTH} characters.`,
  lobbyModeLabel: "Game mode",
  lobbyModeNone: "No mode",
  lobbyActivityLabel: "Activity",
  lobbyActivityNone: "No activity",
  lobbyModeMaxPlayersHint:
    "Filled in from the mode. Change it if the group plays with another number.",
  lobbyRolesLegend: "Game roles",
  lobbyRolesHint:
    "Slots per game role. Enter 0 to leave a game role out of this lobby.",
  lobbySlotsLabel: (name: string) => `${name}, slots`,
  lobbyRolesTotal: (total: number) => `Max players: ${total}`,
  lobbySeatLegend: "Your seat",
  lobbySeatCreateHint: "You are the first player and take this seat.",
  lobbySeatFlex: "Flex (any game role)",
  lobbySeatMissing: "Choose a game role or flex.",
  lobbySeatJoin: "Join with this seat",
  lobbySeatChange: "Change seat",
  lobbySeatSave: "Save seat",
  lobbySeatNotPreselected:
    "Your game roles could not be loaded, so no seat is chosen for you.",
  lobbyModeMaxPlayersInvalid: `A mode needs a number of players from 1 to ${DEFAULT_MAX_PLAYERS_LIMIT}.`,
  lobbySlotsInvalid:
    "Each slot must be a whole number, 0 or more, and the slots must add up to at least 1.",
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
  // The viewer's own row in the player list.
  lobbyPlayerYou: "You",
  // The day line of a lobby that ends on another day than it starts.
  lobbyDays: (start: string, end: string) => `${start} to ${end}`,
  lobbyFactsHeading: "Lobby",
  lobbyCreatorLabel: "Created by",
  lobbyNoPlayers: "Nobody has joined this lobby yet.",
  lobbyNotFoundHeading: "Lobby not found",
  lobbyNotFoundText: "This lobby does not exist, or it has already ended.",
  lobbyJoin: "Join lobby",
  lobbyLeave: "Leave lobby",
  lobbyEnded: "Ended",
  lobbyGone: "The lobby no longer exists",
  lobbyDelete: "Delete lobby",
  lobbyDeleteHeading: (label: string) => `Delete the ${label} lobby?`,
  lobbyDeleteConfirm: "The lobby disappears for everyone in the group.",
  lobbyDeleteSubmit: "Yes, delete lobby",
  lobbyDeleteKeep: "Keep lobby",

  lobbySettingsHeading: "Mode and activity",
  lobbyModeChoose: "Choose a mode",
  lobbyModeChangeHint:
    "Changing the mode makes every player flex and replaces the role slots.",
  lobbyModeChangeHeading: (mode: string) => `Change the mode to ${mode}?`,
  lobbyModeChangeConfirm:
    "Every player becomes flex, and the role slots and max players change to those of the new mode. The activity is cleared.",
  lobbyModeChangeSubmit: "Yes, change mode",
  lobbyModeChangeKeep: "Keep mode",
  lobbySettingsSaved: "Saved.",
  lobbySettingsNotPlayer:
    "Only players of this lobby can change its game, mode or activity. Join the lobby first.",
  lobbyGameSetHeading: "Game",
  lobbyGameSetHint:
    "This lobby is Open. Choose its game. The game cannot be changed afterwards.",
  lobbyGameSetChoose: "Choose a game",
  lobbyGameSetSubmit: "Set game",
  lobbyGameSaved: "Game set.",
  lobbyGameSetInvalid:
    "This game is no longer in the game list. Choose another game.",

  shell: {
    mainNav: "Main",
    home: "Home",
    groups: "Groups",
    you: "You",
    createGroupButton: "Create a group",
    openProfile: (name: string) => `${name}, your profile`,
  },

  profileHeading: "You",
  profileNameLabel: "Signed in as",
  profileAccountHeading: "Account",
  profileSystemAdminHeading: "System admin",
  preferredGameRoles: {
    heading: "Game roles",
    hint: "Choose the game roles you play in each game. Your choice applies to all your groups.",
    loading: "Loading game roles.",
    empty: "No game has game roles yet.",
    roleWithMode: (role: string, mode: string) => `${role} (${mode})`,
    /** Next to a person's name. Without `game` the list is for the lobby's game. */
    plays: (games: { roles: string[]; game?: string }[]) =>
      `Plays ${games
        .map(({ roles, game }) =>
          game ? `${roles.join(", ")} in ${game}` : roles.join(", "),
        )
        .join("; ")}`,
    save: "Save game roles",
    saved: "Game roles saved.",
    removedRole:
      "A game role you chose has been removed. The list now shows the current game roles. Check your choice and save again.",
  },

  dashboard: {
    loading: "Loading your lobbies.",
    noGroups: "You are not in a group yet",
    noGroupsHint:
      "Create one on the Group list, or open an invite link from a friend.",
    noGroupsLink: "Go to Groups",
    nextUpHeading: "Next up",
    // The band's eyebrow: one phrase with the countdown, "Running" or "Ended".
    nextUpEyebrow: (timing: string) => `Next up, ${timing}`,
    thisWeekHeading: "This week",
    legendLabel: "Groups this week",
    legendYou: "You are in",
    nothingBooked: "Nothing booked",
    running: "Running",
    ended: "Ended",
    countdownDays: (days: number, hours: number) => `in ${days} d ${hours} h`,
    countdownHours: (hours: number, minutes: number) =>
      `in ${hours} h ${minutes} min`,
    countdownMinutes: (minutes: number) => `in ${minutes} min`,
    countdownSoon: "in under a minute",
  },

  notFoundHeading: "Page not found",
  notFoundText: "The address does not point to a page in OpenLobby.",

  // Lobby forms phrase these for people who create and join lobbies. The admin form uses `errors`.
  lobbyErrors: {
    invalid_mode: "Choose a mode of this game, or no mode.",
    invalid_activity: "Choose an activity of this mode, or no activity.",
    invalid_game_role:
      "This seat is not available in this lobby. Choose one of its game roles, or flex.",
    lobby_changed:
      "Someone changed this lobby while you were looking at it. It now shows the current mode. Try again if you still want the change.",
    lobby_has_more_players:
      "The lobby has more players than this mode allows. Choose another mode, or wait until someone leaves.",
    lobby_game_set:
      "Someone else set the game of this lobby first. It now shows that game.",
  },

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
    own_upcoming_lobbies_exist: "Delete your upcoming lobbies first.",
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
    invalid_capacity: `Max players must be a whole number from 1 to ${DEFAULT_MAX_PLAYERS_LIMIT}. Leave it empty for no limit.`,
    invalid_genre: "Choose a genre from the list, or no genre.",
    invalid_mode: "A mode name must be 1 to 50 characters.",
    invalid_activity: "An activity name must be 1 to 50 characters.",
    invalid_game_role: "A game role name must be 1 to 30 characters.",
    invalid_role_icon: "Choose an icon from the list, or No icon.",
    game_role_full:
      "This game role has no free slot. Choose another game role or flex.",
    lobby_game_set: "This lobby already has a game. Reload it to see it.",
    lobby_changed:
      "The lobby was changed by someone else. Reload it and try again.",
    lobby_has_more_players:
      "This mode allows fewer players than are in the lobby.",
    game_taken: "A game with this name already exists.",
    mode_taken: "This game already has a mode with this name.",
    activity_taken: "This mode already has an activity with this name.",
    game_role_taken:
      "A game role with this name already exists for this game or mode.",
    game_not_found: "This game does not exist anymore.",
    invalid_image_type:
      "This file is not a PNG, JPEG or WebP image. Choose a file of one of those types.",
    image_too_large:
      "This image is larger than 512 KiB. Choose a smaller file.",
    game_image_not_found: "This image does not exist anymore.",
  } satisfies Record<ApiErrorCode, string>,
};

export type Messages = typeof en;
