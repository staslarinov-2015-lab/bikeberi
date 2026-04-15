const state = {
  user: null,
  activeSection: "overview",
  search: "",
  statusFilter: "all",
  dashboardPeriod: "today",
  dashboardExpanded: "repair",
  kpi: {
    totalBikes: 0,
    targetRate: 95,
    mechanicFocus: "оперативка",
  },
  repairs: [],
  inventory: [],
  diagnostics: [],
  bikes: [],
  workOrders: [],
  issueChecklist: {
    bike: "",
    checked: {},
    completedAt: "",
  },
  repairDraftFromDiagnostic: null,
  diagnosticFlow: {
    mode: "create",
    category: "",
    zone: "",
    fault: "",
  },
};

const repairDeadlineNotifications = new Set();
const repairAlerts = document.createElement("div");
repairAlerts.className = "repair-alerts";
document.body.appendChild(repairAlerts);

const DIAGNOSTIC_LIBRARY = {
  "Пластик": {
    summary: "Обвес, крышки, внешние элементы корпуса",
    zones: [
      "Дека для ног",
      "Корпус слева",
      "Корпус справа",
      "Рулевая колонка",
      "Сиденье",
      "Место под АКБ",
    ],
    damageTypes: [
      "Трещина",
      "Скол",
      "Полностью сломано",
      "Отсутствует деталь",
    ],
  },
  "Руль и управление": {
    summary: "Рулевая, ручки, рычаги, органы управления",
    faults: [
      "Люфт рулевой",
      "Руль стоит криво",
      "Тугой поворот руля",
      "Не работает ручка газа",
      "Заедает ручка газа",
      "Поврежден рычаг тормоза",
      "Не работает кнопка включения",
      "Люфт ручек",
      "Повреждена ручка",
    ],
  },
  "Тормоза": {
    summary: "Передний и задний контур торможения",
    faults: [
      "Скрип тормоза",
      "Стерты колодки",
      "Кривой тормозной диск",
      "Не тормозит передний тормоз",
      "Не тормозит задний тормоз",
      "Закис суппорт",
      "Диск трет",
      "Не возвращается ручка тормоза",
    ],
  },
  "Колеса и шины": {
    summary: "Покрышки, камеры, подшипники, диски",
    faults: [
      "Прокол",
      "Спускает колесо",
      "Изношена покрышка",
      "Боковой порез",
      "Деформация диска",
      "Люфт колеса",
      "Биение колеса",
      "Поврежден ниппель",
      "Проблема с подшипником",
    ],
  },
  "Мотор": {
    summary: "Тяга, шум, вибрации, поведение привода",
    faults: [
      "Не тянет мотор",
      "Рывки при разгоне",
      "Посторонний шум мотора",
      "Мотор не включается",
      "Перегрев мотора",
      "Ошибка по мотору",
      "Повышенная вибрация",
    ],
  },
  "Батарея": {
    summary: "Батарея, зарядка, фиксация и контакты",
    faults: [
      "Батарея не заряжается",
      "Быстро теряет заряд",
      "Батарея не фиксируется",
      "Батарея не определяется",
      "Ошибка BMS",
      "Перегрев батареи",
      "Зарядный порт поврежден",
      "Не работает зарядное устройство",
      "Окисление контактов батареи",
      "Просадка напряжения",
    ],
  },
  "Электрика": {
    summary: "Контроллер, проводка, кнопки, питание",
    faults: [
      "Не включается байк",
      "Ошибка контроллера",
      "Пропадает питание",
      "Повреждена проводка",
      "Окисление разъемов",
      "Замыкание",
      "Нестабильная работа",
      "Ошибка датчиков",
      "Не работает панель управления",
    ],
  },
  "Свет": {
    summary: "Фара, задний фонарь, стоп-сигнал, сигнал",
    faults: [
      "Не работает передняя фара",
      "Не работает задний фонарь",
      "Не работает стоп-сигнал",
      "Не работает сигнал",
      "Мигает свет",
      "Плохой контакт по освещению",
    ],
  },
};

const BIKE_CODE_ALLOWED_LETTERS = ["P", "E", "Y"];
const BIKE_CODE_ALLOWED_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const BIKE_CODE_NORMALIZE_MAP = {
  Р: "P",
  P: "P",
  Е: "E",
  E: "E",
  У: "Y",
  Y: "Y",
};

const ISSUE_CHECKLIST_STORAGE_KEY = "bikeberi.issueChecklist.v1";
const ISSUE_CHECKLIST = [
  {
    title: "Техническое состояние",
    items: [
      "Нет люфтов (руль / колёса)",
      "Тормоза работают чётко",
      "Нет посторонних звуков",
      "Амортизаторы исправны",
      "Проведён тест-райд",
    ],
  },
  {
    title: "АКБ и электроника",
    items: [
      "АКБ ≥ 80%",
      "Экран работает без ошибок",
    ],
  },
  {
    title: "Чистота и внешний вид",
    items: [
      "Байк полностью чистый",
      "Экран чистый",
      "Резина обработана чернителем",
    ],
  },
  {
    title: "Брендинг",
    items: [
      "Оклейка соответствует стандарту",
      "Нет пузырей и складок",
    ],
  },
  {
    title: "Финальный контроль",
    items: [
      "Байк готов к выдаче",
    ],
  },
];

const loginOverlay = document.getElementById("login-overlay");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const mobileNavOverlay = document.getElementById("mobile-nav-overlay");
const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
const pageTitle = document.getElementById("page-title");
const heroTitle = document.getElementById("hero-title");
const heroCopy = document.getElementById("hero-copy");
const heroBadge = document.getElementById("hero-badge");
const globalSearch = document.getElementById("global-search");
const statusFilter = document.getElementById("status-filter");
const metricsGrid = document.getElementById("metrics-grid");
const timeline = document.getElementById("timeline");
const alertsList = document.getElementById("alerts-list");
const repairsTable = document.getElementById("repairs-table");
const diagnosticsTable = document.getElementById("diagnostics-table");
const diagnosticCategoryGrid = document.getElementById("diagnostic-category-grid");
const inventoryGrid = document.getElementById("inventory-grid");
const bikesGrid = document.getElementById("bikes-grid");
const workOrdersBoard = document.getElementById("work-orders-board");
const activeRepairBoard = document.getElementById("active-repair-board");
const issueChecklistForm = document.getElementById("issue-checklist-form");
const issueChecklistGroups = document.getElementById("issue-checklist-groups");
const issueChecklistBike = document.getElementById("issue-checklist-bike");
const issueChecklistProgressText = document.getElementById("issue-checklist-progress-text");
const issueChecklistProgressPercent = document.getElementById("issue-checklist-progress-percent");
const issueChecklistProgressBar = document.getElementById("issue-checklist-progress-bar");
const issueChecklistStatus = document.getElementById("issue-checklist-status");
const issueChecklistCompletedAt = document.getElementById("issue-checklist-completed-at");
const resetIssueChecklistButton = document.getElementById("reset-issue-checklist");
const printIssueChecklistButton = document.getElementById("print-issue-checklist");
const repairForm = document.getElementById("repair-form");
const inventoryForm = document.getElementById("inventory-form");
const bikeForm = document.getElementById("bike-form");
const diagnosticForm = document.getElementById("diagnostic-form");
const ownerKpi = document.getElementById("owner-kpi");
const ownerKpiNote = document.getElementById("owner-kpi-note");
const ownerProcurement = document.getElementById("owner-procurement");
const ownerProcess = document.getElementById("owner-process");
const currentUser = document.getElementById("current-user");
const sidebarRoleTitle = document.getElementById("sidebar-role-title");
const accountButton = document.getElementById("account-button");
const accountOverlay = document.getElementById("account-overlay");
const closeAccountButton = document.getElementById("close-account-button");
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");
const passwordError = document.getElementById("password-error");
const settingsForm = document.getElementById("settings-form");
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const profileNameDisplay = document.getElementById("profile-name-display");
const profileRoleDisplay = document.getElementById("profile-role-display");
const profilePhoneDisplay = document.getElementById("profile-phone-display");
const profileTelegramDisplay = document.getElementById("profile-telegram-display");
const profilePositionDisplay = document.getElementById("profile-position-display");
const profileAvatar = document.getElementById("profile-avatar");
const logoutButton = document.getElementById("logout-button");
const repairOverlay = document.getElementById("repair-overlay");
const inventoryOverlay = document.getElementById("inventory-overlay");
const bikeOverlay = document.getElementById("bike-overlay");
const openRepairModalButton = document.getElementById("open-repair-modal");
const closeRepairModalButton = document.getElementById("close-repair-modal");
const openInventoryModalButton = document.getElementById("open-inventory-modal");
const closeInventoryModalButton = document.getElementById("close-inventory-modal");
const openBikeModalButton = document.getElementById("open-bike-modal");
const closeBikeModalButton = document.getElementById("close-bike-modal");
const bikeModalTitle = document.getElementById("bike-modal-title");
const diagnosticOverlay = document.getElementById("diagnostic-overlay");
const openDiagnosticModalButton = document.getElementById("open-diagnostic-modal");
const closeDiagnosticModalButton = document.getElementById("close-diagnostic-modal");
const diagnosticModalTitle = document.getElementById("diagnostic-modal-title");
const workOrderOverlay = document.getElementById("work-order-overlay");
const closeWorkOrderModalButton = document.getElementById("close-work-order-modal");
const workOrderModalTitle = document.getElementById("work-order-modal-title");
const workOrderDetailBike = document.getElementById("work-order-detail-bike");
const workOrderDetailStatus = document.getElementById("work-order-detail-status");
const workOrderDetailFault = document.getElementById("work-order-detail-fault");
const workOrderDetailParts = document.getElementById("work-order-detail-parts");
const workOrderDetailPartsStatus = document.getElementById("work-order-detail-parts-status");
const workOrderDetailDate = document.getElementById("work-order-detail-date");
const workOrderDetailMinutes = document.getElementById("work-order-detail-minutes");
const workOrderDetailHint = document.getElementById("work-order-detail-hint");
const diagnosticWizardCategoryGrid = document.getElementById("diagnostic-wizard-category-grid");
const diagnosticFaultGrid = document.getElementById("diagnostic-fault-grid");
const diagnosticFaultsTitle = document.getElementById("diagnostic-faults-title");
const diagnosticSelectedCategory = document.getElementById("diagnostic-selected-category");
const diagnosticSelectedFault = document.getElementById("diagnostic-selected-fault");
const diagnosticBackToCategories = document.getElementById("diagnostic-back-to-categories");
const diagnosticBackToFaults = document.getElementById("diagnostic-back-to-faults");
const diagnosticStepCategories = document.getElementById("diagnostic-step-categories");
const diagnosticStepFaults = document.getElementById("diagnostic-step-faults");
const diagnosticStepDetails = document.getElementById("diagnostic-step-details");
const diagnosticStepViewCategories = document.getElementById("diagnostic-step-view-categories");
const diagnosticStepViewFaults = document.getElementById("diagnostic-step-view-faults");
const refreshButton = document.getElementById("refresh-button");
const bikeCodeBuilders = Array.from(document.querySelectorAll("[data-bike-code-root]"));

function normalizeBikeCode(rawValue) {
  const source = String(rawValue || "").trim().toUpperCase();
  if (!source) return "";
  const normalizedChars = source
    .split("")
    .map((char) => BIKE_CODE_NORMALIZE_MAP[char] || char);
  const pattern = ["letter", "letter", "digit", "digit", "digit", "letter"];
  const result = [];

  normalizedChars.forEach((char) => {
    if (result.length >= pattern.length) return;
    const expected = pattern[result.length];
    const isLetter = BIKE_CODE_ALLOWED_LETTERS.includes(char);
    const isDigit = BIKE_CODE_ALLOWED_DIGITS.includes(char);
    if ((expected === "letter" && isLetter) || (expected === "digit" && isDigit)) {
      result.push(char);
    }
  });

  return result.join("");
}

function isValidBikeCode(rawValue) {
  const normalized = normalizeBikeCode(rawValue);
  return /^[PEY]{2}\d{3}[PEY]$/.test(normalized);
}

function getBikeBuilder(rootName) {
  return document.querySelector(`[data-bike-code-root="${rootName}"]`);
}

function updateBikeCodeHiddenInput(rootName) {
  const builder = getBikeBuilder(rootName);
  if (!builder) return "";
  const visibleInput = builder.querySelector("[data-bike-code-input]");
  const hiddenInput = builder.parentElement.querySelector('input[name="bike"]');
  const bikeCode = normalizeBikeCode(visibleInput ? visibleInput.value : "");
  const complete = bikeCode.length === 6;
  const valid = complete && isValidBikeCode(bikeCode);
  if (visibleInput) {
    visibleInput.value = bikeCode;
    const shouldShowError = Boolean(bikeCode) && ((visibleInput.dataset.touched === "true" && !valid) || (complete && !valid));
    builder.classList.toggle("is-invalid", shouldShowError);
  }
  if (hiddenInput) {
    hiddenInput.value = complete ? bikeCode : "";
    hiddenInput.setCustomValidity(valid ? "" : "Укажи номер байка в формате РЕ123У");
  }
  return complete ? bikeCode : "";
}

function setBikeCodeValue(rootName, value) {
  const builder = getBikeBuilder(rootName);
  if (!builder) return;
  const normalized = normalizeBikeCode(value);
  const visibleInput = builder.querySelector("[data-bike-code-input]");
  if (visibleInput) {
    visibleInput.value = normalized;
  }
  updateBikeCodeHiddenInput(rootName);
}

function resetBikeCodeValue(rootName) {
  setBikeCodeValue(rootName, "");
}

function syncBikeCodeBuilders() {
  bikeCodeBuilders.forEach((builder) => {
    const rootName = builder.dataset.bikeCodeRoot;
    const visibleInput = builder.querySelector("[data-bike-code-input]");
    if (visibleInput) {
      visibleInput.addEventListener("input", () => {
        updateBikeCodeHiddenInput(rootName);
      });
      visibleInput.addEventListener("blur", () => {
        visibleInput.dataset.touched = "true";
        updateBikeCodeHiddenInput(rootName);
      });
    }
    updateBikeCodeHiddenInput(rootName);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getIssueChecklistItems() {
  return ISSUE_CHECKLIST.flatMap((group, groupIndex) =>
    group.items.map((label, itemIndex) => ({
      id: `${groupIndex}-${itemIndex}`,
      group: group.title,
      label,
    }))
  );
}

function loadIssueChecklistDraft() {
  try {
    const rawDraft = window.localStorage.getItem(ISSUE_CHECKLIST_STORAGE_KEY);
    if (!rawDraft) return;
    const parsed = JSON.parse(rawDraft);
    state.issueChecklist = {
      bike: String(parsed.bike || ""),
      checked: typeof parsed.checked === "object" && parsed.checked ? parsed.checked : {},
      completedAt: String(parsed.completedAt || ""),
    };
  } catch (error) {
    state.issueChecklist = {
      bike: "",
      checked: {},
      completedAt: "",
    };
  }
}

function saveIssueChecklistDraft() {
  try {
    window.localStorage.setItem(ISSUE_CHECKLIST_STORAGE_KEY, JSON.stringify(state.issueChecklist));
  } catch (error) {
    // Local draft saving is best-effort; the checklist remains usable without storage.
  }
}

function resetIssueChecklistDraft() {
  state.issueChecklist = {
    bike: "",
    checked: {},
    completedAt: "",
  };
  saveIssueChecklistDraft();
  renderIssueChecklist();
}

function renderIssueChecklist() {
  if (!issueChecklistGroups) return;

  const items = getIssueChecklistItems();
  const checkedCount = items.filter((item) => Boolean(state.issueChecklist.checked[item.id])).length;
  const totalCount = items.length;
  const percent = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isComplete = totalCount > 0 && checkedCount === totalCount;

  if (issueChecklistBike) {
    issueChecklistBike.value = state.issueChecklist.bike || "";
  }
  if (issueChecklistProgressText) {
    issueChecklistProgressText.textContent = `${checkedCount} из ${totalCount}`;
  }
  if (issueChecklistProgressPercent) {
    issueChecklistProgressPercent.textContent = `${percent}%`;
  }
  if (issueChecklistProgressBar) {
    issueChecklistProgressBar.style.width = `${percent}%`;
  }
  if (issueChecklistStatus) {
    issueChecklistStatus.className = `issue-checklist-status ${isComplete ? "is-ready" : "is-blocked"}`;
    issueChecklistStatus.disabled = !isComplete;
    issueChecklistStatus.textContent = state.issueChecklist.completedAt ? "Выдача подтверждена" : "Готов к выдаче";
  }
  if (issueChecklistCompletedAt) {
    issueChecklistCompletedAt.textContent = state.issueChecklist.completedAt
      ? `Завершено: ${state.issueChecklist.completedAt}`
      : "";
  }

  issueChecklistGroups.innerHTML = ISSUE_CHECKLIST.map(
    (group, groupIndex) => `
      <fieldset class="issue-checklist-group">
        <legend>${escapeHtml(group.title)}</legend>
        <div class="issue-checklist-items">
          ${group.items
            .map((label, itemIndex) => {
              const id = `${groupIndex}-${itemIndex}`;
              return `
                <label class="issue-checklist-item">
                  <input type="checkbox" data-checklist-item="${id}" ${state.issueChecklist.checked[id] ? "checked" : ""} />
                  <span>${escapeHtml(label)}</span>
                </label>
              `;
            })
            .join("")}
        </div>
      </fieldset>
    `
  ).join("");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "same-origin",
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && payload.error
        ? payload.error
        : "Ошибка запроса";
    throw new Error(message);
  }

  return payload;
}

function getRole() {
  return state.user?.role || "mechanic";
}

function getStatusClass(status) {
  if (status === "Готов") return "status-ready";
  if (status === "В ремонте") return "status-progress";
  return "status-waiting";
}

function getBikeStatusClass(status) {
  if (status === "готов" || status === "в аренде") return "status-ready";
  if (status === "в ремонте" || status === "проверка" || status === "принят") return "status-progress";
  return "status-waiting";
}

function getBikeStatusOptions() {
  if (getRole() === "mechanic") {
    return [
      ["на диагностике", "На диагностике"],
      ["ждет запчасти", "Ждет запчасти"],
      ["в ремонте", "В ремонте"],
      ["готов", "Готов"],
    ];
  }

  return [
    ["в аренде", "В аренде"],
    ["на диагностике", "На диагностике"],
    ["ждет запчасти", "Ждет запчасти"],
    ["в ремонте", "В ремонте"],
    ["проверка", "Проверка"],
    ["готов", "Готов"],
    ["принят", "Принят"],
  ];
}

function formatBikeModel(model) {
  const normalized = String(model || "U2").trim();
  return normalized.replace(/^Wenbox\s+/i, "");
}

function getSeverityClass(severity) {
  if (severity === "Критичная") return "severity-critical";
  if (severity === "Средняя") return "severity-medium";
  return "severity-low";
}

function getDiagnosticCategoryCount(category) {
  return state.diagnostics.filter((item) => item.category === category).length;
}

function isMobileViewport() {
  return window.innerWidth <= 1080;
}

function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  mobileNavOverlay?.classList.add("hidden");
}

function openMobileMenu() {
  if (!isMobileViewport()) return;
  document.body.classList.add("mobile-menu-open");
  mobileNavOverlay?.classList.remove("hidden");
}

function toggleMobileMenu() {
  if (document.body.classList.contains("mobile-menu-open")) {
    closeMobileMenu();
    return;
  }
  openMobileMenu();
}

function getMetrics() {
  const readyRepairs = state.repairs.filter((item) => item.status === "Готов").length;
  const inRepair = state.workOrders.filter((item) => item.status === "в ремонте").length;
  const waiting = state.workOrders.filter((item) => item.status === "ждет запчасти").length;
  const lowStock = state.inventory.filter((item) => Number(item.stock) <= Number(item.min));
  const rented = state.bikes.filter((item) => item.status === "в аренде").length;
  const readyForRent = state.bikes.filter((item) => item.status === "готов").length;
  const technical = state.bikes.filter((item) => item.status === "на диагностике").length;
  const workingBikes = rented + readyForRent;
  const readyRate = state.kpi.totalBikes
    ? Math.round((workingBikes / state.kpi.totalBikes) * 100)
    : 0;

  return {
    readyRepairs,
    inRepair,
    waiting,
    lowStock,
    rented,
    readyForRent,
    technical,
    workingBikes,
    readyRate,
  };
}

function formatHours(value) {
  return `${Number(value || 0).toFixed(1)} ч`;
}

function formatRepairCountdown(deadlineRaw) {
  if (!deadlineRaw) return "Таймер еще не запущен";
  const deadline = new Date(deadlineRaw).getTime();
  const diff = deadline - Date.now();
  if (Number.isNaN(deadline)) return "Таймер недоступен";
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  const parts = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0"));
  return diff >= 0 ? `${parts.join(":")} до завершения` : `Просрочено на ${parts.join(":")}`;
}

function getWorkOrderPartsStatus(order) {
  if (!order.parts?.length) {
    return {
      summary: "Запчасти не требуются",
      details: '<p class="success-text">Для этой работы дополнительные детали не нужны.</p>',
    };
  }

  if (order.missing_parts?.length) {
    return {
      summary: "Нужно заказать недостающие детали",
      details: `<p class="error-text">Не хватает: ${escapeHtml(
        order.missing_parts.map((item) => `${item.name} x${item.missing}`).join(", ")
      )}</p>`,
    };
  }

  return {
    summary: "Все нужные запчасти в наличии",
    details: '<p class="success-text">Комплект собран, ремонт можно запускать.</p>',
  };
}

function openWorkOrderDetail(order) {
  if (!order || !workOrderOverlay) return;
  const partsStatus = getWorkOrderPartsStatus(order);
  if (workOrderModalTitle) workOrderModalTitle.textContent = `Ремонт ${order.bike_code || ""}`.trim();
  if (workOrderDetailBike) workOrderDetailBike.textContent = order.bike_code || "-";
  if (workOrderDetailStatus) {
    workOrderDetailStatus.className = `status-pill ${getBikeStatusClass(order.status)}`;
    workOrderDetailStatus.textContent = order.status || "-";
  }
  if (workOrderDetailFault) workOrderDetailFault.textContent = order.fault || order.issue || "-";
  if (workOrderDetailParts) workOrderDetailParts.textContent = order.required_parts_text || "Запчасти не требуются";
  if (workOrderDetailPartsStatus) {
    workOrderDetailPartsStatus.innerHTML = `
      <p class="muted">${escapeHtml(partsStatus.summary)}</p>
      ${partsStatus.details}
    `;
  }
  if (workOrderDetailDate) workOrderDetailDate.textContent = order.intake_date || "-";
  if (workOrderDetailMinutes) workOrderDetailMinutes.textContent = `${order.estimated_minutes || 0} мин`;
  if (workOrderDetailHint) {
    workOrderDetailHint.textContent = order.planned_work || "Открой диагностику и проверь типовую схему ремонта для этой поломки.";
  }
  workOrderOverlay.classList.remove("hidden");
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch (error) {
    return "denied";
  }
}

function notifyRepairDeadline(order) {
  if (!order || repairDeadlineNotifications.has(order.id) || order.status !== "в ремонте" || !order.estimated_ready_at) {
    return;
  }
  if (new Date(order.estimated_ready_at).getTime() > Date.now()) {
    return;
  }
  repairDeadlineNotifications.add(order.id);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Пора завершать ремонт", {
      body: `${order.bike_code}: ${order.issue}`,
    });
  }
  showRepairAlert(`Пора завершать ремонт: ${order.bike_code} — ${order.issue}`);
}

function refreshRepairTimers() {
  document.querySelectorAll("[data-repair-deadline]").forEach((node) => {
    const deadline = node.dataset.repairDeadline;
    node.textContent = formatRepairCountdown(deadline);
    node.classList.toggle("error-text", Boolean(deadline) && new Date(deadline).getTime() <= Date.now());
  });
  state.workOrders.forEach((order) => notifyRepairDeadline(order));
}

function showRepairAlert(message) {
  const alert = document.createElement("div");
  alert.className = "repair-alert";
  alert.innerHTML = `
    <strong>Ремонт требует внимания</strong>
    <p>${escapeHtml(message)}</p>
  `;
  repairAlerts.appendChild(alert);
  window.setTimeout(() => {
    alert.classList.add("is-visible");
  }, 20);
  window.setTimeout(() => {
    alert.classList.remove("is-visible");
    window.setTimeout(() => alert.remove(), 250);
  }, 7000);
}

function getOverviewBreakdown(metrics) {
  const total = Math.max(state.kpi.totalBikes || state.bikes.length || 1, 1);
  const perBikeHours = 8.47;
  return [
    {
      key: "rented",
      label: "В аренде",
      count: metrics.rented,
      hours: metrics.rented * perBikeHours,
      percent: Math.round((metrics.rented / total) * 100),
      color: "#10a36e",
      tint: "is-soft-green",
      icon: "⚲",
      extra: "активная аренда",
    },
    {
      key: "ready",
      label: "Готов к аренде",
      count: metrics.readyForRent,
      hours: metrics.readyForRent * perBikeHours,
      percent: Math.round((metrics.readyForRent / total) * 100),
      color: "#f5a000",
      tint: "is-soft-yellow",
      icon: "◌",
      extra: "ждут выдачи",
    },
    {
      key: "repair",
      label: "В ремонте",
      count: metrics.inRepair,
      hours: metrics.inRepair * perBikeHours,
      percent: Math.round((metrics.inRepair / total) * 100),
      color: "#3367e0",
      tint: "is-soft-blue",
      icon: "⌁",
      extra: "сервис в работе",
    },
    {
      key: "waiting",
      label: "Ждут запчасти",
      count: metrics.waiting + metrics.technical,
      hours: (metrics.waiting + metrics.technical) * perBikeHours,
      percent: Math.round(((metrics.waiting + metrics.technical) / total) * 100),
      color: "#19b3d4",
      tint: "is-soft-blue",
      icon: "△",
      extra: "простой парка",
    },
  ];
}

function getFilteredRepairs() {
  const query = state.search.trim().toLowerCase();
  return state.repairs.filter((item) => {
    const matchesStatus =
      state.statusFilter === "all" ? true : item.status === state.statusFilter;
    const haystack = [
      item.date,
      item.bike,
      item.issue,
      item.work,
      item.parts_used,
      item.needed_parts,
      item.status,
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && haystack.includes(query);
  });
}

function getDashboardDateRange() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (state.dashboardPeriod === "yesterday") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 1);
    return { start, end: startOfToday };
  }

  if (state.dashboardPeriod === "week") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return { start, end: startOfTomorrow };
  }

  if (state.dashboardPeriod === "month") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    return { start, end: startOfTomorrow };
  }

  return { start: startOfToday, end: startOfTomorrow };
}

function isDateInDashboardPeriod(rawValue) {
  if (!rawValue) return false;
  const { start, end } = getDashboardDateRange();
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawValue).trim())) {
    date = new Date(`${rawValue}T00:00:00`);
  } else {
    date = new Date(rawValue);
  }
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
}

function getDashboardStats() {
  const repairsInPeriod = state.workOrders.filter(
    (item) => Boolean(item.started_at) && isDateInDashboardPeriod(item.started_at)
  ).length;
  const waitingParts = state.workOrders.filter(
    (item) => item.status === "ждет запчасти" && isDateInDashboardPeriod(item.intake_date)
  ).length;
  const readyAfterRepair = state.repairs.filter(
    (item) => item.status === "Готов" && isDateInDashboardPeriod(item.date)
  ).length;
  const idleReadyBikes = state.bikes.filter((item) => item.status === "готов").length;

  return {
    repairsInPeriod,
    waitingParts,
    readyAfterRepair,
    idleReadyBikes,
  };
}

function renderSectionHeader() {
  const ownerMode = getRole() === "owner";
  const sectionMeta = {
    overview: ownerMode
      ? {
          title: "Дашборд",
          heroTitleText: "Собственник видит бизнес-картину, а не только список поломок",
          heroCopyText: "На одном экране видно, сколько байков реально готовы к аренде, где застревают ремонты и какие позиции тянут закупку.",
          badge: "KPI и доступность парка",
        }
      : {
          title: "Дашборд",
          heroTitleText: "Рабочий день механика под контролем",
          heroCopyText: "Видно текущую загрузку, зависшие ремонты и детали, которые нужно заказать.",
          badge: `Сегодня в фокусе: ${state.kpi.mechanicFocus || "оперативка"}`,
        },
    bikes: {
      title: "Парк байков",
      heroTitleText: "Управление составом парка",
      heroCopyText: "Здесь можно добавлять новые байки, менять их статусы и поддерживать актуальную карточку каждого байка.",
      badge: "Парк и статусы",
    },
    profile: {
      title: "Профиль механика",
      heroTitleText: "Личная карточка сотрудника",
      heroCopyText: "Здесь можно обновить имя, контакты, должность и рабочие заметки.",
      badge: "Аккаунт",
    },
    diagnostics: {
      title: "Диагностика",
      heroTitleText: "Первичный осмотр и фиксация поломок",
      heroCopyText: "Механик выбирает узел байка, указывает неисправность и формирует основание для ремонта.",
      badge: "Осмотр",
    },
    repairs: {
      title: "Ремонты",
      heroTitleText: "Активные заявки и завершенные работы",
      heroCopyText: "Здесь видна очередь ремонта, этапы заявок и история закрытых работ.",
      badge: "Сервисный цикл",
    },
    "issue-checklist": {
      title: "Чек-лист выдачи",
      heroTitleText: "Финальная проверка перед передачей байка",
      heroCopyText: "Механик проходит обязательные пункты по технике, АКБ, внешнему виду и брендингу перед выдачей.",
      badge: "Контроль выдачи",
    },
    inventory: {
      title: "Склад",
      heroTitleText: "Остатки и дефицит запчастей",
      heroCopyText: "Раздел помогает держать в норме доступные детали и вовремя замечать нехватку.",
      badge: "Запчасти",
    },
    owner: {
      title: "Настройки KPI",
      heroTitleText: "Управление целями сервиса",
      heroCopyText: "Собственник задает ключевые ориентиры по готовности парка и контролирует исполнение.",
      badge: "Контроль",
    },
  };
  const meta = sectionMeta[state.activeSection] || sectionMeta.overview;
  pageTitle.textContent = meta.title;
  if (heroTitle) {
    heroTitle.textContent = meta.heroTitleText;
  }
  if (heroCopy) {
    heroCopy.textContent = meta.heroCopyText;
  }
  if (heroBadge) {
    heroBadge.textContent = meta.badge;
  }
}

function renderRoleContent() {
  const ownerMode = getRole() === "owner";
  const roleLabel = ownerMode ? "Владелец" : "Механик";

  if (sidebarRoleTitle) {
    sidebarRoleTitle.textContent = roleLabel;
  }

  currentUser.textContent = state.user
    ? state.user.full_name
    : "Не выполнен вход";

  document.querySelectorAll(".mechanic-only").forEach((node) => {
    node.classList.toggle("hidden", ownerMode);
  });

  document.querySelectorAll(".owner-only").forEach((node) => {
    node.classList.toggle("hidden", !ownerMode);
  });
}

function renderProfile() {
  if (!state.user) return;

  const initials = (state.user.full_name || state.user.username || "М")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  profileAvatar.textContent = initials || "М";
  profileNameDisplay.textContent = state.user.full_name || "Не заполнено";
  profileRoleDisplay.textContent = state.user.position || (getRole() === "owner" ? "Собственник" : "Механик");
  profilePhoneDisplay.textContent = state.user.phone || "Не заполнен";
  profileTelegramDisplay.textContent = state.user.telegram || "Не заполнен";
  profilePositionDisplay.textContent = state.user.position || "Не заполнена";

  if (profileForm) {
    profileForm.elements.fullName.value = state.user.full_name || "";
    profileForm.elements.position.value = state.user.position || "";
    profileForm.elements.phone.value = state.user.phone || "";
    profileForm.elements.telegram.value = state.user.telegram || "";
    profileForm.elements.notes.value = state.user.notes || "";
  }
}

function renderBikeFormStatusOptions() {
  if (!bikeForm) return;
  const statusSelect = bikeForm.elements.status;
  if (!statusSelect) return;
  const currentValue = String(statusSelect.value || "").trim();
  statusSelect.innerHTML = getBikeStatusOptions()
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  const fallbackValue = getRole() === "owner" ? "в аренде" : "на диагностике";
  statusSelect.value = getBikeStatusOptions().some(([value]) => value === currentValue) ? currentValue : fallbackValue;
}

function renderSections() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    const allowed = !button.classList.contains("owner-only") || getRole() === "owner";
    button.classList.toggle("hidden", !allowed);
    button.classList.toggle("is-active", button.dataset.section === state.activeSection);
  });

  if (currentUser) {
    currentUser.classList.toggle("is-active-profile", state.activeSection === "profile");
  }

  document.querySelectorAll(".screen-section").forEach((section) => {
    section.classList.toggle("hidden", section.id !== `section-${state.activeSection}`);
  });
}

function renderStatusChips() {
  document.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.statusFilter === state.statusFilter);
  });
}

function renderDiagnosticsTable() {
  const canManage = getRole() === "mechanic" || getRole() === "owner";
  diagnosticsTable.innerHTML = state.diagnostics
    .map(
      (item, index) => `
        <tr>
          <td data-label="#"><span class="row-index">${index + 1}</span></td>
          <td data-label="Дата">${escapeHtml(item.date)}</td>
          <td data-label="Байк"><strong>${escapeHtml(item.bike)}</strong></td>
          <td data-label="Раздел"><span class="diagnostic-category-tag">${escapeHtml(item.category || "Общее")}</span></td>
          <td data-label="Поломка"><strong>${escapeHtml(item.fault || "Не указана")}</strong></td>
          <td data-label="Симптомы">${escapeHtml(item.symptoms)}</td>
          <td data-label="Заключение">${escapeHtml(item.conclusion)}</td>
          <td class="mechanic-only">
            ${
              canManage
                ? `<div class="table-actions">
                    <button class="primary-btn primary-btn-small" type="button" data-action="create-repair-from-diagnostic" data-id="${item.id}">В ремонт</button>
                    <button class="icon-btn" type="button" data-action="edit-diagnostic" data-id="${item.id}">Изм.</button>
                    <button class="danger-btn" type="button" data-action="delete-diagnostic" data-id="${item.id}">Удалить</button>
                  </div>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  if (!state.diagnostics.length) {
    diagnosticsTable.innerHTML = `
      <tr>
        <td colspan="8" class="muted">Диагностических записей пока нет.</td>
      </tr>
    `;
  }
}

function renderDiagnosticCategoryGrid() {
  const cards = Object.entries(DIAGNOSTIC_LIBRARY).map(([category, config]) => {
    const count = getDiagnosticCategoryCount(category);
    return `
      <button class="diagnostic-category-card" type="button" data-action="start-diagnostic-category" data-category="${escapeHtml(category)}">
        <strong>${escapeHtml(category)}</strong>
        <p>${escapeHtml(config.summary)}</p>
        <p class="muted">Записей: ${count}</p>
      </button>
    `;
  });

  if (diagnosticCategoryGrid) {
    diagnosticCategoryGrid.innerHTML = cards.join("");
  }

  if (diagnosticWizardCategoryGrid) {
    diagnosticWizardCategoryGrid.innerHTML = cards.join("");
  }
}

function renderDiagnosticFaultGrid() {
  const category = state.diagnosticFlow.category;
  const config = DIAGNOSTIC_LIBRARY[category];
  if (!diagnosticFaultGrid || !diagnosticFaultsTitle) return;

  if (!category) {
    diagnosticFaultsTitle.textContent = "Выбери типовую поломку";
  } else if (category === "Пластик" && !state.diagnosticFlow.zone) {
    diagnosticFaultsTitle.textContent = "Выбери место повреждения";
  } else if (category === "Пластик") {
    diagnosticFaultsTitle.textContent = `Выбери тип повреждения: ${state.diagnosticFlow.zone}`;
  } else {
    diagnosticFaultsTitle.textContent = `Выбери поломку: ${category}`;
  }

  if (!config) {
    diagnosticFaultGrid.innerHTML = '<p class="muted">Сначала выбери раздел диагностики.</p>';
    return;
  }

  if (category === "Пластик" && !state.diagnosticFlow.zone) {
    diagnosticFaultGrid.innerHTML = config.zones
      .map(
        (zone) => `
          <button class="diagnostic-fault-card" type="button" data-action="select-diagnostic-zone" data-zone="${escapeHtml(zone)}">
            <strong>${escapeHtml(zone)}</strong>
          </button>
        `
      )
      .join("");
    return;
  }

  const faults = category === "Пластик"
    ? config.damageTypes
    : config.faults;

  diagnosticFaultGrid.innerHTML = faults
    .map(
      (fault) => `
        <button class="diagnostic-fault-card" type="button" data-action="select-diagnostic-fault" data-fault="${escapeHtml(fault)}">
          <strong>${escapeHtml(fault)}</strong>
        </button>
      `
    )
    .join("");
}

function syncDiagnosticWizard() {
  const category = state.diagnosticFlow.category;
  const fault = state.diagnosticFlow.fault;

  diagnosticSelectedCategory.textContent = category || "Не выбран";
  diagnosticSelectedFault.textContent = fault || "Не выбрана";

  const editing = state.diagnosticFlow.mode === "edit";
  diagnosticModalTitle.textContent = editing ? "Редактирование диагностической записи" : "Новая диагностическая запись";

  diagnosticStepCategories.classList.toggle("is-active", !category);
  diagnosticStepFaults.classList.toggle("is-active", Boolean(category) && !fault);
  diagnosticStepDetails.classList.toggle("is-active", Boolean(category) && Boolean(fault));

  diagnosticStepViewCategories.classList.toggle("hidden", Boolean(category));
  diagnosticStepViewFaults.classList.toggle("hidden", !category || Boolean(fault));
  diagnosticForm.classList.toggle("hidden", !category || !fault);
}

function resetDiagnosticFlow() {
  state.diagnosticFlow = {
    mode: "create",
    category: "",
    zone: "",
    fault: "",
  };
  diagnosticForm.reset();
  resetBikeCodeValue("diagnostic");
  delete diagnosticForm.dataset.editId;
  diagnosticForm.elements.date.value = new Date().toISOString().slice(0, 10);
  diagnosticForm.elements.mechanicName.value = state.user?.full_name || "";
  diagnosticForm.elements.category.value = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function openDiagnosticOverlay() {
  diagnosticOverlay.classList.remove("hidden");
  renderDiagnosticCategoryGrid();
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function chooseDiagnosticCategory(category) {
  state.diagnosticFlow.category = category;
  state.diagnosticFlow.zone = "";
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.category.value = category;
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function chooseDiagnosticZone(zone) {
  state.diagnosticFlow.zone = zone;
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
}

function chooseDiagnosticFault(fault) {
  const resolvedFault =
    state.diagnosticFlow.category === "Пластик" && state.diagnosticFlow.zone
      ? `${state.diagnosticFlow.zone} · ${fault}`
      : fault;
  state.diagnosticFlow.fault = resolvedFault;
  diagnosticForm.elements.category.value = state.diagnosticFlow.category;
  diagnosticForm.elements.fault.value = resolvedFault;
  if (!diagnosticForm.elements.symptoms.value.trim()) {
    diagnosticForm.elements.symptoms.value = `${state.diagnosticFlow.category}: ${resolvedFault}`;
  }
  syncDiagnosticWizard();
}

function renderMetrics() {
  const stats = getDashboardStats();
  const ownerMode = getRole() === "owner";
  document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dashboardPeriod === state.dashboardPeriod);
  });
  const cards = [
    {
      key: "repair",
      icon: "🔧",
      tint: "is-soft-yellow",
      label: "Байков в ремонте",
      value: String(stats.repairsInPeriod),
      details: state.workOrders
        .filter((item) => Boolean(item.started_at) && isDateInDashboardPeriod(item.started_at))
        .slice(0, 6)
        .map((item) => `${item.bike_code} · ${item.estimated_minutes || 0} мин`),
    },
    {
      key: "waiting",
      icon: "△",
      tint: "is-soft-red",
      label: "Ждут запчасти",
      value: String(stats.waitingParts),
      details: state.workOrders
        .filter((item) => item.status === "ждет запчасти" && isDateInDashboardPeriod(item.intake_date))
        .slice(0, 6)
        .map((item) =>
          item.missing_parts?.length
            ? `${item.bike_code} · ${item.missing_parts.map((part) => `${part.name} x${part.missing}`).join(", ")}`
            : `${item.bike_code} · ожидает комплектность`
        ),
    },
    {
      key: "ready",
      icon: "✓",
      tint: "is-soft-green",
      label: "Готово ремонтов",
      value: String(stats.readyAfterRepair),
      details: state.repairs
        .filter((item) => item.status === "Готов" && isDateInDashboardPeriod(item.date))
        .slice(0, 6)
        .map((item) => `${item.bike} · ${item.issue}`),
    },
    ...(ownerMode
      ? [{
      key: "idle",
      icon: "⚲",
      tint: "is-soft-yellow",
      label: "Простаивают и готовы",
      value: String(stats.idleReadyBikes),
      details: state.bikes
        .filter((item) => item.status === "готов")
        .slice(0, 6)
        .map((item) => `${item.code} · ${formatBikeModel(item.model)}`),
      }]
      : []),
  ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="crm-kpi-card ${state.dashboardExpanded === card.key ? "is-expanded" : ""}">
          <button
            class="crm-kpi-trigger"
            type="button"
            data-dashboard-card="${card.key}"
            aria-expanded="${state.dashboardExpanded === card.key ? "true" : "false"}"
          >
            <div class="crm-kpi-icon ${card.tint}">${card.icon}</div>
            <div class="crm-kpi-main">
              <span class="crm-kpi-label">${escapeHtml(card.label)}</span>
              <strong class="crm-kpi-value">${escapeHtml(card.value)}</strong>
            </div>
            <div class="crm-kpi-toggle">⌄</div>
          </button>
          <div class="crm-kpi-details ${state.dashboardExpanded === card.key ? "is-open" : ""}">
            ${
              card.details.length
                ? card.details.map((item) => `<div class="crm-kpi-detail-row">${escapeHtml(item)}</div>`).join("")
                : '<div class="crm-kpi-detail-row muted">Нет записей за выбранный период.</div>'
            }
          </div>
        </article>
      `
    )
    .join("");
}

function renderTimeline() {
  const metrics = getMetrics();
  const rows = [
    { label: "В ремонте сейчас", value: metrics.inRepair },
    { label: "Ждут запчасти сейчас", value: metrics.waiting },
    { label: "Готовы к аренде сейчас", value: metrics.readyForRent },
    { label: "На диагностике", value: metrics.technical },
  ];
  timeline.innerHTML = rows
    .map(
      (row) => `
        <article class="crm-status-row">
          <div>
            <div class="crm-status-title">${escapeHtml(row.label)}</div>
          </div>
          <div class="crm-status-metrics">
            <span class="crm-status-percent">${escapeHtml(String(row.value))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAlerts() {
  const urgentWaiting = state.workOrders
    .filter((item) => item.status === "ждет запчасти")
    .slice(0, 4)
    .map((item) => ({
      title: item.bike_code,
      copy: item.missing_parts?.length
        ? `Не хватает: ${item.missing_parts.map((part) => `${part.name} x${part.missing}`).join(", ")}`
        : "Ожидает комплектность",
      state: "danger",
      hours: `${item.estimated_minutes || 0} мин`,
    }));
  const activeRepairs = state.workOrders
    .filter((item) => item.status === "в ремонте")
    .slice(0, Math.max(0, 4 - urgentWaiting.length))
    .map((item) => ({
      title: item.bike_code,
      copy: item.fault || item.issue,
      state: "ok",
      hours: `${item.estimated_minutes || 0} мин`,
    }));
  const loadItems = [...urgentWaiting, ...activeRepairs];

  if (!loadItems.length) {
    loadItems.push({
      title: "Спокойная смена",
      copy: "Сейчас нет активных ремонтов и заявок, которые ждут запчасти.",
      state: "ok",
      hours: "Норма",
    });
  }

  alertsList.innerHTML = `
    <div class="crm-load-list">
      ${loadItems
    .map(
      (item) => `
        <article class="crm-load-item">
          <div>
            <div class="crm-load-item-title">${escapeHtml(item.title)}</div>
            <p class="muted">${escapeHtml(item.copy)}</p>
          </div>
          <span class="crm-load-pill ${item.state === "danger" ? "is-danger" : "is-ok"}">
            ${item.state === "danger" ? "Внимание" : "Норма"}
          </span>
          <span class="crm-load-hours">${escapeHtml(item.hours)}</span>
        </article>
      `
    )
    .join("")}
    </div>
  `;
}

function renderRepairsTable() {
  const rows = getFilteredRepairs();
  const canManage = getRole() === "mechanic" || getRole() === "owner";

  repairsTable.innerHTML = rows
    .map(
      (item, index) => `
        <tr>
          <td data-label="#"><span class="row-index">${index + 1}</span></td>
          <td data-label="Дата">${escapeHtml(item.date)}</td>
          <td data-label="Байк"><strong>${escapeHtml(item.bike)}</strong></td>
          <td data-label="Проблема">${escapeHtml(item.issue)}</td>
          <td data-label="Что сделано">${escapeHtml(item.work)}</td>
          <td data-label="Использовано">${escapeHtml(item.parts_used)}</td>
          <td data-label="Нужно заказать">${escapeHtml(item.needed_parts)}</td>
          <td data-label="Статус"><span class="status-pill ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span></td>
          <td class="mechanic-only">
            ${
              canManage
                ? `<div class="table-actions">
                    <button class="icon-btn" type="button" data-action="edit-repair" data-id="${item.id}">Изм.</button>
                    <button class="danger-btn" type="button" data-action="delete-repair" data-id="${item.id}">Удалить</button>
                  </div>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  if (!rows.length) {
    repairsTable.innerHTML = `
      <tr>
        <td colspan="9" class="muted">По текущему фильтру записей не найдено.</td>
      </tr>
    `;
  }
}

function renderInventory() {
  const canManage = getRole() === "mechanic" || getRole() === "owner";
  inventoryGrid.innerHTML = state.inventory
    .map((item) => {
      const isLow = Number(item.stock) <= Number(item.min);
      return `
        <article class="inventory-card ${isLow ? "is-low" : ""}">
          <div class="inventory-meta">
            <span>${escapeHtml(item.name)}</span>
            <span>${isLow ? "Дефицит" : "Норма"}</span>
          </div>
          <div class="inventory-stock">${escapeHtml(item.stock)}</div>
          <p class="muted">Минимум: ${escapeHtml(item.min)} · Зарезервировано: ${escapeHtml(item.reserved || 0)}</p>
          <p class="muted">Доступно сейчас: ${escapeHtml(item.available || 0)} · Нужно заказать: ${escapeHtml(item.need_to_order ? "Да" : "Нет")}</p>
          ${
            canManage
              ? `<div class="inventory-actions">
                  <button class="icon-btn" type="button" data-action="edit-inventory" data-id="${item.id}">Изменить</button>
                  <button class="danger-btn" type="button" data-action="delete-inventory" data-id="${item.id}">Удалить</button>
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderBikes() {
  if (!bikesGrid) return;
  const canManage = getRole() === "mechanic" || getRole() === "owner";
  const statusOptions = getBikeStatusOptions();
  bikesGrid.innerHTML = state.bikes
    .map((bike) => {
      const latestRepair = bike.latest_repair_issue
        ? `${bike.latest_repair_date || "Без даты"} · ${bike.latest_repair_issue}`
        : "Ремонтов еще не было";
      return `
        <article class="inventory-card bike-card">
          <div class="bike-card-head">
            <div>
              <div class="bike-card-code">${escapeHtml(bike.code)}</div>
              <div class="bike-card-model">${escapeHtml(formatBikeModel(bike.model))}</div>
            </div>
            <span class="status-pill ${getBikeStatusClass(bike.status)}">${escapeHtml(bike.status)}</span>
          </div>
          <div class="bike-card-history">
            <span class="bike-card-label">Последний ремонт</span>
            <strong>${escapeHtml(latestRepair)}</strong>
          </div>
          <p class="muted bike-card-notes">${escapeHtml(bike.notes || "Без заметок по байку")}</p>
          ${
            canManage
              ? `<div class="inventory-actions inventory-actions-bike">
                  <select class="bike-status-select" data-bike-status-id="${bike.id}">
                    ${statusOptions
                      .map(
                        ([value, label]) =>
                          `<option value="${value}" ${bike.status === value ? "selected" : ""}>${label}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="primary-btn primary-btn-small" type="button" data-action="save-bike-status" data-id="${bike.id}">Сохранить статус</button>
                  <button class="icon-btn" type="button" data-action="edit-bike" data-id="${bike.id}">Изменить</button>
                  <button class="danger-btn" type="button" data-action="delete-bike" data-id="${bike.id}">Удалить</button>
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderWorkOrders() {
  if (!workOrdersBoard || !activeRepairBoard) return;
  const activeOrders = state.workOrders.filter((order) => order.status === "в ремонте");
  const queueOrders = state.workOrders.filter((order) => order.status !== "в ремонте");

  if (!activeOrders.length) {
    activeRepairBoard.innerHTML = '<div class="stack-item"><strong>Активных ремонтов нет</strong><p class="muted">Когда механик нажимает "Начать ремонт", здесь запускается таймер по расчетному времени.</p></div>';
  } else {
    activeRepairBoard.innerHTML = activeOrders
      .map((order) => {
        return `
          <article class="content-card owner-card repair-compact-card repair-compact-card-active" data-action="open-work-order" data-id="${order.id}">
            <div class="bike-card-head repair-compact-head">
              <div>
                <div class="bike-card-code">${escapeHtml(order.bike_code)}</div>
                <div class="bike-card-model">Активный ремонт</div>
              </div>
              <span class="status-pill ${getBikeStatusClass(order.status)}">${escapeHtml(order.status)}</span>
            </div>
            <div class="repair-compact-main">
              <p class="metric-value repair-timer" data-repair-deadline="${escapeHtml(order.estimated_ready_at || "")}">${escapeHtml(formatRepairCountdown(order.estimated_ready_at))}</p>
              <p class="muted">Осталось времени на ремонт</p>
            </div>
            <div class="table-actions">
              ${order.can_mark_ready ? `<button class="primary-btn primary-btn-small" type="button" data-action="work-order-ready" data-id="${order.id}">Завершить ремонт</button>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  if (!queueOrders.length) {
    workOrdersBoard.innerHTML = '<div class="stack-item"><strong>Очередь пуста</strong><p class="muted">Новые заявки создаются автоматически после диагностики.</p></div>';
    refreshRepairTimers();
    return;
  }

  workOrdersBoard.innerHTML = queueOrders
    .map((order) => {
      return `
        <article class="content-card owner-card repair-compact-card" data-action="open-work-order" data-id="${order.id}">
          <div class="repair-compact-row">
            <div>
              <div class="bike-card-code repair-queue-code">${escapeHtml(order.bike_code)}</div>
              <div class="muted repair-queue-meta">Диагностика: ${escapeHtml(order.intake_date)}</div>
            </div>
            <span class="status-pill ${getBikeStatusClass(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <div class="repair-compact-main">
            <p class="metric-value">${escapeHtml(String(order.estimated_minutes || 0))} мин</p>
            <p class="muted">Расчетное время на ремонт</p>
          </div>
          <div class="table-actions">
            ${order.can_start ? `<button class="primary-btn primary-btn-small" type="button" data-action="work-order-start" data-id="${order.id}">Начать ремонт</button>` : ""}
            ${!order.can_start && order.status !== "готов" ? `<button class="ghost-btn" type="button" disabled>Ждем комплектность</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  refreshRepairTimers();
}

function renderOwnerPanel() {
  const metrics = getMetrics();
  ownerKpi.textContent = `${metrics.readyRate}%`;
  ownerKpiNote.textContent =
    metrics.readyRate >= state.kpi.targetRate
      ? `Цель достигнута: ${metrics.workingBikes} исправных байков из ${state.kpi.totalBikes}.`
      : `Нужно поднять доступность парка: ${metrics.workingBikes} исправных из ${state.kpi.totalBikes}.`;

  const procurementItems = metrics.lowStock.length
    ? metrics.lowStock.map(
        (item) =>
          `<div class="stack-item"><strong>${escapeHtml(item.name)}</strong><p class="muted">Остаток ${item.stock}, минимум ${item.min}</p></div>`
      )
    : ['<div class="stack-item"><strong>Закупка не требуется</strong><p class="muted">Критичных дефицитов на складе нет.</p></div>'];

  ownerProcurement.innerHTML = procurementItems.join("");

  ownerProcess.innerHTML = [
    `<div class="stack-item"><strong>Ремонтов в работе: ${metrics.inRepair}</strong><p class="muted">Это активная техническая загрузка команды.</p></div>`,
    `<div class="stack-item"><strong>Ждут запчасти: ${metrics.waiting}</strong><p class="muted">Эти байки не вернутся в аренду без закупки.</p></div>`,
    `<div class="stack-item"><strong>Закрытых работ: ${metrics.readyRepairs}</strong><p class="muted">Сколько ремонтов уже доведено до статуса "Готов".</p></div>`,
  ].join("");
}

function render() {
  loginOverlay.classList.toggle("hidden", Boolean(state.user));
  globalSearch.value = state.search;
  statusFilter.value = state.statusFilter;
  if (settingsForm) {
    settingsForm.elements.totalBikes.value = state.kpi.totalBikes || "";
    settingsForm.elements.targetRate.value = state.kpi.targetRate || "";
    if (settingsForm.elements.mechanicFocus) {
      settingsForm.elements.mechanicFocus.value = state.kpi.mechanicFocus || "оперативка";
    }
  }
  renderRoleContent();
  renderSectionHeader();
  renderSections();
  renderStatusChips();
  renderMetrics();
  renderTimeline();
  renderAlerts();
  renderRepairsTable();
  renderDiagnosticsTable();
  renderDiagnosticCategoryGrid();
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
  renderInventory();
  renderBikes();
  renderWorkOrders();
  renderIssueChecklist();
  renderOwnerPanel();
  renderProfile();
  renderBikeFormStatusOptions();
}

async function bootstrap() {
  try {
    const payload = await api("/api/bootstrap", { method: "GET", headers: {} });
    state.user = payload.user;
    state.kpi = payload.kpi;
    state.bikes = payload.bikes || [];
    state.repairs = payload.repairs;
    state.inventory = payload.inventory;
    state.diagnostics = payload.diagnostics || [];
    state.workOrders = payload.workOrders || [];
    if (getRole() !== "owner" && state.activeSection === "owner") {
      state.activeSection = "overview";
    }
    render();
  } catch (error) {
    if (String(error.message).includes("Авторизация")) {
      state.user = null;
      render();
      return;
    }

    loginError.textContent = error.message;
    loginError.classList.remove("hidden");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.add("hidden");
  loginError.textContent = "";

  const formData = new FormData(loginForm);

  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: String(formData.get("username")).trim(),
        password: String(formData.get("password")),
      }),
    });

    state.user = payload.user;
    loginForm.reset();
    await bootstrap();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove("hidden");
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    state.user = null;
    render();
  }
});

accountButton.addEventListener("click", () => {
  passwordError.classList.add("hidden");
  passwordMessage.classList.add("hidden");
  passwordForm.reset();
  accountOverlay.classList.remove("hidden");
});

currentUser?.addEventListener("click", () => {
  state.activeSection = "profile";
  closeMobileMenu();
  render();
});

closeAccountButton.addEventListener("click", () => {
  accountOverlay.classList.add("hidden");
});

openRepairModalButton?.addEventListener("click", () => {
  if (state.repairDraftFromDiagnostic) {
    const draft = state.repairDraftFromDiagnostic;
    repairForm.elements.date.value = draft.date || "";
    setBikeCodeValue("repair", draft.bike || "");
    repairForm.elements.issue.value = draft.issue || "";
    repairForm.elements.work.value = draft.work || "";
    repairForm.elements.partsUsed.value = draft.partsUsed || "";
    repairForm.elements.neededParts.value = draft.neededParts || "";
    repairForm.elements.status.value = draft.status || "В ремонте";
  } else {
    resetBikeCodeValue("repair");
  }
  repairOverlay.classList.remove("hidden");
});

closeRepairModalButton?.addEventListener("click", () => {
  repairOverlay.classList.add("hidden");
  repairForm.reset();
  resetBikeCodeValue("repair");
  delete repairForm.dataset.editId;
  state.repairDraftFromDiagnostic = null;
});

openInventoryModalButton?.addEventListener("click", () => {
  inventoryOverlay.classList.remove("hidden");
});

closeInventoryModalButton?.addEventListener("click", () => {
  inventoryOverlay.classList.add("hidden");
  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
});

openBikeModalButton?.addEventListener("click", () => {
  bikeForm?.reset();
  resetBikeCodeValue("bike");
  if (bikeModalTitle) bikeModalTitle.textContent = "Новый байк";
  delete bikeForm.dataset.editId;
  if (bikeForm) {
    bikeForm.elements.model.value = "Wenbox U2";
    bikeForm.elements.status.value = getRole() === "owner" ? "в аренде" : "на диагностике";
  }
  bikeOverlay?.classList.remove("hidden");
});

closeBikeModalButton?.addEventListener("click", () => {
  bikeOverlay?.classList.add("hidden");
  bikeForm?.reset();
  resetBikeCodeValue("bike");
  delete bikeForm.dataset.editId;
});

openDiagnosticModalButton?.addEventListener("click", () => {
  resetDiagnosticFlow();
  openDiagnosticOverlay();
});

closeDiagnosticModalButton?.addEventListener("click", () => {
  diagnosticOverlay.classList.add("hidden");
  resetDiagnosticFlow();
});
closeWorkOrderModalButton?.addEventListener("click", () => {
  workOrderOverlay?.classList.add("hidden");
});

mobileMenuToggle?.addEventListener("click", () => {
  toggleMobileMenu();
});

mobileNavOverlay?.addEventListener("click", () => {
  closeMobileMenu();
});

diagnosticBackToCategories?.addEventListener("click", () => {
  state.diagnosticFlow.category = "";
  state.diagnosticFlow.zone = "";
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.category.value = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
});

diagnosticBackToFaults?.addEventListener("click", () => {
  if (state.diagnosticFlow.category === "Пластик" && state.diagnosticFlow.zone) {
    state.diagnosticFlow.zone = "";
  }
  state.diagnosticFlow.fault = "";
  diagnosticForm.elements.fault.value = "";
  renderDiagnosticFaultGrid();
  syncDiagnosticWizard();
});

refreshButton?.addEventListener("click", async () => {
  await bootstrap();
});

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeSection = button.dataset.section;
    closeMobileMenu();
    render();
  });
});

issueChecklistBike?.addEventListener("input", (event) => {
  state.issueChecklist.bike = normalizeBikeCode(event.target.value);
  event.target.value = state.issueChecklist.bike;
  saveIssueChecklistDraft();
});

issueChecklistForm?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-checklist-item]");
  if (!checkbox) return;

  state.issueChecklist.checked[checkbox.dataset.checklistItem] = checkbox.checked;
  const items = getIssueChecklistItems();
  const isComplete = items.every((item) => Boolean(state.issueChecklist.checked[item.id]));
  if (!isComplete) {
    state.issueChecklist.completedAt = "";
  }
  saveIssueChecklistDraft();
  renderIssueChecklist();
});

issueChecklistStatus?.addEventListener("click", () => {
  const items = getIssueChecklistItems();
  const isComplete = items.every((item) => Boolean(state.issueChecklist.checked[item.id]));
  if (!isComplete) return;

  state.issueChecklist.completedAt = new Date().toLocaleString("ru-RU");
  saveIssueChecklistDraft();
  renderIssueChecklist();
});

resetIssueChecklistButton?.addEventListener("click", () => {
  resetIssueChecklistDraft();
});

printIssueChecklistButton?.addEventListener("click", () => {
  window.print();
});

window.addEventListener("resize", () => {
  if (!isMobileViewport()) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

globalSearch.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderRepairsTable();
});

statusFilter.addEventListener("change", (event) => {
  state.statusFilter = event.target.value;
  renderStatusChips();
  renderRepairsTable();
});

document.querySelectorAll("[data-status-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.statusFilter;
    statusFilter.value = state.statusFilter;
    renderStatusChips();
    renderRepairsTable();
  });
});

repairForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(repairForm);
  const editingId = repairForm.dataset.editId;
  const bikeCode = updateBikeCodeHiddenInput("repair");

  if (!isValidBikeCode(bikeCode)) {
    repairForm.reportValidity();
    return;
  }

  await api(editingId ? `/api/repairs/${editingId}` : "/api/repairs", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      date: formData.get("date") || new Date().toISOString().slice(0, 10),
      bike: bikeCode,
      issue: String(formData.get("issue")).trim(),
      work: String(formData.get("work")).trim(),
      parts_used: String(formData.get("partsUsed")).trim() || "-",
      needed_parts: String(formData.get("neededParts")).trim() || "-",
      status: String(formData.get("status")),
    }),
  });

  repairForm.reset();
  resetBikeCodeValue("repair");
  delete repairForm.dataset.editId;
  repairOverlay.classList.add("hidden");
  state.repairDraftFromDiagnostic = null;
  state.activeSection = "repairs";
  await bootstrap();
});

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(inventoryForm);
  const editingId = inventoryForm.dataset.editId;

  await api(editingId ? `/api/inventory/${editingId}` : "/api/inventory", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      name: String(formData.get("name")).trim(),
      stock: Number(formData.get("stock")),
      min: Number(formData.get("min")),
    }),
  });

  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
  inventoryOverlay.classList.add("hidden");
  state.activeSection = "inventory";
  await bootstrap();
});

bikeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(bikeForm);
  const editingId = bikeForm.dataset.editId;
  const bikeCode = updateBikeCodeHiddenInput("bike");

  if (!isValidBikeCode(bikeCode)) {
    bikeForm.reportValidity();
    return;
  }

  await api(editingId ? `/api/bikes/${editingId}` : "/api/bikes", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      code: bikeCode,
      model: String(formData.get("model")).trim() || "Wenbox U2",
      status: String(formData.get("status")).trim(),
      notes: String(formData.get("notes")).trim(),
    }),
  });

  bikeForm.reset();
  resetBikeCodeValue("bike");
  delete bikeForm.dataset.editId;
  bikeOverlay?.classList.add("hidden");
  state.activeSection = "bikes";
  await bootstrap();
});

diagnosticForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(diagnosticForm);
  const editingId = diagnosticForm.dataset.editId;
  const bikeCode = updateBikeCodeHiddenInput("diagnostic");

  if (!isValidBikeCode(bikeCode)) {
    diagnosticForm.reportValidity();
    return;
  }

  await api(editingId ? `/api/diagnostics/${editingId}` : "/api/diagnostics", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify({
      date: formData.get("date") || new Date().toISOString().slice(0, 10),
      bike: bikeCode,
      mechanicName: String(formData.get("mechanicName")).trim(),
      category: String(formData.get("category")).trim(),
      fault: String(formData.get("fault")).trim(),
      symptoms: String(formData.get("symptoms")).trim(),
      conclusion: String(formData.get("conclusion")).trim(),
      severity: "Средняя",
      recommendation: "Плановый ремонт",
      required_parts_text: String(formData.get("requiredParts")).trim(),
    }),
  });

  resetDiagnosticFlow();
  diagnosticOverlay.classList.add("hidden");
  state.activeSection = "diagnostics";
  await bootstrap();
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordError.classList.add("hidden");
  passwordMessage.classList.add("hidden");

  const formData = new FormData(passwordForm);

  try {
    const payload = await api("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword")),
        newPassword: String(formData.get("newPassword")),
      }),
    });
    passwordMessage.textContent = payload.message;
    passwordMessage.classList.remove("hidden");
    passwordForm.reset();
  } catch (error) {
    passwordError.textContent = error.message;
    passwordError.classList.remove("hidden");
  }
});

if (settingsForm) {
  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(settingsForm);
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        totalBikes: Number(formData.get("totalBikes")),
        targetRate: Number(formData.get("targetRate")),
        mechanicFocus: String(formData.get("mechanicFocus") || "").trim(),
      }),
    });
    await bootstrap();
  });
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileMessage.classList.add("hidden");

    const formData = new FormData(profileForm);
    const payload = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: String(formData.get("fullName")).trim(),
        position: String(formData.get("position")).trim(),
        phone: String(formData.get("phone")).trim(),
        telegram: String(formData.get("telegram")).trim(),
        notes: String(formData.get("notes")).trim(),
      }),
    });

    profileMessage.textContent = payload.message;
    profileMessage.classList.remove("hidden");
    await bootstrap();
  });
}

document.addEventListener("click", async (event) => {
  const dashboardPeriodTarget = event.target.closest("[data-dashboard-period]");
  if (dashboardPeriodTarget) {
    state.dashboardPeriod = dashboardPeriodTarget.dataset.dashboardPeriod;
    renderMetrics();
    return;
  }

  const dashboardCardTarget = event.target.closest("[data-dashboard-card]");
  if (dashboardCardTarget) {
    const nextKey = dashboardCardTarget.dataset.dashboardCard;
    state.dashboardExpanded = state.dashboardExpanded === nextKey ? "" : nextKey;
    renderMetrics();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (!target) return;

  const id = target.dataset.id;
  const action = target.dataset.action;

  if (action === "edit-repair") {
    const repair = state.repairs.find((item) => String(item.id) === id);
    if (!repair) return;
    state.repairDraftFromDiagnostic = null;
    repairForm.dataset.editId = id;
    repairForm.elements.date.value = repair.date;
    setBikeCodeValue("repair", repair.bike);
    repairForm.elements.issue.value = repair.issue;
    repairForm.elements.work.value = repair.work;
    repairForm.elements.partsUsed.value = repair.parts_used;
    repairForm.elements.neededParts.value = repair.needed_parts;
    repairForm.elements.status.value = repair.status;
    repairOverlay.classList.remove("hidden");
  }

  if (action === "delete-repair") {
    if (!window.confirm("Удалить эту запись ремонта?")) return;
    await api(`/api/repairs/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "edit-inventory") {
    const item = state.inventory.find((entry) => String(entry.id) === id);
    if (!item) return;
    inventoryForm.dataset.editId = id;
    inventoryForm.elements.name.value = item.name;
    inventoryForm.elements.stock.value = item.stock;
    inventoryForm.elements.min.value = item.min;
    inventoryOverlay.classList.remove("hidden");
  }

  if (action === "delete-inventory") {
    if (!window.confirm("Удалить эту складскую позицию?")) return;
    await api(`/api/inventory/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "edit-diagnostic") {
    const item = state.diagnostics.find((entry) => String(entry.id) === id);
    if (!item) return;
    const plasticParts =
      item.category === "Пластик" && String(item.fault || "").includes(" · ")
        ? String(item.fault || "").split(" · ")
        : [];
    state.diagnosticFlow.mode = "edit";
    state.diagnosticFlow.category = item.category || "";
    state.diagnosticFlow.zone = plasticParts[0] || "";
    state.diagnosticFlow.fault = item.fault || "";
    diagnosticForm.dataset.editId = id;
    diagnosticForm.elements.date.value = item.date;
    setBikeCodeValue("diagnostic", item.bike);
    diagnosticForm.elements.mechanicName.value = item.mechanic_name;
    diagnosticForm.elements.category.value = item.category || "";
    diagnosticForm.elements.fault.value = item.fault || "";
    diagnosticForm.elements.symptoms.value = item.symptoms;
    diagnosticForm.elements.conclusion.value = item.conclusion;
    openDiagnosticOverlay();
  }

  if (action === "delete-diagnostic") {
    if (!window.confirm("Удалить эту диагностическую запись?")) return;
    await api(`/api/diagnostics/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "create-repair-from-diagnostic") {
    const item = state.diagnostics.find((entry) => String(entry.id) === id);
    if (!item) return;
    const issueParts = [item.category, item.fault].filter(Boolean);
    state.repairDraftFromDiagnostic = {
      date: item.date,
      bike: item.bike,
      issue: issueParts.length ? issueParts.join(" · ") : item.symptoms,
      work: item.conclusion,
      partsUsed: "-",
      neededParts: item.recommendation === "Срочный ремонт" ? "Уточнить после ремонта" : "-",
      status: item.recommendation === "Снять с линии" ? "Ожидает запчасти" : "В ремонте",
    };
    state.activeSection = "repairs";
    render();
    repairForm.reset();
    repairForm.elements.date.value = state.repairDraftFromDiagnostic.date || "";
    setBikeCodeValue("repair", state.repairDraftFromDiagnostic.bike || "");
    repairForm.elements.issue.value = state.repairDraftFromDiagnostic.issue || "";
    repairForm.elements.work.value = state.repairDraftFromDiagnostic.work || "";
    repairForm.elements.partsUsed.value = state.repairDraftFromDiagnostic.partsUsed || "";
    repairForm.elements.neededParts.value = state.repairDraftFromDiagnostic.neededParts || "";
    repairForm.elements.status.value = state.repairDraftFromDiagnostic.status || "В ремонте";
    repairOverlay.classList.remove("hidden");
  }

  if (action === "edit-bike") {
    const bike = state.bikes.find((entry) => String(entry.id) === id);
    if (!bike || !bikeForm) return;
    bikeForm.dataset.editId = id;
    if (bikeModalTitle) bikeModalTitle.textContent = "Редактирование байка";
    setBikeCodeValue("bike", bike.code);
    bikeForm.elements.model.value = bike.model || "Wenbox U2";
    bikeForm.elements.status.value = bike.status || (getRole() === "owner" ? "в аренде" : "на диагностике");
    bikeForm.elements.notes.value = bike.notes || "";
    bikeOverlay?.classList.remove("hidden");
  }

  if (action === "save-bike-status") {
    const bike = state.bikes.find((entry) => String(entry.id) === id);
    const statusSelect = document.querySelector(`[data-bike-status-id="${id}"]`);
    if (!bike || !statusSelect) return;
    await api(`/api/bikes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        code: bike.code,
        model: bike.model || "Wenbox U2",
        status: String(statusSelect.value).trim(),
        notes: bike.notes || "",
      }),
    });
    await bootstrap();
  }

  if (action === "delete-bike") {
    if (!window.confirm("Удалить этот байк из парка? Связанные активные заявки по нему тоже будут удалены.")) return;
    await api(`/api/bikes/${id}`, { method: "DELETE", headers: {} });
    await bootstrap();
  }

  if (action === "open-work-order") {
    const order = state.workOrders.find((entry) => String(entry.id) === id);
    if (!order) return;
    openWorkOrderDetail(order);
    return;
  }

  if (action.startsWith("work-order-")) {
    const actionMap = {
      "work-order-start": "start_repair",
      "work-order-ready": "mark_ready",
    };
    if (action === "work-order-start") {
      await ensureNotificationPermission();
    }
    await api(`/api/work-orders/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ action: actionMap[action] }),
    });
    await bootstrap();
  }

  if (action === "start-diagnostic-category") {
    resetDiagnosticFlow();
    chooseDiagnosticCategory(target.dataset.category);
    openDiagnosticOverlay();
  }

  if (action === "select-diagnostic-zone") {
    chooseDiagnosticZone(target.dataset.zone);
  }

  if (action === "select-diagnostic-fault") {
    chooseDiagnosticFault(target.dataset.fault);
  }
});

syncBikeCodeBuilders();
window.setInterval(refreshRepairTimers, 1000);
loadIssueChecklistDraft();
bootstrap();
