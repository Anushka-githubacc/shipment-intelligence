import { createElement } from "@lwc/engine-dom";
import RiskIntelligence from "c/riskIntelligence";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import getShipmentDetail from "@salesforce/apex/ShipmentController.getShipmentDetail";
import { refreshApex } from "@salesforce/apex";

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
  "@salesforce/apex/ShipmentController.getShipmentDetail",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return {
      default: createApexTestWireAdapter()
    };
  },
  { virtual: true }
);

const MOCK_ALL_SHIPMENTS = [
  {
    Id: "a01000000000001AAA",
    Name: "SH-0001",
    Tracking_Code__c: "TRACK-ONTRACK-01",
    Carrier__c: "shippo",
    Provider__c: "Shippo",
    Status__c: "in_transit",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Within delivery SLA window",
    Estimated_Delivery_Date__c: "2026-11-20T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  },
  {
    Id: "a01000000000002AAA",
    Name: "SH-0002",
    Tracking_Code__c: "TRACK-ATRISK-02",
    Carrier__c: "usps",
    Provider__c: "Shippo",
    Status__c: "in_transit",
    Risk_Level__c: "At Risk",
    Risk_Reason__c: "Approaching SLA window deadline",
    Estimated_Delivery_Date__c: "2026-11-16T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  },
  {
    Id: "a01000000000003AAA",
    Name: "SH-0003",
    Tracking_Code__c: "TRACK-DELAYED-03",
    Carrier__c: "fedex",
    Provider__c: "Shippo",
    Status__c: "failure",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Carrier reported delivery failure",
    Estimated_Delivery_Date__c: "2026-11-10T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: "500000000000001AAA",
    Case__r: {
      CaseNumber: "00001003",
      Subject: "Customer escalation on failed package",
      Status: "Working",
      Priority: "High"
    }
  }
];

function mount() {
  const element = createElement("c-risk-intelligence", {
    is: RiskIntelligence
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

describe("c-risk-intelligence", () => {
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

  it("renders workspace title and risk KPI cards", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    expect(text(element, ".header-title")).toBe("Risk Intelligence");
    expect(text(element, '[data-metric="total"] .kpi-value')).toBe("3");
    expect(text(element, '[data-metric="on-track"] .kpi-value')).toBe("1");
    expect(text(element, '[data-metric="at-risk"] .kpi-value')).toBe("1");
    expect(text(element, '[data-metric="delayed"] .kpi-value')).toBe("1");
  });

  it("renders risk distribution visualizer and percentages", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    expect(text(element, ".distribution-legend")).toContain("On Track (33%)");
    expect(text(element, ".distribution-legend")).toContain("At Risk (33%)");
    expect(text(element, ".distribution-legend")).toContain("Delayed (33%)");

    const bar = element.shadowRoot.querySelector(".distribution-bar");
    expect(bar).not.toBeNull();
  });

  it("renders risk assessment table with shipment rows", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".risk-table tbody tr");
    expect(rows.length).toBe(3);

    const firstRow = rows[0];
    expect(text(firstRow, ".td-ref")).toBe("SH-0001");
    expect(text(firstRow, ".td-code")).toBe("TRACK-ONTRACK-01");
    expect(text(firstRow, ".carrier-pill")).toBe("shippo");
    expect(text(firstRow, ".risk-badge")).toBe("On Track");
    expect(text(firstRow, ".td-reason")).toContain(
      "Within delivery SLA window"
    );
  });

  it("clicking a quick-filter KPI card filters the risk table", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const delayedCard = element.shadowRoot.querySelector(
      '[data-metric="delayed"]'
    );
    delayedCard.click();
    await flush();

    expect(getShipments.getLastConfig().riskFilter).toBe("Delayed");
  });

  it("selecting a shipment opens the risk inspection panel with details", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const inspectButtons = element.shadowRoot.querySelectorAll(".btn-inspect");
    inspectButtons[2].click();
    await flush();

    getShipmentDetail.emit(MOCK_ALL_SHIPMENTS[2]);
    await flush();

    const panel = element.shadowRoot.querySelector(".inspection-panel");
    expect(panel).not.toBeNull();
    expect(text(panel, ".panel-title")).toBe("TRACK-DELAYED-03");
    expect(text(panel, ".panel-reason-text")).toContain(
      "Carrier reported delivery failure"
    );
    expect(text(panel, ".panel-meta-list")).toContain("SH-0003");

    // Linked support Case
    expect(panel.textContent).toContain("#00001003");
    expect(panel.textContent).toContain(
      "Customer escalation on failed package"
    );
  });

  it("closing the inspection panel hides it", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const inspectBtn = element.shadowRoot.querySelector(".btn-inspect");
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_ALL_SHIPMENTS[0]);
    await flush();

    expect(
      element.shadowRoot.querySelector(".inspection-panel")
    ).not.toBeNull();

    const closeBtn = element.shadowRoot.querySelector(".btn-close-panel");
    closeBtn.click();
    await flush();

    expect(element.shadowRoot.querySelector(".inspection-panel")).toBeNull();
  });

  it("filters shipments by risk and status comboboxes", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const selects = element.shadowRoot.querySelectorAll(".filter-select");
    const riskSelect = selects[0];
    const statusSelect = selects[1];

    riskSelect.dispatchEvent(
      new CustomEvent("change", { detail: { value: "At Risk" } })
    );
    statusSelect.dispatchEvent(
      new CustomEvent("change", { detail: { value: "in_transit" } })
    );
    await flush();

    expect(getShipments.getLastConfig().riskFilter).toBe("At Risk");
    expect(getShipments.getLastConfig().statusFilter).toBe("in_transit");
  });

  it("debounces search input and updates wire parameter", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const searchInput = element.shadowRoot.querySelector(".risk-search-input");
    searchInput.value = "TRACK-DELAYED";
    searchInput.dispatchEvent(new CustomEvent("change"));

    // Before 300ms
    jest.advanceTimersByTime(200);
    await flush();

    // Advance past debounce
    jest.advanceTimersByTime(100);
    await flush();

    expect(getShipments.getLastConfig().searchTerm).toBe("TRACK-DELAYED");
  });

  it("clears active filters when Clear button is clicked", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    const riskSelect = element.shadowRoot.querySelector(".filter-select");
    riskSelect.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Delayed" } })
    );
    await flush();

    const clearBtn = element.shadowRoot.querySelector(".btn-clear-filters");
    expect(clearBtn).not.toBeNull();
    clearBtn.click();
    await flush();

    expect(getShipments.getLastConfig().riskFilter).toBeNull();
    expect(getShipments.getLastConfig().searchTerm).toBeNull();
  });

  it("displays empty state when no records match filters", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    // Emit empty result
    getShipments.emit([]);
    await flush();

    expect(element.shadowRoot.querySelector(".state-empty")).not.toBeNull();
    expect(text(element, ".state-title")).toBe("No matching shipments found");
  });

  it("displays error state when wire adapter emits an error", async () => {
    const element = mount();
    getShipments.emitError({
      body: { message: "SOQL query execution failed" }
    });
    await flush();

    expect(element.shadowRoot.querySelector(".state-error")).not.toBeNull();
    expect(text(element, ".state-message")).toContain(
      "SOQL query execution failed"
    );
  });

  it("handles externalSearchTerm API property update", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    element.externalSearchTerm = "GLOBAL-QUERY";
    jest.advanceTimersByTime(300);
    await flush();

    expect(element.externalSearchTerm).toBe("GLOBAL-QUERY");
    expect(getShipments.getLastConfig().searchTerm).toBe("GLOBAL-QUERY");
  });

  it("handles handleRefresh API method", async () => {
    const element = mount();
    getShipments.emit(MOCK_ALL_SHIPMENTS);
    await flush();

    await element.handleRefresh();
    expect(refreshApex).toHaveBeenCalled();
  });
});
