import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { CreateGroup } from "./CreateGroup";

const NAME_LABEL = en.groupNameLabel;
const SUBMIT = en.createGroupSubmit;

function renderForm(client: ApiClient) {
  const onUnauthenticated = vi.fn();
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <ApiProvider client={client}>
      <CreateGroup
        onCreated={onCreated}
        onCancel={onCancel}
        onUnauthenticated={onUnauthenticated}
      />
    </ApiProvider>,
  );
  return { onUnauthenticated, onCreated, onCancel };
}

function typeName(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: NAME_LABEL }), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: SUBMIT }));
}

/** The text of the element the input's aria-describedby points to, joined. */
function descriptionOf(input: HTMLElement): string {
  return (input.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

describe("create group form", () => {
  it("focuses the name field when it opens", () => {
    renderForm(fakeApiClient());
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: NAME_LABEL }),
    );
  });

  it("creates a group with the typed name and hands it over", async () => {
    const client = fakeApiClient();
    const { onCreated } = renderForm(client);

    typeName("Friday crew");
    submit();

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({
        id: "new",
        name: "Friday crew",
      }),
    );
    expect(client.createGroup).toHaveBeenCalledWith("Friday crew");
  });

  it("cancels", () => {
    const { onCancel } = renderForm(fakeApiClient());
    fireEvent.click(screen.getByRole("button", { name: en.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it.each(["", "   ", "x".repeat(51)])(
    "denies the name %j without calling the server",
    async (name) => {
      const client = fakeApiClient();
      renderForm(client);

      typeName(name);
      submit();

      const input = screen.getByRole("textbox", { name: NAME_LABEL });
      expect(
        await screen.findByText(en.errors.invalid_group_name),
      ).toBeTruthy();
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(descriptionOf(input)).toContain(en.errors.invalid_group_name);
      expect(client.createGroup).not.toHaveBeenCalled();
    },
  );

  it("shows the server's invalid_group_name tied to the input", async () => {
    const client = fakeApiClient({
      createGroup: () =>
        Promise.reject(new ApiError(400, "invalid_group_name")),
    });
    renderForm(client);

    typeName("Friday crew");
    submit();

    const input = screen.getByRole("textbox", { name: NAME_LABEL });
    expect(await screen.findByText(en.errors.invalid_group_name)).toBeTruthy();
    expect(descriptionOf(input)).toContain(en.errors.invalid_group_name);
  });

  it("moves focus to the name field after an error", async () => {
    renderForm(fakeApiClient());

    typeName("");
    submit();

    const input = screen.getByRole("textbox", { name: NAME_LABEL });
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("moves focus to the success message and clears the field", async () => {
    renderForm(fakeApiClient());

    typeName("Friday crew");
    submit();

    const status = await screen.findByText(en.groupCreated);
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(
      (screen.getByRole("textbox", { name: NAME_LABEL }) as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("shows a service error and keeps what was typed", async () => {
    renderForm(
      fakeApiClient({
        createGroup: () =>
          Promise.reject(new ApiError(503, "service_unavailable")),
      }),
    );

    typeName("Friday crew");
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    expect(
      (screen.getByRole("textbox", { name: NAME_LABEL }) as HTMLInputElement)
        .value,
    ).toBe("Friday crew");
  });

  it("sends an expired session to login", async () => {
    const { onUnauthenticated } = renderForm(
      fakeApiClient({
        createGroup: () => Promise.reject(new ApiError(401, "unauthenticated")),
      }),
    );

    typeName("Friday crew");
    submit();

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});
