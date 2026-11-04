import { useMessages } from "../../i18n";

export type LobbyView = "list" | "calendar";

/** Two buttons in a group. Native buttons are reached with Tab and pressed with Enter or Space. */
export function LobbyViewSwitch({
  view,
  onChange,
}: {
  view: LobbyView;
  onChange: (view: LobbyView) => void;
}) {
  const m = useMessages();
  const choices: [LobbyView, string][] = [
    ["list", m.lobbyViewList],
    ["calendar", m.lobbyViewCalendar],
  ];
  return (
    <div className="view-switch" role="group" aria-label={m.lobbyViewLabel}>
      {choices.map(([choice, label]) => (
        <button
          key={choice}
          type="button"
          className="button button--secondary"
          aria-pressed={view === choice}
          onClick={() => onChange(choice)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
