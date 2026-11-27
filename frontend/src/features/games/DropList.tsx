import { useId, useRef, useState } from "react";
import { parseItemId, type Item } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import {
  Button,
  ConfirmDialog,
  ErrorAlert,
  Icon,
  ItemLabel,
  itemText,
} from "../../ui";
import { useDropList } from "./useDropList";

const INVALID_ITEM = "invalid_item";

/**
 * The drop list of one saved Named activity in the game form: its items in the order they were added, a field that
 * adds an item by its ID, and a removal after confirmation. It writes at once on its own requests, so it is no
 * form of its own (it sits inside the game form) and Enter in its field adds instead of saving the game. The
 * outcome is an inline status, as the other admin writes (ADR 0029 section 6).
 */
export function DropList({
  gameId,
  activityId,
  activityName,
  onUnauthenticated,
}: {
  gameId: string;
  activityId: string;
  activityName: string;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const id = useId();
  const list = useDropList(gameId, activityId, onUnauthenticated);
  const [text, setText] = useState("");
  const [errorCode, setErrorCode] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [removing, setRemoving] = useState<Item>();
  const fieldRef = useRef<HTMLInputElement>(null);
  const fieldId = `${id}-item`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  async function add() {
    setStatus(undefined);
    const itemId = parseItemId(text);
    const { code, item } =
      itemId === undefined
        ? { code: INVALID_ITEM, item: undefined }
        : await list.add(itemId);
    setErrorCode(code);
    if (item) {
      setText("");
      setStatus(
        item.status === "unknown" ? m.dropListAddedUnknown : m.dropListAdded,
      );
    }
    // Back in the field either way: to fix the ID, or to enter the next one.
    fieldRef.current?.focus();
  }

  return (
    <div
      role="group"
      aria-label={m.dropListHeading(activityName)}
      className="drop-list"
    >
      <h4 className="drop-list__title">{m.dropListTitle}</h4>
      <DropListItems
        list={list}
        onRemove={(item) => {
          setStatus(undefined);
          setRemoving(item);
        }}
      />
      <div className="drop-list__add">
        <div className="structure-field">
          <label htmlFor={fieldId}>{m.dropListItemIdLabel}</label>
          <input
            ref={fieldRef}
            id={fieldId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            aria-invalid={errorCode !== undefined || undefined}
            aria-describedby={errorCode ? `${hintId} ${errorId}` : hintId}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void add();
            }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={list.busy}
          onClick={() => void add()}
        >
          <Icon name="plus" />
          {m.dropListAdd}
        </Button>
      </div>
      <p id={hintId} className="form-hint">
        {m.dropListItemIdHint}
      </p>
      {errorCode && (
        <p id={errorId} role="alert" className="field-error">
          {toUserMessage(errorCode)}
        </p>
      )}
      <p role="status" className="status">
        {status}
      </p>
      {removing && (
        <ConfirmDialog
          heading={m.dropListRemoveHeading(itemText(removing, m))}
          body={m.dropListRemoveConfirm}
          submitLabel={m.dropListRemoveSubmit}
          submitIcon="remove"
          danger
          keepLabel={m.dropListRemoveKeep}
          busy={list.busy}
          onConfirm={() => list.remove(removing.itemId)}
          onClose={(removed) => {
            setRemoving(undefined);
            if (!removed) return;
            list.forget(removing.itemId);
            setStatus(m.dropListRemoved);
            // The opener went with the item.
            fieldRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/** The list in its load state: loading, failed with a retry, empty, or the items with their remove buttons. */
function DropListItems({
  list,
  onRemove,
}: {
  list: ReturnType<typeof useDropList>;
  onRemove: (item: Item) => void;
}) {
  const m = useMessages();
  const { view, items } = list;
  if (view.status === "loading")
    return <p className="form-hint">{m.dropListLoading}</p>;
  if (view.status === "error")
    return <ErrorAlert code={view.code} onRetry={list.reload} />;
  if (items.length === 0) return <p className="form-hint">{m.dropListEmpty}</p>;
  return (
    <ol className="drop-list__items">
      {items.map((item) => (
        <li key={item.itemId} className="drop-list__item">
          <ItemLabel item={item} />
          <Button
            type="button"
            variant="danger"
            aria-label={`${m.dropListRemove}, ${itemText(item, m)}`}
            onClick={() => onRemove(item)}
          >
            <Icon name="remove" />
            {m.gameRemove}
          </Button>
        </li>
      ))}
    </ol>
  );
}
