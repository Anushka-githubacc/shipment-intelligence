import { createElement } from "@lwc/engine-dom";
import LogisticsAppShell from "c/logisticsAppShell";

jest.mock(
  "@salesforce/apex",
  () => ({
    refreshApex: jest.fn(() => Promise.resolve())
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.getShipments",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.syncOne",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.syncMultiple",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

function mount() {
  const element = createElement("c-logistics-app-shell", {
    is: LogisticsAppShell
  });
  document.body.appendChild(element);
  return element;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function text(element, selector) {
  const root = element.shadowRoot || element;
  const node = root.querySelector(selector);
  return node ? node.textContent.trim() : "";
}

function dispatchChange(element, selector, detail) {
  element.shadowRoot.querySelector(selector).dispatchEvent(
    new CustomEvent("change", {
      detail
    })
  );
}

describe("c-logistics-app-shell", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("renders Control Tower as the default active workspace", async () => {
    const element = mount();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Control Tower");
    expect(
      element.shadowRoot.querySelector('[data-view="control-tower"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("c-shipment-dashboard")
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".coming-soon-container")
    ).toBeNull();

    const activeNavItem = element.shadowRoot.querySelector(
      '.nav-item[data-workspace="control-tower"]'
    );
    expect(activeNavItem.classList.contains("is-active")).toBe(true);
    expect(activeNavItem.getAttribute("aria-current")).toBe("page");
  });

  it("navigates to Coming Soon workspaces and displays appropriate placeholder", async () => {
    const element = mount();
    await flush();

    const riskIntelligenceBtn = element.shadowRoot.querySelector(
      '[data-workspace="risk-intelligence"]'
    );
    riskIntelligenceBtn.click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Risk Intelligence");
    expect(element.shadowRoot.querySelector("c-shipment-dashboard")).toBeNull();

    const comingSoonView = element.shadowRoot.querySelector(
      '.coming-soon-container[data-view="risk-intelligence"]'
    );
    expect(comingSoonView).not.toBeNull();
    expect(text(comingSoonView, ".coming-soon-title")).toBe(
      "Risk Intelligence"
    );
    expect(text(comingSoonView, ".coming-soon-desc")).toContain(
      "Predictive delay modelling"
    );
    expect(text(comingSoonView, ".badge-coming-soon-large")).toBe(
      "Coming Soon"
    );
  });

  it("returns to Control Tower when Return button is clicked from a Coming Soon view", async () => {
    const element = mount();
    await flush();

    element.shadowRoot
      .querySelector('[data-workspace="exception-centre"]')
      .click();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-view="exception-centre"]')
    ).not.toBeNull();

    element.shadowRoot
      .querySelector('[data-action="return-control-tower"]')
      .click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Control Tower");
    expect(
      element.shadowRoot.querySelector("c-shipment-dashboard")
    ).not.toBeNull();
  });

  it("debounces global search and communicates search term to child dashboard", async () => {
    const element = mount();
    await flush();

    const dashboard = element.shadowRoot.querySelector("c-shipment-dashboard");
    expect(dashboard).not.toBeNull();

    dispatchChange(element, '[data-element="global-search"]', {
      value: "SHIPPO-999"
    });

    // Before debounce timer fires
    expect(dashboard.externalSearchTerm).toBeNull();

    // Advance debounce timer (300ms)
    jest.advanceTimersByTime(300);
    await flush();

    expect(dashboard.externalSearchTerm).toBe("SHIPPO-999");
  });

  it("switches back to Control Tower if global search is used from a Coming Soon workspace", async () => {
    const element = mount();
    await flush();

    element.shadowRoot
      .querySelector('[data-workspace="analytics-reports"]')
      .click();
    await flush();

    expect(
      element.shadowRoot.querySelector(".coming-soon-container")
    ).not.toBeNull();

    dispatchChange(element, '[data-element="global-search"]', {
      value: "TRACK-EXPRESS"
    });
    jest.advanceTimersByTime(300);
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Control Tower");
    const dashboard = element.shadowRoot.querySelector("c-shipment-dashboard");
    expect(dashboard).not.toBeNull();
    expect(dashboard.externalSearchTerm).toBe("TRACK-EXPRESS");
  });

  it("delegates topbar refresh button click to child dashboard refresh method", async () => {
    const element = mount();
    await flush();

    const dashboard = element.shadowRoot.querySelector("c-shipment-dashboard");
    const refreshSpy = jest
      .spyOn(dashboard, "refresh")
      .mockImplementation(() => {});

    element.shadowRoot.querySelector('[data-action="global-refresh"]').click();
    await flush();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("toggles sidebar collapse state on desktop", async () => {
    const element = mount();
    await flush();

    const sidebar = element.shadowRoot.querySelector(".sidebar");
    expect(sidebar.classList.contains("collapsed")).toBe(false);

    element.shadowRoot.querySelector('[data-action="toggle-sidebar"]').click();
    await flush();

    expect(sidebar.classList.contains("collapsed")).toBe(true);

    element.shadowRoot.querySelector('[data-action="toggle-sidebar"]').click();
    await flush();

    expect(sidebar.classList.contains("collapsed")).toBe(false);
  });

  it("toggles mobile drawer navigation on mobile view", async () => {
    const element = mount();
    await flush();

    const appShell = element.shadowRoot.querySelector(".app-shell");
    expect(appShell.classList.contains("is-mobile-open")).toBe(false);

    element.shadowRoot
      .querySelector('[data-action="toggle-mobile-nav"]')
      .click();
    await flush();

    expect(appShell.classList.contains("is-mobile-open")).toBe(true);

    // Clicking mobile backdrop closes drawer
    element.shadowRoot.querySelector(".mobile-backdrop").click();
    await flush();

    expect(appShell.classList.contains("is-mobile-open")).toBe(false);
  });
});
