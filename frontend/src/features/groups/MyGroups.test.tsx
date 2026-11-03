import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { MyGroups } from "./MyGroups";

const NAME_LABEL = en.groupNameLabel;
const SUBMIT = en.createGroupSubmit;

function renderGroups(client: ApiClient) {
  const onUnauthenticated = vi.fn();
  render(
    <ApiProvider client={client}>
      <MyGroups onUnauthenticated={onUnauthenticated} />
    </ApiProvider>,
  );
  return { onUnauthenticated };
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

describe("group list", () => {
  it("links each group to its group page", async () => {
    renderGroups(
      fakeApiClient({
        listGroups: () => Promise.resolve([{ id: "g1", name: "Friday crew" }]),
      }),
    );

    const link = await screen.findByRole("link", { name: "Friday crew" });
    expect(link.getAttribute("href")).toBe("/groups/g1");
  });
});

describe("create group", () => {
  it("creates a group with the typed name and shows it in the list", async () => {
    const groups = [{ id: "g1", name: "Friday crew" }];
    const client = fakeApiClient({
      listGroups: vi
        .fn<ApiClient["listGroups"]>()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(groups),
    });
    renderGroups(client);
    await screen.findByText(en.groupsEmpty);

    typeName("Friday crew");
    submit();

    expect(
      await screen.findByRole("link", { name: "Friday crew" }),
    ).toBeTruthy();
    expect(client.createGroup).toHaveBeenCalledWith("Friday crew");
    expect(await screen.findByText(en.groupCreated)).toBeTruthy();
  });

  it.each(["", "   ", "x".repeat(51)])(
    "denies the name %j without calling the server",
    async (name) => {
      const client = fakeApiClient();
      renderGroups(client);
      await screen.findByText(en.groupsEmpty);

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
    renderGroups(client);
    await screen.findByText(en.groupsEmpty);

    typeName("Friday crew");
    submit();

    const input = screen.getByRole("textbox", { name: NAME_LABEL });
    expect(await screen.findByText(en.errors.invalid_group_name)).toBeTruthy();
    expect(descriptionOf(input)).toContain(en.errors.invalid_group_name);
  });

  it("moves focus to the name field after an error", async () => {
    renderGroups(fakeApiClient());
    await screen.findByText(en.groupsEmpty);

    typeName("");
    submit();

    const input = screen.getByRole("textbox", { name: NAME_LABEL });
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("moves focus to the success message and clears the field", async () => {
    renderGroups(fakeApiClient());
    await screen.findByText(en.groupsEmpty);

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
    renderGroups(
      fakeApiClient({
        createGroup: () =>
          Promise.reject(new ApiError(503, "service_unavailable")),
      }),
    );
    await screen.findByText(en.groupsEmpty);

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
    const { onUnauthenticated } = renderGroups(
      fakeApiClient({
        createGroup: () => Promise.reject(new ApiError(401, "unauthenticated")),
      }),
    );
    await screen.findByText(en.groupsEmpty);

    typeName("Friday crew");
    submit();

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});
