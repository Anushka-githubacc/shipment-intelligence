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

jest.mock(
  "@salesforce/apex/ShipmentController.getShipmentDetail",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.getShipmentEvents",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.refreshShipment",
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

  it("renders exactly six real workspaces without obsolete placeholders", async () => {
    const element = mount();
    await flush();

    const navItems = Array.from(
      element.shadowRoot.querySelectorAll(".nav-item")
    );

    const workspaceIds = navItems.map((item) => item.dataset.workspace);

    expect(workspaceIds).toEqual([
      "control-tower",
      "shipment-intelligence",
      "risk-intelligence",
      "exception-centre",
      "analytics-reports",
      "case-management"
    ]);

    expect(
      element.shadowRoot.querySelector(
        '[data-workspace="carrier-integrations"]'
      )
    ).toBeNull();

    expect(
      element.shadowRoot.querySelector(".coming-soon-container")
    ).toBeNull();

    expect(element.shadowRoot.querySelector(".badge-coming-soon")).toBeNull();
  });

  it("navigates to Exception Centre workspace", async () => {
    const element = mount();
    await flush();

    const exceptionCentreBtn = element.shadowRoot.querySelector(
      '[data-workspace="exception-centre"]'
    );
    expect(exceptionCentreBtn.querySelector(".badge-coming-soon")).toBeNull();

    exceptionCentreBtn.click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Exception Centre");
    expect(
      element.shadowRoot.querySelector('[data-view="exception-centre"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("c-exception-centre")
    ).not.toBeNull();
  });

  it("navigates to Risk Intelligence workspace", async () => {
    const element = mount();
    await flush();

    const riskIntelligenceBtn = element.shadowRoot.querySelector(
      '[data-workspace="risk-intelligence"]'
    );
    expect(riskIntelligenceBtn.querySelector(".badge-coming-soon")).toBeNull();

    riskIntelligenceBtn.click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Risk Intelligence");
    expect(
      element.shadowRoot.querySelector('[data-view="risk-intelligence"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("c-risk-intelligence")
    ).not.toBeNull();
  });

  it("navigates to Analytics & Reports workspace", async () => {
    const element = mount();
    await flush();

    const analyticsBtn = element.shadowRoot.querySelector(
      '[data-workspace="analytics-reports"]'
    );
    expect(analyticsBtn.querySelector(".badge-coming-soon")).toBeNull();

    analyticsBtn.click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Analytics & Reports");
    expect(
      element.shadowRoot.querySelector('[data-view="analytics-reports"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("c-analytics-reports")
    ).not.toBeNull();
  });

  it("navigates to Shipment Intelligence workspace", async () => {
    const element = mount();
    await flush();

    const shipmentIntelligenceBtn = element.shadowRoot.querySelector(
      '[data-workspace="shipment-intelligence"]'
    );
    expect(
      shipmentIntelligenceBtn.querySelector(".badge-coming-soon")
    ).toBeNull();

    shipmentIntelligenceBtn.click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Shipment Intelligence");
    expect(
      element.shadowRoot.querySelector('[data-view="shipment-intelligence"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("c-shipment-intelligence")
    ).not.toBeNull();
  });

  it("navigates to Case Management workspace", async () => {
    const element = mount();
    await flush();

    const caseMgmtBtn = element.shadowRoot.querySelector(
      '[data-workspace="case-management"]'
    );
    expect(caseMgmtBtn.querySelector(".badge-coming-soon")).toBeNull();

    caseMgmtBtn.click();
    await flush();

    expect(text(element, ".workspace-heading")).toBe("Case Management");
    expect(
      element.shadowRoot.querySelector('[data-view="case-management"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector("c-case-management")
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
