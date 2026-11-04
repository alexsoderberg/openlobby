import { useMessages } from "../../i18n";
import type { DashboardLobby } from "./dashboardLobby";
import { LobbyEntry } from "./LobbyEntry";

/** Phones: the lobbies of the selected day. Announced politely when another day is picked. */
export function DayAgenda({ lobbies }: { lobbies: DashboardLobby[] }) {
  const m = useMessages();
  return (
    <div className="agenda" aria-live="polite">
      {lobbies.length === 0 ? (
        <p className="week-column__empty">{m.dashboard.nothingBooked}</p>
      ) : (
        <ul className="row-list" role="list">
          {lobbies.map((lobby) => (
            <LobbyEntry key={lobby.id} lobby={lobby} />
          ))}
        </ul>
      )}
    </div>
  );
}
