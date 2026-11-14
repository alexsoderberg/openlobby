import { useCallback, type ComponentProps } from "react";
import { useApi } from "../../api";
import { useLoad } from "../../hooks";
import { useMessages } from "../../i18n";
import { preselectedSeat } from "./lobbyRoles";
import { SeatForm } from "./SeatForm";

type Props = Omit<
  ComponentProps<typeof SeatForm>,
  "seat" | "preselected" | "hint"
> & { onUnauthenticated: () => void };

/**
 * The seat form for joining. It reads the caller's preferred game roles when it opens (one read per join) and
 * shows the form once the read has settled, with the seat of ADR 0022 point 7 preselected. A failed read
 * opens the form with nothing preselected and says so.
 */
export function JoinSeatForm({ onUnauthenticated, ...form }: Props) {
  const m = useMessages();
  const api = useApi();
  const load = useCallback(
    async () => (await api.getPreferredGameRoles()).gameRoleIds,
    [api],
  );
  const { state } = useLoad(load, onUnauthenticated);
  if (state.status === "loading")
    return <p role="status">{m.preferredGameRoles.loading}</p>;
  return (
    <SeatForm
      {...form}
      preselected={
        state.status === "loaded"
          ? preselectedSeat(form.roleSlots, state.value)
          : undefined
      }
      hint={state.status === "failed" ? m.lobbySeatNotPreselected : undefined}
    />
  );
}
