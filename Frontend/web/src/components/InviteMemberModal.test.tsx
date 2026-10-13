import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteMemberModal } from "./InviteMemberModal";
import { I18nProvider } from "../i18n/I18nContext";
import { TRANSLATIONS } from "../i18n/translations";
import * as authApi from "../api/auth";
import * as mapsApi from "../api/maps";
import type { MapDoc } from "../types";

vi.mock("../api/auth", () => ({ searchUsers: vi.fn() }));
vi.mock("../api/maps", () => ({ inviteMember: vi.fn() }));

const t = TRANSLATIONS.en;
const map = { mapId: "m1", name: "Plans" } as MapDoc;

describe("InviteMemberModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches by what's typed and invites the picked user", async () => {
    vi.mocked(authApi.searchUsers).mockResolvedValue([{ _id: "u2", username: "alice" }]);
    vi.mocked(mapsApi.inviteMember).mockResolvedValue({ ...map, members: ["u1", "u2"] } as MapDoc);
    const onInvited = vi.fn();
    render(
      <I18nProvider>
        <InviteMemberModal map={map} onClose={vi.fn()} onInvited={onInvited} />
      </I18nProvider>,
    );

    expect(screen.getByText(t.ui.invite.typeMore)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(t.ui.invite.search), "ali");

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(authApi.searchUsers).toHaveBeenCalledWith("ali", "m1");

    await userEvent.click(screen.getByRole("button", { name: t.ui.invite.invite }));

    expect(mapsApi.inviteMember).toHaveBeenCalledWith("m1", "u2");
    expect(await screen.findByText(t.ui.invite.invited("alice"))).toBeInTheDocument();
    expect(onInvited).toHaveBeenCalled();
    expect(screen.queryByText("a@test.com")).not.toBeInTheDocument();
  });

  it("says when nobody matches", async () => {
    vi.mocked(authApi.searchUsers).mockResolvedValue([]);
    render(
      <I18nProvider>
        <InviteMemberModal map={map} onClose={vi.fn()} />
      </I18nProvider>,
    );

    await userEvent.type(screen.getByLabelText(t.ui.invite.search), "zz");

    expect(await screen.findByText(t.ui.invite.noResults)).toBeInTheDocument();
  });
});
