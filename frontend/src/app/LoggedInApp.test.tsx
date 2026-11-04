import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiProvider } from "../api";
import { en } from "../i18n/messages/en";
import { fakeApiClient, testUser } from "../test/fakeApiClient";
import { App } from "./App";

function renderLoggedIn(path = "/") {
  window.history.replaceState(null, "", path);
  const client = fakeApiClient({
    getCurrentUser: () => Promise.resolve(testUser),
  });
  render(
    <ApiProvider client={client}>
      <App />
    </ApiProvider>,
  );
  return client;
}

describe("moving between pages", () => {
  it("focuses the main area on a page change but not on first load", async () => {
    renderLoggedIn();
    await screen.findByRole("navigation", { name: en.shell.mainNav });
    const main = screen.getByRole("main");
    expect(document.activeElement).not.toBe(main);

    fireEvent.click(screen.getAllByRole("link", { name: en.shell.you })[0]);

    await waitFor(() => expect(document.activeElement).toBe(main));
    expect(window.location.pathname).toBe("/profile");
  });

  it("reloads the group list, then opens a created group without a page load", async () => {
    const client = renderLoggedIn("/groups");
    await screen.findByRole("main");
    const [plus] = screen.getAllByRole("button", {
      name: en.shell.createGroupButton,
    });
    fireEvent.click(plus);
    fireEvent.change(screen.getByRole("textbox", { name: en.groupNameLabel }), {
      target: { value: "Friday crew" },
    });

    fireEvent.click(screen.getByRole("button", { name: en.createGroupSubmit }));

    await waitFor(() => expect(window.location.pathname).toBe("/groups/new"));
    await waitFor(() => expect(client.listGroups).toHaveBeenCalledTimes(2));
  });
});
