import { createElement } from "@lwc/engine-dom";
import AnalyticsReports from "c/analyticsReports";
import getShipments from "@salesforce/apex/ShipmentController.getShipments";
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

const MOCK_SHIPMENTS = [
  {
    Id: "a0010000001",
    Name: "SH-0001",
    Tracking_Code__c: "TRACK-DELIV-001",
    Carrier__c: "shippo",
    Status__c: "delivered",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Delivered successfully",
    Estimated_Delivery_Date__c: "2026-11-20T10:00:00.000Z",
    Last_Synced__c: "2026-11-20T11:00:00.000Z",
    Case__c: "50010000001",
    Case__r: { CaseNumber: "00001001" }
  },
  {
    Id: "a0010000002",
    Name: "SH-0002",
    Tracking_Code__c: "TRACK-TRANS-002",
    Carrier__c: "shippo",
    Status__c: "in_transit",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Within estimated delivery window",
    Estimated_Delivery_Date__c: "2026-11-22T14:00:00.000Z",
    Last_Synced__c: "2026-11-20T08:00:00.000Z"
  },
  {
    Id: "a0010000003",
    Name: "SH-0003",
    Tracking_Code__c: "TRACK-OUT-003",
    Carrier__c: "fedex",
    Status__c: "out_for_delivery",
    Risk_Level__c: "At Risk",
    Risk_Reason__c: "Approaching 24h deadline",
    Estimated_Delivery_Date__c: "2026-11-21T18:00:00.000Z",
    Last_Synced__c: "2026-11-20T09:00:00.000Z"
  },
  {
    Id: "a0010000004",
    Name: "SH-0004",
    Tracking_Code__c: "TRACK-PRE-004",
    Carrier__c: "fedex",
    Status__c: "pre_transit",
    Risk_Level__c: "On Track",
    Risk_Reason__c: "Package booked with carrier",
    Estimated_Delivery_Date__c: "2026-11-25T12:00:00.000Z",
    Last_Synced__c: "2026-11-20T06:00:00.000Z"
  },
  {
    Id: "a0010000005",
    Name: "SH-0005",
    Tracking_Code__c: "TRACK-FAIL-005",
    Carrier__c: "delhivery",
    Status__c: "failure",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Delivery attempt failed - customer unavailable",
    Estimated_Delivery_Date__c: "2026-11-19T10:00:00.000Z",
    Last_Synced__c: "2026-11-20T07:00:00.000Z"
  },
  {
    Id: "a0010000006",
    Name: "SH-0006",
    Tracking_Code__c: "TRACK-RET-006",
    Carrier__c: "ups",
    Status__c: "return_to_sender",
    Risk_Level__c: "Delayed",
    Risk_Reason__c: "Incorrect address - returning to sender",
    Estimated_Delivery_Date__c: "2026-11-18T10:00:00.000Z",
    Last_Synced__c: "2026-11-20T07:30:00.000Z"
  },
  {
    Id: "a0010000007",
    Name: "SH-0007",
    Tracking_Code__c: "TRACK-UNK-007",
    Carrier__c: "usps",
    Status__c: "unknown",
    Risk_Level__c: "At Risk",
    Risk_Reason__c: "Carrier status unknown",
    Estimated_Delivery_Date__c: null,
    Last_Synced__c: null
  }
];

function mount() {
  const element = createElement("c-analytics-reports", {
    is: AnalyticsReports
  });
  document.body.appendChild(element);
  return element;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("c-analytics-reports", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("renders loading spinner initially", () => {
    const element = mount();
    expect(
      element.shadowRoot.querySelector("lightning-spinner")
    ).not.toBeNull();
  });

  it("renders operational KPIs correctly once data is loaded", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    expect(element.shadowRoot.querySelector("lightning-spinner")).toBeNull();

    // Check KPI cards
    const cards = element.shadowRoot.querySelectorAll(".kpi-card");
    expect(cards.length).toBe(5);

    // Total: 7
    const totalCard = element.shadowRoot.querySelector('[data-quick="All"]');
    expect(totalCard.querySelector(".kpi-value").textContent).toBe("7");

    // Delivered: 1 (14%)
    const delivCard = element.shadowRoot.querySelector(
      '[data-quick="delivered"]'
    );
    expect(delivCard.querySelector(".kpi-value").textContent).toBe("1");
    expect(delivCard.querySelector(".kpi-pct").textContent).toBe("14%");

    // In Transit: 2 (in_transit + out_for_delivery) (29%)
    const transCard = element.shadowRoot.querySelector(
      '[data-quick="in_transit"]'
    );
    expect(transCard.querySelector(".kpi-value").textContent).toBe("2");
    expect(transCard.querySelector(".kpi-pct").textContent).toBe("29%");

    // Delayed: 2 (29%)
    const delayCard = element.shadowRoot.querySelector(
      '[data-quick="delayed"]'
    );
    expect(delayCard.querySelector(".kpi-value").textContent).toBe("2");
    expect(delayCard.querySelector(".kpi-pct").textContent).toBe("29%");
  });

  it("handles on-time delivery rate as N/A when actual timestamps are unavailable", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const ontimeCard = element.shadowRoot.querySelector(".kpi-ontime");
    expect(ontimeCard.querySelector(".kpi-value").textContent).toBe("N/A");
    expect(ontimeCard.querySelector(".tag-unavailable").textContent).toBe(
      "Telemetry Pending"
    );
    expect(ontimeCard.querySelector(".kpi-sub").textContent).toContain(
      "not recorded"
    );
  });

  it("calculates verified on-time delivery rate when actual timestamps exist", async () => {
    const customShipments = [
      {
        Id: "a001",
        Name: "SH-01",
        Carrier__c: "shippo",
        Status__c: "delivered",
        Risk_Level__c: "On Track",
        Estimated_Delivery_Date__c: "2026-11-20T12:00:00.000Z",
        Actual_Delivery_Date__c: "2026-11-20T10:00:00.000Z"
      },
      {
        Id: "a002",
        Name: "SH-02",
        Carrier__c: "shippo",
        Status__c: "delivered",
        Risk_Level__c: "Delayed",
        Estimated_Delivery_Date__c: "2026-11-19T12:00:00.000Z",
        Actual_Delivery_Date__c: "2026-11-20T10:00:00.000Z"
      }
    ];

    const element = mount();
    getShipments.emit(customShipments);
    await flush();

    const ontimeCard = element.shadowRoot.querySelector(".kpi-ontime");
    expect(ontimeCard.querySelector(".kpi-value").textContent).toBe("50%");
    expect(ontimeCard.querySelector(".tag-verified").textContent).toBe(
      "Verified"
    );
  });

  it("renders Status Distribution with all fulfillment categories", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const statusCard = element.shadowRoot.querySelector(".status-card");
    expect(statusCard).not.toBeNull();

    const rows = statusCard.querySelectorAll(".dist-row");
    expect(rows.length).toBe(7); // delivered, in_transit, out_for_delivery, pre_transit, failure, return_to_sender, unknown
  });

  it("renders Risk Distribution with segmented bar and pillar counts", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const riskCard = element.shadowRoot.querySelector(".risk-card");
    expect(riskCard).not.toBeNull();

    // 3 on track, 2 at risk, 2 delayed
    expect(
      riskCard.querySelector(".pillar-on-track .pillar-value").textContent
    ).toBe("3");
    expect(
      riskCard.querySelector(".pillar-at-risk .pillar-value").textContent
    ).toBe("2");
    expect(
      riskCard.querySelector(".pillar-delayed .pillar-value").textContent
    ).toBe("2");
  });

  it("renders Carrier Performance Benchmarks with proper metrics and tiers", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const carrierCard = element.shadowRoot.querySelector(".carrier-card");
    expect(carrierCard).not.toBeNull();

    const rows = carrierCard.querySelectorAll("tbody tr");
    expect(rows.length).toBe(5); // shippo, fedex, delhivery, ups, usps
  });

  it("renders Delivery Trend Timeline and notes unscheduled shipments", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const trendCard = element.shadowRoot.querySelector(".trend-card");
    expect(trendCard).not.toBeNull();

    const trendItems = trendCard.querySelectorAll(".trend-item");
    expect(trendItems.length).toBe(6); // 6 distinct dates: Nov 18, 19, 20, 21, 22, 25

    const unscheduled = trendCard.querySelector(".unscheduled-note");
    expect(unscheduled).not.toBeNull();
    expect(unscheduled.textContent).toContain(
      "1 active consignments have no carrier-reported ETA"
    );
  });

  it("filters table and metrics when local search input is provided", async () => {
    jest.useFakeTimers();
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const searchInput = element.shadowRoot.querySelector(
      ".toolbar-search lightning-input"
    );
    searchInput.dispatchEvent(
      new CustomEvent("input", {
        detail: { value: "fedex" }
      })
    );

    // Fast forward debounce timer
    jest.advanceTimersByTime(350);
    await Promise.resolve();
    await flush();

    const tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    expect(tableRows.length).toBe(2);

    jest.useRealTimers();
  });

  it("filters shipments by carrier dropdown", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const carrierCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[0];
    carrierCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "delhivery" }
      })
    );
    await flush();

    const tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    expect(tableRows.length).toBe(1);
    expect(tableRows[0].textContent).toContain("TRACK-FAIL-005");
  });

  it("filters shipments by status dropdown", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const statusCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[1];
    statusCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "return_to_sender" }
      })
    );
    await flush();

    const tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    expect(tableRows.length).toBe(1);
    expect(tableRows[0].textContent).toContain("TRACK-RET-006");
  });

  it("filters shipments by ETA date range", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const dateInputs = element.shadowRoot.querySelectorAll(".date-input");
    // From 2026-11-21 to 2026-11-23
    dateInputs[0].dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "2026-11-21" }
      })
    );
    dateInputs[1].dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "2026-11-23" }
      })
    );
    await flush();

    const tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    // SH-0002 (Nov 22) and SH-0003 (Nov 21)
    expect(tableRows.length).toBe(2);
  });

  it("applies quick filter when clicking KPI card and toggles off on second click", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    // Click Delivered KPI card
    const delivCard = element.shadowRoot.querySelector(
      '[data-quick="delivered"]'
    );
    delivCard.click();
    await flush();

    let tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    expect(tableRows.length).toBe(1);

    // Click again to toggle off
    delivCard.click();
    await flush();

    tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    expect(tableRows.length).toBe(7);
  });

  it("resets all active filters when Reset Filters button is clicked", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const statusCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[1];
    statusCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "failure" }
      })
    );
    await flush();

    expect(
      element.shadowRoot.querySelectorAll(".analytics-table tbody tr").length
    ).toBe(1);

    const resetBtn = element.shadowRoot.querySelector(".btn-reset");
    expect(resetBtn).not.toBeNull();
    resetBtn.click();
    await flush();

    expect(
      element.shadowRoot.querySelectorAll(".analytics-table tbody tr").length
    ).toBe(7);
  });

  it("sorts table columns when table header is clicked", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const refHeader = element.shadowRoot.querySelector('th[data-field="Name"]');
    // First click sorts desc (since default was asc)
    refHeader.click();
    await flush();

    let firstRow = element.shadowRoot.querySelector(
      ".analytics-table tbody tr"
    );
    expect(firstRow.textContent).toContain("SH-0007");

    // Second click sorts asc
    refHeader.click();
    await flush();

    firstRow = element.shadowRoot.querySelector(".analytics-table tbody tr");
    expect(firstRow.textContent).toContain("SH-0001");
  });

  it("shows filtered empty state when search matches zero records", async () => {
    jest.useFakeTimers();
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    const searchInput = element.shadowRoot.querySelector(
      ".toolbar-search lightning-input"
    );
    searchInput.dispatchEvent(
      new CustomEvent("input", {
        detail: { value: "NONEXISTENT_SHIPMENT" }
      })
    );

    jest.advanceTimersByTime(350);
    await Promise.resolve();
    await flush();

    expect(
      element.shadowRoot.querySelector(".empty-search-state")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector(".empty-title").textContent).toBe(
      "No Shipments Found"
    );

    jest.useRealTimers();
  });

  it("shows all-clear state when database has zero shipments", async () => {
    const element = mount();
    getShipments.emit([]);
    await flush();

    expect(element.shadowRoot.querySelector(".all-clear-state")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".all-clear-title").textContent
    ).toBe("No Records in System");
  });

  it("displays error banner when wire adapter emits an error", async () => {
    const element = mount();
    getShipments.emitError({
      body: { message: "Internal Apex SOQL Error" }
    });
    await flush();

    expect(element.shadowRoot.querySelector(".error-banner")).not.toBeNull();
    expect(element.shadowRoot.querySelector(".error-desc").textContent).toBe(
      "Internal Apex SOQL Error"
    );
  });

  it("updates search filter when externalSearchTerm @api property changes", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    element.externalSearchTerm = "TRACK-FAIL-005";
    await flush();

    const tableRows = element.shadowRoot.querySelectorAll(
      ".analytics-table tbody tr"
    );
    expect(tableRows.length).toBe(1);
    expect(tableRows[0].textContent).toContain("TRACK-FAIL-005");
  });

  it("invokes refreshApex when handleRefresh() is called", async () => {
    const element = mount();
    getShipments.emit(MOCK_SHIPMENTS);
    await flush();

    await element.handleRefresh();
    expect(refreshApex).toHaveBeenCalled();
  });
});
