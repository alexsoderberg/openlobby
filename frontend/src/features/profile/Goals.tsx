import { useEffect, useId, useRef, useState } from "react";
import {
  ITEM_SEARCH_MAX_LENGTH,
  type GameGoals,
  type GameItem,
} from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import {
  Alert,
  Attribution,
  Button,
  ErrorAlert,
  GameLogo,
  Icon,
  IconButton,
  ItemLabel,
  itemText,
  Select,
  showToast,
} from "../../ui";
import { useGameItemSearch } from "./useGameItemSearch";
import { useGoals } from "./useGoals";

type Goals = ReturnType<typeof useGoals>;

/**
 * The You page section of the items a member wants, one block per game with a drop list (REQ-0030). One add panel
 * is open at a time. The attribution shows while an item is on screen: a goal, or the open panel's results.
 */
export function GoalsSection({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}) {
  const m = useMessages().goals;
  const goals = useGoals(onUnauthenticated);
  const [openGameId, setOpenGameId] = useState<string>();
  const { view, games } = goals;
  const showsItems =
    openGameId !== undefined || games.some((game) => game.goals.length > 0);
  return (
    <section>
      <h2>{m.heading}</h2>
      <p className="form-hint">{m.hint}</p>
      {view.status === "loading" && <p role="status">{m.loading}</p>}
      {view.status === "error" && (
        <ErrorAlert code={view.code} onRetry={goals.reload} />
      )}
      {view.status === "loaded" && games.length === 0 && <p>{m.empty}</p>}
      {games.map((game) => (
        <GameGoalsBlock
          key={game.gameId}
          game={game}
          goals={goals}
          open={openGameId === game.gameId}
          onOpenChange={(open) => setOpenGameId(open ? game.gameId : undefined)}
          onUnauthenticated={onUnauthenticated}
        />
      ))}
      {showsItems && <Attribution />}
    </section>
  );
}

/** A game's goals with their remove buttons, then the control that opens the add panel under them. */
function GameGoalsBlock({
  game,
  goals,
  open,
  onOpenChange,
  onUnauthenticated,
}: {
  game: GameGoals;
  goals: Goals;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [errorCode, setErrorCode] = useState<string>();

  async function remove(item: GameItem) {
    if (goals.busy) return;
    const code = await goals.remove(game.gameId, item.itemId);
    setErrorCode(code);
    if (code) return;
    showToast(m.goals.removed(itemText(item, m)));
    // The pressed button went with its row.
    toggleRef.current?.focus();
  }

  return (
    <div className="goal-game">
      <h3>
        <GameLogo
          gameId={game.gameId}
          name={game.gameName}
          version={game.gameLogoVersion}
        />
        {game.gameName}
      </h3>
      {game.goals.length === 0 ? (
        <p className="form-hint">{m.goals.none}</p>
      ) : (
        <ul className="goal-list" aria-label={m.goals.listLabel(game.gameName)}>
          {game.goals.map((item) => (
            <li key={item.itemId} className="goal-row">
              <GoalItem item={item} />
              <IconButton
                icon="remove"
                label={m.goals.remove}
                subject={itemText(item, m)}
                onClick={() => void remove(item)}
              />
            </li>
          ))}
        </ul>
      )}
      {errorCode && <Alert>{toUserMessage(errorCode)}</Alert>}
      <div className="form-actions">
        <Button
          ref={toggleRef}
          type="button"
          variant="secondary"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={`${m.goals.add}, ${game.gameName}`}
          onClick={() => onOpenChange(!open)}
        >
          <Icon name="plus" />
          {m.goals.add}
        </Button>
      </div>
      {open && (
        <AddGoalPanel
          id={panelId}
          game={game}
          goals={goals}
          onClose={() => {
            onOpenChange(false);
            toggleRef.current?.focus();
          }}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </div>
  );
}

/** The item, then the dungeons and raids it drops in, or that it is on no drop list any more. */
function GoalItem({ item }: { item: GameItem }) {
  const m = useMessages().goals;
  return (
    <>
      <ItemLabel item={item} />
      <span className="goal-row__drops">
        {item.dropsIn.length > 0
          ? m.dropsIn(item.dropsIn.map((activity) => activity.activityName))
          : m.onNoDropList}
      </span>
    </>
  );
}

/**
 * The search of one game's drop-list items: a name field, a dungeon or raid, and the results, each with Add goal or
 * "Already in your goals" (ADR 0029 section 6). Opening it moves focus to the name field; after an add it goes back
 * there, since the pressed button is replaced by the "already" text.
 */
function AddGoalPanel({
  id,
  game,
  goals,
  onClose,
  onUnauthenticated,
}: {
  id: string;
  game: GameGoals;
  goals: Goals;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const fieldId = useId();
  const activityFieldId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const search = useGameItemSearch(game.gameId, onUnauthenticated);
  const [errorCode, setErrorCode] = useState<string>();
  const owned = new Set(game.goals.map((goal) => goal.itemId));

  useEffect(() => fieldRef.current?.focus(), []);

  async function add(item: GameItem) {
    if (goals.busy) return;
    const code = await goals.add(game.gameId, item);
    setErrorCode(code);
    if (!code) showToast(m.goals.added(itemText(item, m)));
    fieldRef.current?.focus();
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={m.goals.panelLabel(game.gameName)}
      className="group-form goal-panel"
    >
      <div className="goal-panel__filters">
        <div className="structure-field">
          <label htmlFor={fieldId}>{m.goals.searchLabel}</label>
          <input
            ref={fieldRef}
            id={fieldId}
            type="search"
            autoComplete="off"
            maxLength={ITEM_SEARCH_MAX_LENGTH}
            value={search.text}
            onChange={(event) => search.setText(event.target.value)}
          />
        </div>
        <div className="structure-field">
          <label htmlFor={activityFieldId}>{m.goals.activityLabel}</label>
          <Select
            id={activityFieldId}
            value={search.activityId}
            onValueChange={search.setActivityId}
            options={[
              { value: "", label: m.goals.allActivities },
              ...search.activities.map((activity) => ({
                value: activity.activityId,
                label: activity.activityName,
              })),
            ]}
          />
        </div>
      </div>
      {errorCode && <Alert>{toUserMessage(errorCode)}</Alert>}
      <SearchResults
        search={search}
        owned={owned}
        onAdd={(item) => void add(item)}
      />
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          <Icon name="close" />
          {m.goals.close}
        </Button>
      </div>
    </div>
  );
}

function SearchResults({
  search,
  owned,
  onAdd,
}: {
  search: ReturnType<typeof useGameItemSearch>;
  owned: Set<number>;
  onAdd: (item: GameItem) => void;
}) {
  const m = useMessages();
  const { view } = search;
  if (view.status === "error")
    return <ErrorAlert code={view.code} onRetry={search.reload} />;
  const list = view.status === "loaded" ? view.value : undefined;
  return (
    <>
      <p role="status" className="form-hint">
        {list ? m.goals.resultCount(list.items.length) : m.goals.searching}
      </p>
      {list && !list.nameSearchComplete && (
        <p className="form-hint">{m.goals.namesUnavailable}</p>
      )}
      {list && list.items.length > 0 && (
        <ul className="goal-results">
          {list.items.map((item) => (
            <li key={item.itemId} className="goal-row">
              <GoalItem item={item} />
              {owned.has(item.itemId) ? (
                <span className="goal-row__owned">
                  <Icon name="selected" />
                  {m.goals.alreadyAdded}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`${m.goals.add}, ${itemText(item, m)}`}
                  onClick={() => onAdd(item)}
                >
                  <Icon name="plus" />
                  {m.goals.add}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
