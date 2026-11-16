import { LightningElement } from "lwc";

const WORKSPACES = [
  {
    id: "control-tower",
    label: "Control Tower",
    icon: "utility:dashboard",
    description:
      "Operational health, risk distribution, and the selected shipment journey."
  },
  {
    id: "shipment-intelligence",
    label: "Shipment Intelligence",
    icon: "utility:transit_shipment",
    description:
      "Shipment investigation, journey progress, and recorded tracking events."
  },
  {
    id: "risk-intelligence",
    label: "Risk Intelligence",
    icon: "utility:shield",
    description:
      "Rule-based delay risk, severity, and the reason each shipment needs attention."
  },
  {
    id: "exception-centre",
    label: "Exception Centre",
    icon: "utility:error",
    description:
      "Failed, returned, delayed, and at-risk shipments with a human resolution workflow."
  },
  {
    id: "analytics-reports",
    label: "Analytics & Reports",
    icon: "utility:analytics",
    description:
      "Status, risk, and carrier measures from stored shipment records."
  },
  {
    id: "case-management",
    label: "Case Management",
    icon: "utility:case",
    description:
      "Case ownership, linked shipment context, and reviewed customer drafts."
  }
];

export default class LogisticsAppShell extends LightningElement {
  activeWorkspaceId = "control-tower";
  isSidebarCollapsed = false;
  isMobileNavOpen = false;

  globalSearchInput = "";
  globalSearchTerm = "";
  searchDebounceTimeout = null;

  disconnectedCallback() {
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
      this.searchDebounceTimeout = null;
    }
  }

  get isControlTowerActive() {
    return this.activeWorkspaceId === "control-tower";
  }

  get isShipmentIntelligenceActive() {
    return this.activeWorkspaceId === "shipment-intelligence";
  }

  get isRiskIntelligenceActive() {
    return this.activeWorkspaceId === "risk-intelligence";
  }

  get isExceptionCentreActive() {
    return this.activeWorkspaceId === "exception-centre";
  }

  get isAnalyticsReportsActive() {
    return this.activeWorkspaceId === "analytics-reports";
  }

  get isCaseManagementActive() {
    return this.activeWorkspaceId === "case-management";
  }

  get currentWorkspace() {
    return (
      WORKSPACES.find((ws) => ws.id === this.activeWorkspaceId) || WORKSPACES[0]
    );
  }

  get shellContainerClass() {
    const classes = ["app-shell"];
    if (this.isSidebarCollapsed) {
      classes.push("is-collapsed");
    }
    if (this.isMobileNavOpen) {
      classes.push("is-mobile-open");
    }
    return classes.join(" ");
  }

  get sidebarClass() {
    return this.isSidebarCollapsed ? "sidebar collapsed" : "sidebar";
  }

  get collapseToggleLabel() {
    return this.isSidebarCollapsed
      ? "Expand application sidebar"
      : "Collapse application sidebar";
  }

  get collapseActionText() {
    return this.isSidebarCollapsed ? "" : "Collapse navigation";
  }

  get collapseIcon() {
    return this.isSidebarCollapsed
      ? "utility:chevronright"
      : "utility:chevronleft";
  }

  get workspaces() {
    return WORKSPACES.map((ws) => {
      const isSelected = ws.id === this.activeWorkspaceId;
      const buttonClass = ["nav-item"];
      if (isSelected) {
        buttonClass.push("is-active");
      }
      return {
        ...ws,
        isSelected,
        buttonClass: buttonClass.join(" "),
        ariaCurrent: isSelected ? "page" : undefined,
        iconClass: isSelected ? "icon-active" : "icon-muted"
      };
    });
  }

  handleNavClick(event) {
    const targetId = event.currentTarget.dataset.workspace;
    if (targetId && targetId !== this.activeWorkspaceId) {
      this.activeWorkspaceId = targetId;
    }
    this.isMobileNavOpen = false;
  }

  handleToggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  handleToggleMobileNav() {
    this.isMobileNavOpen = !this.isMobileNavOpen;
  }

  handleCloseMobileNav() {
    this.isMobileNavOpen = false;
  }

  handleGlobalSearchChange(event) {
    const rawValue = event.detail.value ? event.detail.value.trim() : "";
    this.globalSearchInput = event.detail.value || "";

    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.searchDebounceTimeout = setTimeout(() => {
      this.globalSearchTerm = rawValue;
      this.searchDebounceTimeout = null;
    }, 300);
  }

  handleGlobalRefresh() {
    const dashboard = this.template.querySelector("c-shipment-dashboard");
    if (dashboard && typeof dashboard.refresh === "function") {
      dashboard.refresh();
      return;
    }
    const intelligence = this.template.querySelector("c-shipment-intelligence");
    if (intelligence && typeof intelligence.handleRefresh === "function") {
      intelligence.handleRefresh();
      return;
    }
    const risk = this.template.querySelector("c-risk-intelligence");
    if (risk && typeof risk.handleRefresh === "function") {
      risk.handleRefresh();
      return;
    }
    const exceptionCentre = this.template.querySelector("c-exception-centre");
    if (
      exceptionCentre &&
      typeof exceptionCentre.handleRefresh === "function"
    ) {
      exceptionCentre.handleRefresh();
      return;
    }
    const analytics = this.template.querySelector("c-analytics-reports");
    if (analytics && typeof analytics.handleRefresh === "function") {
      analytics.handleRefresh();
      return;
    }
    const caseMgmt = this.template.querySelector("c-case-management");
    if (caseMgmt && typeof caseMgmt.handleRefresh === "function") {
      caseMgmt.handleRefresh();
    }
  }
}
