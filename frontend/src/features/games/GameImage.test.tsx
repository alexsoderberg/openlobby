import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient, type Game } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { GamesPage } from "./GamesPage";

const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const catan: Game = {
  id: "g1",
  name: "Catan",
  defaultMaxPlayers: 4,
  genre: null,
  logoVersion: null,
};
const png = new File([new Uint8Array([0x89, 0x50])], "catan.png", {
  type: "image/png",
});

function renderPage(overrides: Partial<ApiClient> = {}, isSystemAdmin = true) {
  const client = fakeApiClient({
    listGames: vi.fn(() => Promise.resolve([catan])),
    ...overrides,
  });
  const view = render(
    <ApiProvider client={client}>
      <GamesPage isSystemAdmin={isSystemAdmin} onUnauthenticated={vi.fn()} />
    </ApiProvider>,
  );
  return { client, ...view };
}

async function openLogoField() {
  fireEvent.click(
    await screen.findByRole("button", { name: `${en.gameEdit}, Catan` }),
  );
  return screen.getByRole("group", { name: en.gameImage.logo });
}

const imageOf = (scope: HTMLElement) =>
  scope.querySelector('[data-slot="game-logo"] img');
const choose = (field: HTMLElement, file: File) =>
  fireEvent.change(field.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });

describe("game logo in the game list", () => {
  it("shows the logo before the name, and the monogram without one", async () => {
    renderPage({
      listGames: () =>
        Promise.resolve([
          { ...catan, logoVersion: OLD },
          { ...catan, id: "g2", name: "Chess" },
        ]),
    });

    const [withLogo, without] = await screen.findAllByRole("listitem");
    expect(imageOf(withLogo)?.getAttribute("src")).toBe(
      `/api/games/g1/images/logo?v=${OLD}`,
    );
    expect(imageOf(without)).toBeNull();
    expect(within(without).getByText("C")).toBeTruthy();
  });
});

describe("game logo in the game form", () => {
  it("has no logo field in the add form", async () => {
    renderPage();
    await screen.findByText("Catan");
    expect(screen.queryByRole("group", { name: en.gameImage.logo })).toBeNull();
  });

  it("is not shown to a non-admin", () => {
    renderPage({}, false);
    expect(screen.queryByRole("group", { name: en.gameImage.logo })).toBeNull();
  });

  it("uploads the chosen file at once and shows the new logo with an inline status", async () => {
    const setGameImage = vi.fn(() =>
      Promise.resolve({ ...catan, logoVersion: NEW }),
    );
    const { client } = renderPage({ setGameImage });
    const field = await openLogoField();
    expect(imageOf(field)).toBeNull();

    choose(field, png);

    expect(await within(field).findByText(en.gameImageSaving)).toBeTruthy();
    expect(await within(field).findByText(en.gameImageSaved)).toBeTruthy();
    expect(setGameImage).toHaveBeenCalledWith("g1", "logo", png);
    expect(imageOf(field)?.getAttribute("src")).toBe(
      `/api/games/g1/images/logo?v=${NEW}`,
    );
    expect(client.replaceGame).not.toHaveBeenCalled();
    expect(client.listGames).toHaveBeenCalledTimes(2);
    // The outcome is said once, in the field: no toast (ADR 0026 point 13).
    expect(screen.getAllByText(en.gameImageSaved)).toHaveLength(1);
  });

  it("shows the version of the reloaded list once it differs from the answer", async () => {
    const LATER = "c".repeat(64);
    const listGames = vi
      .fn()
      .mockResolvedValueOnce([catan])
      .mockResolvedValue([{ ...catan, logoVersion: LATER }]);
    renderPage({
      listGames,
      setGameImage: () => Promise.resolve({ ...catan, logoVersion: NEW }),
    });
    const field = await openLogoField();

    choose(field, png);

    await waitFor(() =>
      expect(imageOf(field)?.getAttribute("src")).toContain(LATER),
    );
  });

  it("opens the browser's file choice from the choose button", async () => {
    renderPage();
    const field = await openLogoField();
    const input = field.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click");

    fireEvent.click(
      within(field).getByRole("button", { name: en.gameImageChoose }),
    );

    expect(click).toHaveBeenCalled();
    expect(input.accept).toBe("image/png,image/jpeg,image/webp");
  });

  it.each([
    ["invalid_image_type", 400],
    ["image_too_large", 413],
    ["not_allowed", 403],
    ["game_not_found", 404],
  ])("shows %s next to the field and keeps the image", async (code, status) => {
    renderPage({
      listGames: () => Promise.resolve([{ ...catan, logoVersion: OLD }]),
      setGameImage: () => Promise.reject(new ApiError(status, code)),
    });
    const field = await openLogoField();

    choose(field, png);

    expect((await within(field).findByRole("alert")).textContent).toBe(
      en.errors[code as keyof typeof en.errors],
    );
    expect(imageOf(field)?.getAttribute("src")).toContain(OLD);
  });

  it("removes the logo after confirmation and shows the monogram", async () => {
    const { client } = renderPage({
      listGames: vi.fn(() => Promise.resolve([{ ...catan, logoVersion: OLD }])),
    });
    const field = await openLogoField();

    const remove = within(field).getByRole("button", {
      name: en.gameImageRemove,
    });
    expect(remove.dataset.variant).toBe("danger");
    fireEvent.click(remove);
    const dialog = await screen.findByRole("alertdialog", {
      name: en.gameImageRemoveHeading.logo("Catan"),
    });
    expect(client.removeGameImage).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.gameImageRemoveSubmit }),
    );

    const status = await within(field).findByText(en.gameImageRemoved);
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(client.removeGameImage).toHaveBeenCalledWith("g1", "logo");
    expect(imageOf(field)).toBeNull();
    expect(
      within(field).queryByRole("button", { name: en.gameImageRemove }),
    ).toBeNull();
    expect(screen.getAllByText(en.gameImageRemoved)).toHaveLength(1);
  });

  it("keeps the dialog open with the error when the removal fails", async () => {
    renderPage({
      listGames: () => Promise.resolve([{ ...catan, logoVersion: OLD }]),
      removeGameImage: () => Promise.reject(new ApiError(403, "not_allowed")),
    });
    const field = await openLogoField();

    fireEvent.click(
      within(field).getByRole("button", { name: en.gameImageRemove }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.gameImageRemoveSubmit }),
    );

    expect(await within(dialog).findByText(en.errors.not_allowed)).toBeTruthy();
    expect(imageOf(field)).not.toBeNull();
  });

  it("opens the new game's form with its logo field after it is added", async () => {
    const created: Game = { ...catan, id: "g9", name: "Azul" };
    const listGames = vi
      .fn()
      .mockResolvedValueOnce([catan])
      .mockResolvedValue([catan, created]);
    renderPage({ listGames, createGame: () => Promise.resolve(created) });
    await screen.findByText("Catan");
    const addForm = screen
      .getByRole("heading", { name: en.gameAddHeading })
      .closest("section")!;

    fireEvent.change(within(addForm).getByLabelText(en.gameNameLabel), {
      target: { value: "Azul" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.gameAddSubmit }));

    const field = await screen.findByRole("group", { name: en.gameImage.logo });
    expect(within(field).getByText("A")).toBeTruthy();
  });
});

describe("game form images", () => {
  it("has the logo field only", async () => {
    renderPage();
    await openLogoField();
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });
});
