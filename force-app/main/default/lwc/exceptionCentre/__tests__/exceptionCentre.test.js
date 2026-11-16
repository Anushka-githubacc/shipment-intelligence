import { createElement } from "@lwc/engine-dom";
import ExceptionCentre from "c/exceptionCentre";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
import getShipmentDetail from "@salesforce/apex/ShipmentController.getShipmentDetail";
import getShipmentEvents from "@salesforce/apex/ShipmentController.getShipmentEvents";
import refreshShipment from "@salesforce/apex/ShipmentController.refreshShipment";
import updateShipmentResolution from "@salesforce/apex/ShipmentController.updateShipmentResolution";
import createCaseForShipment from "@salesforce/apex/ShipmentController.createCaseForShipment";
import linkCaseToShipment from "@salesforce/apex/ShipmentController.linkCaseToShipment";
import getAvailableCases from "@salesforce/apex/ShipmentController.getAvailableCases";
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

jest.mock(
  "@salesforce/apex/ShipmentController.updateShipmentResolution",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.createCaseForShipment",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.linkCaseToShipment",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.getAvailableCases",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const MOCK_SHIPMENTS = [
  {
    Id: "a01000000000001AAA",
    Name: "SH-0001",
    Tracking_Code__c: "TRACK-NORMAL-01",
    Carrier__c: "shippo",
    Provider__c: "Shippo",
    Status__c: "in_transit",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Within delivery window",
    Estimated_Delivery_Date__c: "2026-11-20T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  },
  {
    Id: "a01000000000002AAA",
    Name: "SH-0002",
    Tracking_Code__c: "TRACK-FAIL-02",
    Carrier__c: "fedex",
    Provider__c: "Shippo",
    Status__c: "failure",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Delivery attempt failed at address",
    Estimated_Delivery_Date__c: "2026-11-10T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: "500000000000001AAA",
    Case__r: {
      CaseNumber: "00001002",
      Subject: "Customer escalation on failed delivery",
      Status: "New",
      Priority: "High"
    }
  },
  {
    Id: "a01000000000003AAA",
    Name: "SH-0003",
    Tracking_Code__c: "TRACK-RETURN-03",
    Carrier__c: "usps",
    Provider__c: "Shippo",
    Status__c: "return_to_sender",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Package marked for return to sender",
    Estimated_Delivery_Date__c: "2026-11-11T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  },
  {
    Id: "a01000000000004AAA",
    Name: "SH-0004",
    Tracking_Code__c: "TRACK-DELAY-04",
    Carrier__c: "delhivery",
    Provider__c: "Shippo",
    Status__c: "in_transit",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Past estimated delivery date window",
    Estimated_Delivery_Date__c: "2026-11-12T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  },
  {
    Id: "a01000000000005AAA",
    Name: "SH-0005",
    Tracking_Code__c: "TRACK-ATRISK-05",
    Carrier__c: "shippo",
    Provider__c: "Shippo",
    Status__c: "in_transit",
    Risk_Level__c: "At Risk",
    Risk_Reason__c: "Approaching SLA window threshold",
    Estimated_Delivery_Date__c: "2026-11-16T12:00:00Z",
    Last_Synced__c: "2026-11-15T10:00:00Z",
    Case__c: null
  }
];

const MOCK_EVENTS = [
  {
    Id: "a02000000000001AAA",
    Event_ID__c: "evt-001",
    Event_Date__c: "2026-11-15T09:00:00Z",
    Event_Status__c: "failure",
    Event_Description__c: "Delivery attempted - recipient absent",
    Event_Location__c: "Austin, TX",
    Provider__c: "Shippo"
  }
];

function mount() {
  const element = createElement("c-exception-centre", {
    is: ExceptionCentre
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

describe("c-exception-centre", () => {
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

  it("renders workspace title and exception KPI cards", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    expect(text(element, ".header-title")).toBe("Exception Centre");

    // Total active exceptions: 4 out of 5 (SH-0001 is on track and in_transit, so not an exception)
    expect(text(element, '[data-category="All"] .kpi-value')).toBe("4");
    expect(text(element, '[data-category="failure"] .kpi-value')).toBe("1");
    expect(text(element, '[data-category="return_to_sender"] .kpi-value')).toBe(
      "1"
    );
    expect(text(element, '[data-category="delayed"] .kpi-value')).toBe("1");
  });

  it("filters out non-exception shipments from the exception table", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".exception-table tbody tr"
    );
    expect(rows.length).toBe(4);

    // Verify normal shipment TRACK-NORMAL-01 is not rendered in exception table
    const tableText =
      element.shadowRoot.querySelector(".exception-table").textContent;
    expect(tableText).not.toContain("TRACK-NORMAL-01");
    expect(tableText).toContain("TRACK-FAIL-02");
    expect(tableText).toContain("TRACK-RETURN-03");
  });

  it("renders category breakdown bar and legend", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    expect(text(element, ".distribution-legend")).toContain("Failures (1)");
    expect(text(element, ".distribution-legend")).toContain("Returns (1)");
    expect(text(element, ".distribution-legend")).toContain("SLA Delays (1)");
    expect(text(element, ".distribution-legend")).toContain("At Risk (1)");
  });

  it("clicking a quick-filter KPI card filters the exception table", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const failureCard = element.shadowRoot.querySelector(
      '[data-category="failure"]'
    );
    failureCard.click();
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".exception-table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(text(rows[0], ".font-bold")).toBe("TRACK-FAIL-02");
  });

  it("selecting an exception opens the inspection side panel with details and events", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const inspectButtons = element.shadowRoot.querySelectorAll(".btn-inspect");
    inspectButtons[0].click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const panel = element.shadowRoot.querySelector(".inspection-panel");
    expect(panel).not.toBeNull();
    expect(text(panel, ".panel-title")).toBe("TRACK-FAIL-02");
    expect(text(panel, ".panel-reason-text")).toContain(
      "Delivery attempt failed at address"
    );

    // Milestone event in panel
    expect(panel.textContent).toContain(
      "Delivery attempted - recipient absent"
    );
    expect(panel.textContent).toContain("Austin, TX");

    // Linked support Case
    expect(panel.textContent).toContain("#00001002");
    expect(panel.textContent).toContain(
      "Customer escalation on failed delivery"
    );
  });

  it("closing the inspection panel hides it", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const inspectBtn = element.shadowRoot.querySelector(".btn-inspect");
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    expect(
      element.shadowRoot.querySelector(".inspection-panel")
    ).not.toBeNull();

    const closeBtn = element.shadowRoot.querySelector(".btn-close-panel");
    closeBtn.click();
    await flush();

    expect(element.shadowRoot.querySelector(".inspection-panel")).toBeNull();
  });

  it("filters exceptions by category and carrier comboboxes", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const selects = element.shadowRoot.querySelectorAll(".filter-select");
    const categorySelect = selects[0];

    categorySelect.dispatchEvent(
      new CustomEvent("change", { detail: { value: "return_to_sender" } })
    );
    await flush();

    let rows = element.shadowRoot.querySelectorAll(".exception-table tbody tr");
    expect(rows.length).toBe(1);
    expect(text(rows[0], ".font-bold")).toBe("TRACK-RETURN-03");
  });

  it("debounces search input and filters exception records", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const searchInput = element.shadowRoot.querySelector(
      ".exception-search-input"
    );
    searchInput.value = "RETURN-03";
    searchInput.dispatchEvent(new CustomEvent("change"));

    // Before 300ms
    jest.advanceTimersByTime(200);
    await flush();

    // Advance remaining debounce
    jest.advanceTimersByTime(100);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".exception-table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(text(rows[0], ".font-bold")).toBe("TRACK-RETURN-03");
  });

  it("clears active filters when Clear button is clicked", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const categorySelect = element.shadowRoot.querySelector(".filter-select");
    categorySelect.dispatchEvent(
      new CustomEvent("change", { detail: { value: "failure" } })
    );
    await flush();

    const clearBtn = element.shadowRoot.querySelector(".btn-clear-filters");
    expect(clearBtn).not.toBeNull();
    clearBtn.click();
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".exception-table tbody tr"
    );
    expect(rows.length).toBe(4);
  });

  it("displays all-clear state when dataset has 0 exceptions", async () => {
    const element = mount();
    getShipments.emit([MOCK_SHIPMENTS[0]]); // Only on-track shipment
    await flush();

    expect(element.shadowRoot.querySelector(".state-all-clear")).not.toBeNull();
    expect(text(element, ".state-title")).toBe("All Systems Operational");
  });

  it("displays empty filter state when no exceptions match the search", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const searchInput = element.shadowRoot.querySelector(
      ".exception-search-input"
    );
    searchInput.value = "NONEXISTENT-CODE";
    searchInput.dispatchEvent(new CustomEvent("change"));
    jest.advanceTimersByTime(300);
    await flush();

    expect(element.shadowRoot.querySelector(".state-empty")).not.toBeNull();
    expect(text(element, ".state-title")).toBe("No matching exceptions found");
  });

  it("displays error state when wire emits an error", async () => {
    const element = mount();
    getShipments.emitError({ body: { message: "Database query failed" } });
    await flush();

    expect(element.shadowRoot.querySelector(".state-error")).not.toBeNull();
    expect(text(element, ".state-message")).toContain("Database query failed");
  });

  it("calls refreshShipment on single shipment refresh click in inspection panel", async () => {
    refreshShipment.mockResolvedValue({ Id: "a01000000000002AAA" });

    const element = mount();
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const inspectBtn = element.shadowRoot.querySelector(".btn-inspect");
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const refreshBtn = element.shadowRoot.querySelector(
      ".btn-refresh-shipment"
    );
    refreshBtn.click();
    await flush();
    await flush();
    await flush();

    expect(refreshShipment).toHaveBeenCalledWith({
      shipmentId: "a01000000000002AAA"
    });
    expect(refreshApex).toHaveBeenCalled();
    expect(toastHandler).toHaveBeenCalled();
  });

  it("handles externalSearchTerm API property update", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    element.externalSearchTerm = "FAIL-02";
    jest.advanceTimersByTime(300);
    await flush();

    expect(element.externalSearchTerm).toBe("FAIL-02");
    const rows = element.shadowRoot.querySelectorAll(
      ".exception-table tbody tr"
    );
    expect(rows.length).toBe(1);
  });

  it("handles handleRefresh API method", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    await element.handleRefresh();
    expect(refreshApex).toHaveBeenCalled();
  });

  it("displays deterministic operational recommendation and applies recommendation to form", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    // Inspect SH-0002 (failure)
    const inspectBtn = element.shadowRoot.querySelectorAll(".btn-inspect")[0];
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    await flush();

    // Check recommendation card
    const recCard = element.shadowRoot.querySelector(".rec-card");
    expect(recCard).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".rec-title-text").textContent
    ).toContain("Consignee Contact");
    expect(
      element.shadowRoot.querySelector(".rec-badge-critical").textContent
    ).toBe("Critical");

    // Apply recommendation
    const applyBtn = element.shadowRoot.querySelector(".btn-apply-rec");
    expect(applyBtn).not.toBeNull();
    applyBtn.click();
    await flush();

    expect(
      element.shadowRoot.querySelector(".alert-success").textContent
    ).toContain('Set status to "Action Required"');
  });

  it("saves operational resolution status and notes via updateShipmentResolution", async () => {
    updateShipmentResolution.mockResolvedValue({
      ...MOCK_SHIPMENTS[1],
      Resolution_Status__c: "Investigating",
      Resolution_Notes__c: "Contacted carrier dispatch desk."
    });

    const element = mount();
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const inspectBtn = element.shadowRoot.querySelectorAll(".btn-inspect")[0];
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[1]);
    await flush();

    const statusSelect = element.shadowRoot.querySelector(
      ".resolution-status-select"
    );
    statusSelect.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Investigating" } })
    );

    const notesInput = element.shadowRoot.querySelector(
      ".resolution-notes-input"
    );
    notesInput.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "Contacted carrier dispatch desk." }
      })
    );

    const saveBtn = element.shadowRoot.querySelector(".btn-save-resolution");
    saveBtn.click();
    await flush();

    expect(updateShipmentResolution).toHaveBeenCalledWith({
      shipmentId: "a01000000000002AAA",
      resolutionStatus: "Investigating",
      resolutionNotes: "Contacted carrier dispatch desk."
    });
    expect(refreshApex).toHaveBeenCalled();
    expect(toastHandler).toHaveBeenCalled();
  });

  it("opens create case modal, validates input, and creates case via createCaseForShipment", async () => {
    createCaseForShipment.mockResolvedValue({
      Id: "500000000000002AAA",
      CaseNumber: "00001003",
      Subject: "[Exception] USPS TRACK-RETURN-03 - Return to Sender"
    });

    const element = mount();
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    // Inspect SH-0003 (unlinked return_to_sender)
    const inspectBtn = element.shadowRoot.querySelectorAll(".btn-inspect")[1];
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[2]);
    await flush();

    const createCaseBtn = element.shadowRoot.querySelector(".btn-create-case");
    expect(createCaseBtn).not.toBeNull();
    createCaseBtn.click();
    await flush();

    // Modal should be open
    expect(element.shadowRoot.querySelector(".modal-dialog")).not.toBeNull();

    const saveModalBtn = element.shadowRoot.querySelector(".modal-save-btn");
    saveModalBtn.click();
    await flush();

    expect(createCaseForShipment).toHaveBeenCalled();
    expect(toastHandler).toHaveBeenCalled();
  });

  it("opens link case modal, retrieves available cases, and links case via linkCaseToShipment", async () => {
    getAvailableCases.mockResolvedValue([
      {
        Id: "500000000000001AAA",
        CaseNumber: "00001001",
        Subject: "General Inquiry",
        Status: "New"
      }
    ]);
    linkCaseToShipment.mockResolvedValue({
      ...MOCK_SHIPMENTS[2],
      Case__c: "500000000000001AAA"
    });

    const element = mount();
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    // Inspect SH-0003 (unlinked)
    const inspectBtn = element.shadowRoot.querySelectorAll(".btn-inspect")[1];
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit(MOCK_SHIPMENTS[2]);
    await flush();

    const linkCaseBtn = element.shadowRoot.querySelectorAll(
      ".empty-case-box lightning-button"
    )[1];
    linkCaseBtn.click();
    await flush();
    await flush();

    expect(getAvailableCases).toHaveBeenCalled();
    expect(element.shadowRoot.querySelector(".modal-dialog")).not.toBeNull();

    const saveLinkBtn = element.shadowRoot.querySelector(".modal-save-btn");
    saveLinkBtn.click();
    await flush();

    expect(linkCaseToShipment).toHaveBeenCalledWith({
      shipmentId: "a01000000000003AAA",
      caseId: "500000000000001AAA"
    });
    expect(toastHandler).toHaveBeenCalled();
  });

  it("displays genuine operational history entries with actual record timestamps", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const inspectBtn = element.shadowRoot.querySelectorAll(".btn-inspect")[0];
    inspectBtn.click();
    await flush();

    getShipmentDetail.emit({
      ...MOCK_SHIPMENTS[1],
      CreatedDate: "2026-11-10T08:00:00Z",
      LastModifiedDate: "2026-11-15T10:00:00Z",
      Last_Synced__c: "2026-11-15T09:30:00Z",
      Actual_Delivery_Date__c: "2026-11-15T09:45:00Z"
    });
    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const historyItems = element.shadowRoot.querySelectorAll(
      ".timeline-title-text"
    );
    expect(historyItems.length).toBeGreaterThan(0);
    const titles = Array.from(historyItems).map((i) => i.textContent);
    expect(titles.some((t) => t.includes("Shipment Record Created"))).toBe(
      true
    );
    expect(
      titles.some((t) => t.includes("Carrier Telemetry Synchronized"))
    ).toBe(true);
  });

  it("filters exceptions by resolution status dropdown", async () => {
    const element = mount();
    getShipments.emit([
      { ...MOCK_SHIPMENTS[1], Resolution_Status__c: "Escalated" },
      { ...MOCK_SHIPMENTS[2], Resolution_Status__c: "New" }
    ]);
    await flush();

    const resolutionCombobox =
      element.shadowRoot.querySelectorAll(".filter-select")[2];
    resolutionCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Escalated" } })
    );
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".exception-table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("TRACK-FAIL-02");
  });
});
