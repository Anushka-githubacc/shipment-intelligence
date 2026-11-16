import { createElement } from "@lwc/engine-dom";
import CaseManagement from "c/caseManagement";
import getShipmentCases from "@salesforce/apex/ShipmentController.getShipmentCases";
import updateCase from "@salesforce/apex/ShipmentController.updateCase";
import assignCase from "@salesforce/apex/ShipmentController.assignCase";
import updateShipmentResolution from "@salesforce/apex/ShipmentController.updateShipmentResolution";
import getShipmentEvents from "@salesforce/apex/ShipmentController.getShipmentEvents";
import generateCustomerUpdate from "@salesforce/apex/ShipmentController.generateCustomerUpdate";
import { refreshApex } from "@salesforce/apex";

jest.mock(
  "@salesforce/user/Id",
  () => ({
    default: "005000000000001AAA"
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex",
  () => ({
    refreshApex: jest.fn(() => Promise.resolve())
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.getShipmentCases",
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
  "@salesforce/apex/ShipmentController.updateCase",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/ShipmentController.assignCase",
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
  "@salesforce/apex/ShipmentController.generateCustomerUpdate",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const MOCK_CASES = [
  {
    Id: "50000000001",
    CaseNumber: "00001001",
    Subject: "Delayed shipment investigation",
    Description: "Customer called inquiring about delayed consignment.",
    Status: "New",
    Priority: "High",
    Origin: "Phone",
    SuppliedEmail: "alice.web@example.com",
    Contact: {
      Name: "Alice Green",
      Email: "alice.green@example.com"
    },
    CreatedDate: "2026-11-15T10:00:00.000Z",
    LastModifiedDate: "2026-11-15T10:30:00.000Z",
    Shipments__r: [
      {
        Id: "a001",
        Name: "SH-001",
        Tracking_Code__c: "SHIPPO_TRANSIT",
        Carrier__c: "shippo",
        Status__c: "in_transit",
        Risk_Level__c: "At Risk",
        Risk_Reason__c: "Approaching 24h deadline",
        Estimated_Delivery_Date__c: "2026-11-20T12:00:00.000Z"
      }
    ]
  },
  {
    Id: "50000000002",
    CaseNumber: "00001002",
    Subject: "Delivered confirmation check",
    Description: "Proof of delivery requested.",
    Status: "Closed",
    Priority: "Low",
    Origin: "Email",
    SuppliedEmail: null,
    Contact: {
      Name: "Bob Smith",
      Email: "bob.smith@example.com"
    },
    CreatedDate: "2026-11-14T08:00:00.000Z",
    LastModifiedDate: "2026-11-15T09:00:00.000Z",
    Shipments__r: [
      {
        Id: "a002",
        Name: "SH-002",
        Tracking_Code__c: "SHIPPO_DELIVERED",
        Carrier__c: "shippo",
        Status__c: "delivered",
        Risk_Level__c: "On Track",
        Risk_Reason__c: "Delivered",
        Estimated_Delivery_Date__c: "2026-11-14T15:00:00.000Z"
      }
    ]
  },
  {
    Id: "50000000003",
    CaseNumber: "00001003",
    Subject: "Failed delivery attempt follow up",
    Description: "Carrier reported failure to deliver.",
    Status: "Working",
    Priority: "High",
    Origin: "Web",
    SuppliedEmail: null,
    Contact: null,
    CreatedDate: "2026-11-15T11:00:00.000Z",
    LastModifiedDate: "2026-11-15T11:45:00.000Z",
    Shipments__r: [
      {
        Id: "a003",
        Name: "SH-003",
        Tracking_Code__c: "SHIPPO_FAILURE",
        Carrier__c: "delhivery",
        Status__c: "failure",
        Risk_Level__c: "Delayed",
        Risk_Reason__c: "Delivery attempt failed",
        Estimated_Delivery_Date__c: "2026-11-15T18:00:00.000Z"
      }
    ]
  },
  {
    Id: "50000000004",
    CaseNumber: "00001004",
    Subject: "General shipment policy inquiry",
    Description: "Customer asking about holiday delivery windows.",
    Status: "New",
    Priority: "Medium",
    Origin: "Phone",
    CreatedDate: "2026-11-15T12:00:00.000Z",
    LastModifiedDate: "2026-11-15T12:10:00.000Z",
    Shipments__r: []
  }
];

const MOCK_EVENTS = [
  {
    Id: "evt001",
    Event_Status__c: "transit",
    Event_Date__c: "2026-11-15T09:00:00.000Z",
    Event_Location__c: "Austin, TX",
    Event_Description__c: "In transit to distribution hub"
  }
];

function mount() {
  const element = createElement("c-case-management", {
    is: CaseManagement
  });
  document.body.appendChild(element);
  return element;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("c-case-management", () => {
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

  it("renders KPI metrics correctly when cases load", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    expect(element.shadowRoot.querySelector("lightning-spinner")).toBeNull();

    // Total Cases: 4
    const totalCard = element.shadowRoot.querySelector('[data-quick="All"]');
    expect(totalCard.querySelector(".kpi-value").textContent).toBe("4");

    // Open Cases: 2 (Case 1 + Case 4)
    const openCard = element.shadowRoot.querySelector('[data-quick="open"]');
    expect(openCard.querySelector(".kpi-value").textContent).toBe("2");

    // In Progress: 1 (Case 3)
    const workingCard = element.shadowRoot.querySelector(
      '[data-quick="working"]'
    );
    expect(workingCard.querySelector(".kpi-value").textContent).toBe("1");

    // Closed: 1 (Case 2)
    const closedCard = element.shadowRoot.querySelector(
      '[data-quick="closed"]'
    );
    expect(closedCard.querySelector(".kpi-value").textContent).toBe("1");

    // High Priority: 2 (Case 1 + Case 3)
    const highCard = element.shadowRoot.querySelector('[data-quick="high"]');
    expect(highCard.querySelector(".kpi-value").textContent).toBe("2");
  });

  it("renders Case Explorer table with rows and initially does not select any case (table-only layout)", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const layout = element.shadowRoot.querySelector(".case-workspace-layout");
    expect(layout.classList.contains("table-only")).toBe(true);
    expect(layout.classList.contains("with-detail")).toBe(false);

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(4);

    // No row should be selected initially
    rows.forEach((row) => {
      expect(row.classList.contains("is-selected")).toBe(false);
    });

    // Inspection panel should not be rendered initially
    expect(element.shadowRoot.querySelector(".inspection-panel")).toBeNull();
  });

  it("selecting a Case row opens the panel and sets with-detail layout", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const layout = element.shadowRoot.querySelector(".case-workspace-layout");
    expect(layout.classList.contains("with-detail")).toBe(true);
    expect(rows[0].classList.contains("is-selected")).toBe(true);

    const panelTitle = element.shadowRoot.querySelector(".panel-title");
    expect(panelTitle).not.toBeNull();
    expect(panelTitle.textContent).toBe("00001001");

    const trackingCode = element.shadowRoot.querySelector(
      ".metric-val.text-cyan"
    );
    expect(trackingCode.textContent).toBe("SHIPPO_TRANSIT");
  });

  it("closing the inspection panel clears selection and restores table-only layout", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    expect(
      element.shadowRoot.querySelector(".inspection-panel")
    ).not.toBeNull();

    const closeBtn = element.shadowRoot.querySelector(".btn-close-panel");
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    await flush();

    const layout = element.shadowRoot.querySelector(".case-workspace-layout");
    expect(layout.classList.contains("table-only")).toBe(true);
    expect(element.shadowRoot.querySelector(".inspection-panel")).toBeNull();
    expect(rows[0].classList.contains("is-selected")).toBe(false);
  });

  it("renders milestone tracking events when available for selected case", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    getShipmentEvents.emit(MOCK_EVENTS);
    await flush();

    const timeline = element.shadowRoot.querySelectorAll(".timeline-entry");
    expect(timeline.length).toBe(1);
    expect(timeline[0].textContent).toContain("In transit to distribution hub");
  });

  it("handles case selection when another row is clicked", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    // Click Case 2 (00001002)
    rows[1].click();
    await flush();

    const panelTitle = element.shadowRoot.querySelector(".panel-title");
    expect(panelTitle.textContent).toBe("00001002");

    const trackingCode = element.shadowRoot.querySelector(
      ".metric-val.text-cyan"
    );
    expect(trackingCode.textContent).toBe("SHIPPO_DELIVERED");
  });

  it("handles a case with no linked shipments cleanly", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    // Click Case 4 (00001004 has no shipment)
    rows[3].click();
    await flush();

    expect(element.shadowRoot.querySelector(".no-shipment-box")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".no-shipment-box").textContent
    ).toContain("No shipment records are linked to this Case");
  });

  it("filters cases by search term input", async () => {
    jest.useFakeTimers();
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const searchInput = element.shadowRoot.querySelector(
      ".toolbar-search lightning-input"
    );
    searchInput.dispatchEvent(
      new CustomEvent("input", {
        detail: { value: "delhivery" }
      })
    );

    jest.advanceTimersByTime(350);
    await Promise.resolve();
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("00001003");

    jest.useRealTimers();
  });

  it("filters cases by status dropdown", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const statusCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[0];
    statusCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "closed" }
      })
    );
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("00001002");
  });

  it("filters cases by priority dropdown", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const priorityCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[1];
    priorityCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "high" }
      })
    );
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(2);
  });

  it("filters cases by origin dropdown", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const originCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[2];
    originCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "email" }
      })
    );
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("00001002");
  });

  it("toggles quick KPI filters on card click", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    // Click High Priority KPI card
    const highCard = element.shadowRoot.querySelector('[data-quick="high"]');
    highCard.click();
    await flush();

    let rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(2);

    // Click again to toggle off
    highCard.click();
    await flush();

    rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(4);
  });

  it("resets all active filters when Reset Filters button is clicked", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const statusCombobox =
      element.shadowRoot.querySelectorAll(".filter-combobox")[0];
    statusCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "closed" }
      })
    );
    await flush();

    expect(
      element.shadowRoot.querySelectorAll(".case-table tbody tr").length
    ).toBe(1);

    const resetBtn = element.shadowRoot.querySelector(".btn-reset");
    expect(resetBtn).not.toBeNull();
    resetBtn.click();
    await flush();

    expect(
      element.shadowRoot.querySelectorAll(".case-table tbody tr").length
    ).toBe(4);
  });

  it("updates case fields and confirms success only after Salesforce confirms", async () => {
    updateCase.mockResolvedValue({
      Id: "50000000001",
      CaseNumber: "00001001",
      Subject: "Updated Subject From Test",
      Status: "Working",
      Priority: "High",
      Description: "Updated Description From Test"
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const subjectInput = element.shadowRoot.querySelector(
      ".edit-form-grid lightning-input"
    );
    subjectInput.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "Updated Subject From Test" }
      })
    );

    const saveBtn = element.shadowRoot.querySelector(".btn-save");
    saveBtn.click();

    // Before promise resolution, no success message
    expect(element.shadowRoot.querySelector(".alert-success")).toBeNull();

    await flush();

    expect(updateCase).toHaveBeenCalledWith({
      caseId: "50000000001",
      status: "New",
      priority: "High",
      subject: "Updated Subject From Test",
      description: "Customer called inquiring about delayed consignment."
    });

    // Confirmed after promise resolution
    expect(element.shadowRoot.querySelector(".alert-success")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".alert-success").textContent
    ).toContain("Case 00001001 updated successfully");
    expect(refreshApex).toHaveBeenCalled();
  });

  it("cancels unsaved case edits and restores original values without calling updateCase", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const subjectInput = element.shadowRoot.querySelector(
      ".edit-form-grid lightning-input"
    );
    expect(subjectInput.value).toBe("Delayed shipment investigation");

    subjectInput.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "Temporary Changed Subject" }
      })
    );
    await flush();

    const buttons = element.shadowRoot.querySelectorAll(
      ".form-actions lightning-button"
    );
    const cancelBtn = Array.from(buttons).find((b) => b.label === "Cancel");
    expect(cancelBtn).not.toBeUndefined();
    cancelBtn.click();
    await flush();

    expect(updateCase).not.toHaveBeenCalled();
    const restoredInput = element.shadowRoot.querySelector(
      ".edit-form-grid lightning-input"
    );
    expect(restoredInput.value).toBe("Delayed shipment investigation");
  });

  it("handles case update error properly", async () => {
    updateCase.mockRejectedValue({
      body: { message: "Validation rule failed: Status invalid" }
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const saveBtn = element.shadowRoot.querySelector(".btn-save");
    saveBtn.click();
    await flush();

    expect(element.shadowRoot.querySelector(".alert-error")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".alert-error").textContent
    ).toContain("Validation rule failed");
  });

  it("displays filtered empty state when search matches 0 records", async () => {
    jest.useFakeTimers();
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const searchInput = element.shadowRoot.querySelector(
      ".toolbar-search lightning-input"
    );
    searchInput.dispatchEvent(
      new CustomEvent("input", {
        detail: { value: "NONEXISTENT_CASE" }
      })
    );

    jest.advanceTimersByTime(350);
    await Promise.resolve();
    await flush();

    expect(
      element.shadowRoot.querySelector(".empty-search-state")
    ).not.toBeNull();
    expect(element.shadowRoot.querySelector(".empty-title").textContent).toBe(
      "No Matching Cases Found"
    );

    jest.useRealTimers();
  });

  it("displays all-clear state when database has 0 cases", async () => {
    const element = mount();
    getShipmentCases.emit([]);
    await flush();

    expect(element.shadowRoot.querySelector(".all-clear-state")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".all-clear-title").textContent
    ).toBe("No Shipment Cases");
  });

  it("displays error banner when wire adapter emits error", async () => {
    const element = mount();
    getShipmentCases.emitError({
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
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    element.externalSearchTerm = "00001003";
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("00001003");
  });

  it("invokes refreshApex when handleRefresh() is called", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    await element.handleRefresh();
    expect(refreshApex).toHaveBeenCalled();
  });

  it("assigns case to current user via assignCase when Assign to Me button is clicked", async () => {
    assignCase.mockResolvedValue({
      Id: "50000000001",
      OwnerId: "005000000000001AAA",
      Owner: { Name: "Logistics Specialist" }
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const assignBtn = element.shadowRoot.querySelector(".btn-assign-me");
    expect(assignBtn).not.toBeNull();
    assignBtn.click();
    await flush();

    expect(assignCase).toHaveBeenCalledWith({
      caseId: "50000000001",
      newOwnerId: "005000000000001AAA"
    });
    expect(refreshApex).toHaveBeenCalled();
    expect(
      element.shadowRoot.querySelector(".alert-success").textContent
    ).toContain("Case assigned to Logistics Specialist successfully");
  });

  it("updates linked shipment operational resolution status and notes", async () => {
    updateShipmentResolution.mockResolvedValue({
      Id: "a001",
      Resolution_Status__c: "Action Required",
      Resolution_Notes__c: "Consignee contacted; reattempt booked."
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const statusCombobox = element.shadowRoot.querySelector(
      ".shipment-resolution-block lightning-combobox"
    );
    expect(statusCombobox).not.toBeNull();
    statusCombobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "Action Required" }
      })
    );

    const notesTextarea = element.shadowRoot.querySelector(
      ".shipment-resolution-block lightning-textarea"
    );
    expect(notesTextarea).not.toBeNull();
    notesTextarea.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "Consignee contacted; reattempt booked." }
      })
    );

    const updateBtn = element.shadowRoot.querySelector(
      ".res-action-btn lightning-button"
    );
    expect(updateBtn).not.toBeNull();
    updateBtn.click();
    await flush();

    expect(updateShipmentResolution).toHaveBeenCalledWith({
      shipmentId: "a001",
      resolutionStatus: "Action Required",
      resolutionNotes: "Consignee contacted; reattempt booked."
    });
    expect(
      element.shadowRoot.querySelector(".alert-success-small").textContent
    ).toContain("resolution updated successfully");
  });

  // --- Level 3 Customer Communication Tests ---

  it("renders Customer Communication initial state with Draft Customer Update button for linked shipment", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const commSection = element.shadowRoot.querySelector(
      ".customer-comm-section"
    );
    expect(commSection).not.toBeNull();
    const draftBtn = commSection.querySelector(".btn-draft-update");
    expect(draftBtn).not.toBeNull();
    expect(draftBtn.label).toBe("Draft Customer Update");
    expect(
      commSection.querySelector(".initial-comm-text").textContent
    ).toContain('Click "Draft Customer Update"');
  });

  it("renders unlinked notice when selected Case has no linked shipment", async () => {
    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    // Select Case 4 (index 3 in table)
    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[3].click();
    await flush();

    const commSection = element.shadowRoot.querySelector(
      ".customer-comm-section"
    );
    expect(commSection).not.toBeNull();
    expect(commSection.querySelector(".btn-draft-update")).toBeNull();
    expect(
      commSection.querySelector(".initial-comm-text").textContent
    ).toContain("Customer updates require a linked shipment");
  });

  it("generates customer update draft when Draft Customer Update button is clicked", async () => {
    generateCustomerUpdate.mockResolvedValue({
      subject: "Update regarding your shipment SHIPPO_TRANSIT",
      body: "Dear Alice Green,\n\nYour shipment (SHIPPO_TRANSIT) is in transit with Shippo.\n\nBest regards,\nCustomer Support Operations",
      recipientEmail: "alice.green@example.com",
      recipientName: "Alice Green",
      hasRecipientEmail: true
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const draftBtn = element.shadowRoot.querySelector(".btn-draft-update");
    draftBtn.click();
    await flush();

    expect(generateCustomerUpdate).toHaveBeenCalledWith({
      caseId: "50000000001"
    });

    // Verify Draft Container is displayed
    const draftContainer = element.shadowRoot.querySelector(
      ".customer-draft-container"
    );
    expect(draftContainer).not.toBeNull();

    // Verify Recipient Information
    expect(draftContainer.querySelector(".recipient-value").textContent).toBe(
      "Alice Green"
    );
    expect(
      draftContainer.querySelector(".recipient-email").textContent
    ).toContain("alice.green@example.com");
    expect(
      draftContainer.querySelector(".recipient-verified-note")
    ).not.toBeNull();

    // Verify Subject and Body Inputs
    const subjectInput = draftContainer.querySelector("lightning-input");
    expect(subjectInput.value).toBe(
      "Update regarding your shipment SHIPPO_TRANSIT"
    );

    const bodyTextarea = draftContainer.querySelector(".comm-textarea");
    expect(bodyTextarea.value).toContain("Dear Alice Green");
    expect(bodyTextarea.value).toContain("SHIPPO_TRANSIT");

    // Verify Open in Gmail button is enabled
    const gmailBtn = draftContainer.querySelector(".btn-open-gmail");
    expect(gmailBtn).not.toBeNull();
    expect(gmailBtn.disabled).toBe(false);
  });

  it("allows operator to edit subject and message draft in the form", async () => {
    generateCustomerUpdate.mockResolvedValue({
      subject: "Update regarding your shipment SHIPPO_TRANSIT",
      body: "Dear Alice Green,\n\nOriginal draft text.",
      recipientEmail: "alice.green@example.com",
      recipientName: "Alice Green",
      hasRecipientEmail: true
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const draftBtn = element.shadowRoot.querySelector(".btn-draft-update");
    draftBtn.click();
    await flush();

    const draftContainer = element.shadowRoot.querySelector(
      ".customer-draft-container"
    );
    const subjectInput = draftContainer.querySelector("lightning-input");
    subjectInput.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "Priority Urgent: Consignment Delayed" }
      })
    );

    const bodyTextarea = draftContainer.querySelector(".comm-textarea");
    bodyTextarea.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          value: "Dear Alice Green,\n\nEdited custom response by operator."
        }
      })
    );
    await flush();

    expect(subjectInput.value).toBe("Priority Urgent: Consignment Delayed");
    expect(bodyTextarea.value).toContain("Edited custom response by operator");
  });

  it("opens prefilled Gmail compose in new window when Open in Gmail button is clicked", async () => {
    generateCustomerUpdate.mockResolvedValue({
      subject: "Update regarding your shipment SHIPPO_TRANSIT",
      body: "Dear Alice Green,\n\nConsignment moving smoothly.",
      recipientEmail: "alice.green@example.com",
      recipientName: "Alice Green",
      hasRecipientEmail: true
    });

    const openSpy = jest.spyOn(window, "open").mockImplementation(() => {});

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const draftBtn = element.shadowRoot.querySelector(".btn-draft-update");
    draftBtn.click();
    await flush();

    const gmailBtn = element.shadowRoot.querySelector(".btn-open-gmail");
    gmailBtn.click();
    await flush();

    expect(openSpy).toHaveBeenCalled();
    const calledUrl = openSpy.mock.calls[0][0];
    const calledTarget = openSpy.mock.calls[0][1];
    const calledFeatures = openSpy.mock.calls[0][2];

    expect(calledUrl).toContain("https://mail.google.com/mail/?view=cm&fs=1");
    expect(calledUrl).toContain("to=alice.green%40example.com");
    expect(calledUrl).toContain(
      "su=Update%20regarding%20your%20shipment%20SHIPPO_TRANSIT"
    );
    expect(calledUrl).toContain(
      "body=" +
        encodeURIComponent("Dear Alice Green,\n\nConsignment moving smoothly.")
    );
    expect(calledTarget).toBe("_blank");
    expect(calledFeatures).toBe("noopener,noreferrer");

    openSpy.mockRestore();
  });

  it("disables Open in Gmail button and shows warning note when recipient email is missing", async () => {
    // Select Case 3 (index 2) which has no Contact or SuppliedEmail
    generateCustomerUpdate.mockResolvedValue({
      subject: "Update regarding your shipment SHIPPO_FAILURE",
      body: "Dear Valued Customer,\n\nDelivery attempt failed.",
      recipientEmail: null,
      recipientName: "Valued Customer",
      hasRecipientEmail: false
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[2].click();
    await flush();

    const draftBtn = element.shadowRoot.querySelector(".btn-draft-update");
    draftBtn.click();
    await flush();

    const draftContainer = element.shadowRoot.querySelector(
      ".customer-draft-container"
    );
    expect(draftContainer).not.toBeNull();

    // Verify warning note is rendered
    const warningNote = draftContainer.querySelector(".recipient-warning-note");
    expect(warningNote).not.toBeNull();
    expect(warningNote.textContent).toContain(
      "No customer email address found on this Case or Contact record"
    );

    // Verify Open in Gmail button is disabled
    const gmailBtn = draftContainer.querySelector(".btn-open-gmail");
    expect(gmailBtn.disabled).toBe(true);
  });

  it("renders error alert when generateCustomerUpdate throws error", async () => {
    generateCustomerUpdate.mockRejectedValue({
      body: { message: "Telemetry calculation error" }
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const draftBtn = element.shadowRoot.querySelector(".btn-draft-update");
    draftBtn.click();
    await flush();

    const errAlert = element.shadowRoot.querySelector(
      ".customer-comm-section .alert-error-small"
    );
    expect(errAlert).not.toBeNull();
    expect(errAlert.textContent).toContain("Telemetry calculation error");
  });

  it("clears draft and returns to initial state when Clear Draft button is clicked", async () => {
    generateCustomerUpdate.mockResolvedValue({
      subject: "Update regarding your shipment SHIPPO_TRANSIT",
      body: "Dear Alice Green,\n\nInitial message.",
      recipientEmail: "alice.green@example.com",
      recipientName: "Alice Green",
      hasRecipientEmail: true
    });

    const element = mount();
    getShipmentCases.emit(MOCK_CASES);
    await flush();

    const rows = element.shadowRoot.querySelectorAll(".case-table tbody tr");
    rows[0].click();
    await flush();

    const draftBtn = element.shadowRoot.querySelector(".btn-draft-update");
    draftBtn.click();
    await flush();

    expect(
      element.shadowRoot.querySelector(".customer-draft-container")
    ).not.toBeNull();

    // Click Clear Draft
    const clearBtn = element.shadowRoot.querySelector(".btn-clear-draft");
    expect(clearBtn).not.toBeNull();
    clearBtn.click();
    await flush();

    expect(
      element.shadowRoot.querySelector(".customer-draft-container")
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector(
        ".customer-comm-section .initial-comm-text"
      )
    ).not.toBeNull();
  });
});
