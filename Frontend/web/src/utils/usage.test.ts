import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushUsage, pageName, resetUsage, setUsageTransport, setUsageUser, track } from "./usage";

describe("usage", () => {
  const sent: { name: string; props?: Record<string, string> }[][] = [];
  let answer: "sent" | "retry" | "drop" = "sent";

  beforeEach(() => {
    vi.useFakeTimers();
    sent.length = 0;
    answer = "sent";
    resetUsage();
    setUsageTransport(async (events) => {
      sent.push(events.map(({ name, props }) => (props ? { name, props } : { name })));
      return answer;
    });
  });
  afterEach(() => {
    setUsageTransport(null);
    resetUsage();
    vi.useRealTimers();
  });

  it("records nothing until someone is signed in", async () => {
    track({ name: "quick_note_added" });
    await flushUsage();
    expect(sent).toEqual([]);
  });

  it("batches events and sends them a few seconds later", async () => {
    setUsageUser("u1");
    track({ name: "app_opened", props: { page: "dashboard" } });
    track({ name: "node_created", props: { type: undefined } });
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([[{ name: "app_opened", props: { page: "dashboard" } }, { name: "node_created" }]]);
  });

  it("keeps events when the server can't be reached, and sends them later in order", async () => {
    setUsageUser("u1");
    answer = "retry";
    track({ name: "think_started" });
    await flushUsage();
    answer = "sent";
    track({ name: "think_finished" });
    await flushUsage();
    expect(sent[sent.length - 1]).toEqual([{ name: "think_started" }, { name: "think_finished" }]);
  });

  it("drops what's waiting on signing out after trying to send it", async () => {
    setUsageUser("u1");
    track({ name: "map_shared" });
    setUsageUser(null);
    await vi.advanceTimersByTimeAsync(0);
    track({ name: "map_shared" });
    await flushUsage();
    expect(sent).toEqual([[{ name: "map_shared" }]]);
  });

  it("names pages without any id in them", () => {
    expect(pageName("/")).toBe("dashboard");
    expect(pageName("/maps/abc123")).toBe("map");
    expect(pageName("/think")).toBe("think");
    expect(pageName("/split")).toBe("split");
    expect(pageName("/%20weird")).toBe("other");
  });
});
