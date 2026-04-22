const state = {
  user: null,
  activeSection: "overview",
  navHistory: [],
  search: "",
  statusFilter: "all",
  dashboardPeriod: "today",
  dashboardExpanded: "repair",
  bikeSearch: "",
  bikeStatusFilter: "all",
  queueFilter: "all",
  inventorySearch: "",
  inventoryActiveGroup: "",
  teamChat: [],
  telegramTransport: { state: "disabled", label: "Telegram: off" },
  ownerNotifications: [],
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
    pendingWorkOrderId: "",
  },
  repairDraftFromDiagnostic: null,
  diagnosticFlow: {
    mode: "create",
    category: "",
    zone: "",
    fault: "",
  },
  diagnosticQuickFlow: {
    step: 1,
    category: "",
    fault: "",
    criticality: "",
    selectedParts: [],
    selectedPartsCategory: "",
    decision: "",
    queueReason: "",
    photos: [],
  },
  repairTemplates: [],
  repairTimerInterval: null,
  diagnosticStartedAt: null,
};

const repairDeadlineNotifications = new Set();
const repairAlerts = document.createElement("div");
repairAlerts.className = "repair-alerts";
document.body.appendChild(repairAlerts);

const DIAGNOSTIC_LIBRARY = {
  "Пластик": {
    summary: "Обвес, крышки, внешние элементы корпуса",
    zones: [
      "Сабля левая",
      "Сабля правая",
      "Передний щиток",
      "Дека для ног",
      "Порог левый",
      "Порог правый",
      "Корпус слева",
      "Корпус справа",
      "Корпус центр",
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
      "Поврежден рычаг тормоза",
      "Не работает кнопка включения",
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
      "Спускает колесо",
      "Изношена покрышка",
      "Деформация диска",
      "Люфт колеса",
      "Проблема с подшипником",
    ],
  },
  "Подвеска": {
    summary: "Вилка, амортизаторы, люфты и герметичность",
    faults: [
      "Амортизатор не прожимается",
      "Пробой амортизатора (болтается)",
      "Люфт подвески",
      "Вилка кривая (повело)",
      "Подтек масла",
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

/** Подсказки по запчастям для автоподстановки в диагностике (ключ — полное имя поломки или хвост после « · »). */
const DIAGNOSTIC_FAULT_PARTS_HINT = {
  Трещина: "Клей/крепёж для пластика:1",
  Скол: "Локальная покраска/пластик:1",
  "Полностью сломано": "Пластик узла:1",
  "Отсутствует деталь": "Пластик узла:1",
  "Люфт рулевой": "Подшипник рулевой колонки:1",
  "Руль стоит криво": "Крепёж руля/хомут:1",
  "Тугой поворот руля": "Подшипники рулевой/смазка:1",
  "Не работает ручка газа": "Ручка газа/датчик:1",
  "Заедает ручка газа": "Ручка газа/трос/смазка:1",
  "Поврежден рычаг тормоза": "Рычаг тормоза:1",
  "Не работает кнопка включения": "Кнопка питания:1",
  "Люфт ручек": "Ручки/фиксаторы:1",
  "Повреждена ручка": "Ручка:1",
  "Скрип тормоза": "Колодки:1",
  "Стерты колодки": "Колодки:1",
  "Кривой тормозной диск": "Диск тормозной:1",
  "Не тормозит передний тормоз": "Колодки перед:1, колодки передние:1",
  "Не тормозит задний тормоз": "Колодки зад:1",
  "Закис суппорт": "Суппорт/направляющие:1",
  "Диск трет": "Диск тормозной:1",
  "Не возвращается ручка тормоза": "Пружина/трос тормоза:1",
  Прокол: "Камера:1, покрышка:1",
  "Спускает колесо": "Камера:1, ниппель:1",
  "Изношена покрышка": "Покрышка:1",
  "Боковой порез": "Покрышка:1",
  "Деформация диска": "Обод/диск:1",
  "Люфт колеса": "Подшипник ступицы:1",
  "Биение колеса": "Спицы/обод:1",
  "Поврежден ниппель": "Ниппель:1",
  "Проблема с подшипником": "Подшипник ступицы:1",
  "Амортизатор не прожимается": "Амортизатор:1",
  "Пробой амортизатора (болтается)": "Амортизатор:1, втулки амортизатора:1",
  "Люфт подвески": "Втулки/подшипники подвески:1",
  "Вилка кривая (повело)": "Вилка:1",
  "Подтек масла": "Сальники вилки/масло:1",
  "Не тянет мотор": "Проверка контроллера/мотора:1",
  "Рывки при разгоне": "Контроллер/датчики:1",
  "Посторонний шум мотора": "Мотор/крепёж:1",
  "Мотор не включается": "Контроллер/проводка:1",
  "Перегрев мотора": "Охлаждение/нагрузка:1",
  "Ошибка по мотору": "Диагностика контроллера:1",
  "Повышенная вибрация": "Крепёж мотора/колёс:1",
  "Батарея не заряжается": "Зарядка/порт/БМС:1",
  "Быстро теряет заряд": "Аккумулятор/BMS:1",
  "Батарея не фиксируется": "Крепёж АКБ:1",
  "Батарея не определяется": "Разъём АКБ/BMS:1",
  "Ошибка BMS": "BMS/балансировка:1",
  "Перегрев батареи": "BMS/контакты:1",
  "Зарядный порт поврежден": "Порт зарядки:1",
  "Не работает зарядное устройство": "Зарядное устройство:1",
  "Окисление контактов батареи": "Контакты/разъёмы:1",
  "Просадка напряжения": "АКБ/ячейки:1",
  "Не включается байк": "Питание/предохранитель:1",
  "Ошибка контроллера": "Контроллер:1",
  "Пропадает питание": "Проводка/разъёмы:1",
  "Повреждена проводка": "Проводка/изоляция:1",
  "Окисление разъемов": "Разъёмы/контакты:1",
  Замыкание: "Проводка/изоляция:1",
  "Нестабильная работа": "Контроллер/проводка:1",
  "Ошибка датчиков": "Датчики/разъёмы:1",
  "Не работает панель управления": "Дисплей/проводка:1",
  "Не работает передняя фара": "Фара перед:1",
  "Не работает задний фонарь": "Фонарь зад:1",
  "Не работает стоп-сигнал": "Стоп-сигнал:1",
  "Не работает сигнал": "Сигнал:1",
  "Мигает свет": "Реле/контакт:1",
  "Плохой контакт по освещению": "Разъёмы/проводка:1",
};

function lookupFaultPartsHint(faultResolved) {
  if (!faultResolved) return "";
  if (DIAGNOSTIC_FAULT_PARTS_HINT[faultResolved]) return DIAGNOSTIC_FAULT_PARTS_HINT[faultResolved];
  const tail = faultResolved.split(" · ").pop()?.trim();
  if (tail && DIAGNOSTIC_FAULT_PARTS_HINT[tail]) return DIAGNOSTIC_FAULT_PARTS_HINT[tail];
  return "";
}

function getOrderComplexityTone(order) {
  const faultRaw = String(order.fault || "").trim();
  const issueRaw = String(order.issue || "").trim();
  const faultText = faultRaw.toLowerCase();
  const issueText = issueRaw.toLowerCase();
  const haystack = `${faultText} ${issueText}`;
  const hasUnknownFault =
    !faultRaw ||
    /неизвестн|не\s*известн|непонятн|не\s*понятн|не\s*ясн|уточнить\s+после|нужна\s+углубленн|без\s+осмотр|не\s*определ/i.test(
      haystack
    );
  const waitingParts = Boolean(order.missing_parts?.length) || order.status === "ждет запчасти";
  if (hasUnknownFault) return "is-red";
  if (waitingParts) return "is-yellow";
  return "is-green";
}

/** «Движение» по ETA / плану времени для ремонта «в работе». */
function getRepairStaleness(order) {
  if (order.status !== "в ремонте" || !order.started_at) return null;
  const now = Date.now();
  const eta = order.estimated_ready_at ? new Date(order.estimated_ready_at).getTime() : null;
  if (eta && now > eta) return "overdue";
  const started = new Date(order.started_at).getTime();
  const mins = Number(order.estimated_minutes || 0);
  const plannedMs = mins > 0 ? mins * 60 * 1000 : 36 * 60 * 60 * 1000;
  if (now > started + plannedMs * 1.5) return "long";
  return null;
}

function priorityTier(order) {
  if (String(order.priority || "").toLowerCase() === "высокий") return -1;
  const waiting = order.status === "ждет запчасти" || (order.missing_parts?.length > 0);
  if (waiting) return 0;
  if (order.status === "в ремонте") {
    const st = getRepairStaleness(order);
    if (st === "overdue") return 1;
    if (st === "long") return 2;
    if (getOrderComplexityTone(order) === "is-red") return 3;
    return 4;
  }
  if (getOrderComplexityTone(order) === "is-red") return 5;
  return 6;
}

function priorityIntakeTs(order) {
  const d = order.intake_date || order.created_at;
  return d ? new Date(d).getTime() : 0;
}

function getRepairPriorityLabel(order) {
  if (String(order.priority || "").toLowerCase() === "высокий") {
    return order.owner_note ? `Приоритет владельца: ${order.owner_note}` : "Приоритет владельца";
  }
  if (order.status === "ждет запчасти" || order.missing_parts?.length) return "Ждёт запчасти";
  if (order.status === "в ремонте") {
    const st = getRepairStaleness(order);
    if (st === "overdue") return "Просрочка по ETA";
    if (st === "long") return "Долго в работе";
  }
  if (getOrderComplexityTone(order) === "is-red") return "Сложный кейс";
  return order.status || "В очереди";
}

function getPriorityNextOrders() {
  const open = (state.workOrders || []).filter((o) => o.status !== "готов");
  return open
    .map((order) => ({ order, tier: priorityTier(order), intake: priorityIntakeTs(order) }))
    .sort((a, b) => a.tier - b.tier || a.intake - b.intake)
    .slice(0, 3)
    .map((x) => x.order);
}

function matchesQueueFilter(order) {
  const f = state.queueFilter || "all";
  if (f === "all") return true;
  if (f === "in_repair") return order.status === "в ремонте";
  if (f === "waiting_parts") return order.status === "ждет запчасти" || (order.missing_parts?.length > 0);
  if (f === "complex") return getOrderComplexityTone(order) === "is-red";
  return true;
}

function applyDiagnosticFaultSuggestions(category, faultResolved) {
  if (!diagnosticForm) return;
  const cfg = DIAGNOSTIC_LIBRARY[category];
  const summary = cfg?.summary || "";
  diagnosticForm.elements.symptoms.value = [
    `Узел: ${category}.`,
    `Выявлено: ${faultResolved}.`,
    summary ? `Контекст: ${summary}.` : "",
    "Внешний осмотр, проверка безопасности перед работами.",
  ]
    .filter(Boolean)
    .join(" ");
  diagnosticForm.elements.conclusion.value = [
    "План работ: осмотр узла → при необходимости снятие → замена/ремонт → контрольная проверка (тормоза/руль/ходовая по ситуации).",
    `Предварительно: ${faultResolved} в зоне «${category}».`,
    "Рекомендуется: снять/заменить/подтянуть после проверки комплектности запчастей и согласования срока.",
    "Серьёзность: уточнить при разборе.",
  ].join(" ");
  diagnosticForm.elements.requiredParts.value = lookupFaultPartsHint(faultResolved);
}

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
const CHAT_LAST_READ_STORAGE_KEY = "bikeberi.teamChatLastReadAt.v1";
const TEAM_CHAT_POLL_INTERVAL_MS = 5000;
let teamChatPollInFlight = false;
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
const globalSearch = document.getElementById("global-search");
const statusFilter = document.getElementById("status-filter");
const metricsGrid = document.getElementById("metrics-grid");
const timeline = document.getElementById("timeline");
const alertsList = document.getElementById("alerts-list");
const bikeStatuses = document.getElementById("bike-statuses");
const eventsFeed = document.getElementById("events-feed");
const repairsTable = document.getElementById("repairs-table");
const diagnosticsGrid = document.getElementById("diagnostics-grid");
const diagnosticCategoryGrid = document.getElementById("diagnostic-category-grid");
const inventoryGrid = document.getElementById("inventory-grid");
const inventorySearchInput = document.getElementById("inventory-search");
const bikeSearchInput = document.getElementById("bike-search");
const bikeFilterChips = document.getElementById("bike-filter-chips");
const bikesTable = document.getElementById("bikes-table");
const BIKE_ROW_ICON_HTML =
  '<img class="bike-row-icon" src="/bike-scooter.svg" width="48" height="27" alt="" decoding="async" loading="lazy" />';
const bikeRepairHistory = document.getElementById("bike-repair-history");
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
const ownerNotificationsEl = document.getElementById("owner-notifications");
const ownerProcess = document.getElementById("owner-process");
const ownerPriorityForm = document.getElementById("owner-priority-form");
const teamChatForm = document.getElementById("team-chat-form");
const teamChatList = document.getElementById("team-chat-list");
const chatUnreadBadges = Array.from(document.querySelectorAll("[data-chat-unread-badge]"));
const currentUser = document.getElementById("current-user");
const sidebarRoleTitle = document.getElementById("sidebar-role-title");
const topbarRolePill = document.getElementById("topbar-role-pill");
const telegramTransportPill = document.getElementById("telegram-transport-pill");
const mechanicDayFocus = document.getElementById("mechanic-day-focus");
const openChatButton = document.getElementById("open-chat-button");
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
const profileOpenPasswordButton = document.getElementById("profile-open-password");
const logoutButton = document.getElementById("logout-button");
const repairOverlay = document.getElementById("repair-overlay");
const inventoryOverlay = document.getElementById("inventory-overlay");
const bikeOverlay = document.getElementById("bike-overlay");
const openRepairModalButton = document.getElementById("open-repair-modal");
const closeRepairModalButton = document.getElementById("close-repair-modal");
const openInventoryModalButton = document.getElementById("open-inventory-modal");
const closeInventoryModalButton = document.getElementById("close-inventory-modal");
const inventoryCategoryEditor = document.getElementById("inventory-category-editor");
const inventoryCurrentCategory = document.getElementById("inventory-current-category");
const inventoryTransferToggle = document.getElementById("inventory-transfer-toggle");
const inventoryTransferOptions = document.getElementById("inventory-transfer-options");
const inventoryDeleteInModal = document.getElementById("inventory-delete-in-modal");
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
const dashboardJumpOverlay = document.getElementById("dashboard-jump-overlay");
const closeDashboardJumpModalButton = document.getElementById("close-dashboard-jump-modal");
const dashboardJumpTitle = document.getElementById("dashboard-jump-title");
const dashboardJumpList = document.getElementById("dashboard-jump-list");
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
const diagnosticQuickWizard = document.getElementById("diagnostic-quick-wizard");
const diagnosticQuickProgressText = document.getElementById("diagnostic-quick-progress-text");
const diagnosticQuickProgressCounter = document.getElementById("diagnostic-quick-progress-counter");
const diagnosticQuickProgressFill = document.getElementById("diagnostic-quick-progress-fill");
const diagnosticQuickTitle = document.getElementById("diagnostic-quick-title");
const diagnosticQuickSubtitle = document.getElementById("diagnostic-quick-subtitle");
const diagnosticQuickOptions = document.getElementById("diagnostic-quick-options");
const diagnosticQuickStepQuestion = document.getElementById("diagnostic-quick-step-question");
const diagnosticQuickStepSummary = document.getElementById("diagnostic-quick-step-summary");
const diagnosticQuickSummaryCard = document.getElementById("diagnostic-quick-summary-card");
const diagnosticQuickBack = document.getElementById("diagnostic-quick-back");
const diagnosticQuickDelete = document.getElementById("diagnostic-quick-delete");
const diagnosticQuickNext = document.getElementById("diagnostic-quick-next");
const diagnosticQuickSaveOpen = document.getElementById("diagnostic-quick-save-open");
const diagnosticQuickError = document.getElementById("diagnostic-quick-error");
const refreshButton = document.getElementById("refresh-button");
const queueFilterChipsEl = document.getElementById("queue-filter-chips");
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
  const bikeValidityMessage = valid ? "" : "Укажи номер байка в формате РЕ123У";
  if (visibleInput) {
    visibleInput.value = bikeCode;
    // Hidden inputs are excluded from constraint validation; validity must be on the visible field
    // or reportValidity() does nothing and submit handlers return without saving (no API error).
    visibleInput.setCustomValidity(bikeValidityMessage);
    const shouldShowError = Boolean(bikeCode) && ((visibleInput.dataset.touched === "true" && !valid) || (complete && !valid));
    builder.classList.toggle("is-invalid", shouldShowError);
  }
  if (hiddenInput) {
    hiddenInput.value = complete ? bikeCode : "";
    hiddenInput.setCustomValidity("");
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
      pendingWorkOrderId: String(parsed.pendingWorkOrderId || ""),
    };
  } catch (error) {
    state.issueChecklist = {
      bike: "",
      checked: {},
      completedAt: "",
      pendingWorkOrderId: "",
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
    pendingWorkOrderId: "",
  };
  saveIssueChecklistDraft();
  renderIssueChecklist();
}

function startIssueChecklistForOrder(order) {
  if (!order) return;
  state.issueChecklist = {
    bike: String(order.bike_code || "").trim(),
    checked: {},
    completedAt: "",
    pendingWorkOrderId: String(order.id || ""),
  };
  saveIssueChecklistDraft();
  state.activeSection = "issue-checklist";
  render();
}

function renderIssueChecklist() {
  if (!issueChecklistGroups) return;

  const items = getIssueChecklistItems();
  const checkedCount = items.filter((item) => Boolean(state.issueChecklist.checked[item.id])).length;
  const totalCount = items.length;
  const percent = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isComplete = totalCount > 0 && checkedCount === totalCount;
  const hasPending = Boolean(state.issueChecklist.pendingWorkOrderId);

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
    issueChecklistStatus.className = `issue-checklist-status ${isComplete && hasPending ? "is-ready" : "is-blocked"}`;
    issueChecklistStatus.disabled = !isComplete || !hasPending;
    issueChecklistStatus.textContent = state.issueChecklist.completedAt
      ? "Выдача подтверждена"
      : hasPending
        ? "Подтвердить выдачу"
        : "Нет активной выдачи";
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
  const { notifyError, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
      credentials: "same-origin",
      ...fetchOptions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Сеть недоступна";
    if (notifyError) window.alert(message);
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && payload.error
        ? payload.error
        : typeof payload === "string" && payload.trim()
          ? payload.trim()
        : "Ошибка запроса";
    if (notifyError) window.alert(message);
    throw new Error(message);
  }

  return payload;
}

function getRole() {
  return state.user?.role || "mechanic";
}

// ─── iOS-style navigation ─────────────────────────────────────────────────────

const ROOT_SECTIONS = new Set(["overview", "repairs", "inventory", "chat", "owner"]);

function navigateTo(section, { direction = "forward", replace = false } = {}) {
  const from = state.activeSection;
  if (from === section) return;

  if (!replace && direction === "forward" && !ROOT_SECTIONS.has(section)) {
    state.navHistory.push(from);
  } else if (direction === "back") {
    // nothing to push — going back
  } else if (ROOT_SECTIONS.has(section)) {
    // switching to a root tab — clear history
    state.navHistory = [];
  }

  state.activeSection = section;
  renderSectionHeader();
  animateSectionTransition(direction);
  renderSections();
  updateBackBtn();
}

function navigateBack() {
  if (!state.navHistory.length) return;
  const prev = state.navHistory.pop();
  navigateTo(prev, { direction: "back" });
}

function updateBackBtn() {
  const btn = document.getElementById("topbar-back-btn");
  const menuToggle = document.getElementById("mobile-menu-toggle");
  if (!btn) return;
  const hasHistory = state.navHistory.length > 0;
  btn.classList.toggle("hidden", !hasHistory);
  if (menuToggle) menuToggle.classList.toggle("hidden", hasHistory);
}

function animateSectionTransition(direction) {
  const activeEl = document.querySelector(`#section-${state.activeSection}`);
  if (!activeEl) return;
  const cls = direction === "back" ? "slide-in-left" : "slide-in-right";
  activeEl.classList.remove("slide-in-left", "slide-in-right");
  // force reflow
  void activeEl.offsetWidth;
  activeEl.classList.add(cls);
  activeEl.addEventListener("animationend", () => activeEl.classList.remove(cls), { once: true });
}

// Back button click
document.getElementById("topbar-back-btn")?.addEventListener("click", navigateBack);

// iOS-style swipe from left edge to go back
(function initSwipeBack() {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  document.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    if (touch.clientX < 30) {
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);
    // cancel if mostly vertical
    if (dy > dx) tracking = false;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    if (dx > 70 && state.navHistory.length > 0) {
      navigateBack();
    }
  }, { passive: true });
})();

function getRoleLabel(role = getRole()) {
  return role === "owner" ? "Управляющий" : "Механик";
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
      ["принят", "Принят"],
      ["ждет запчасти", "Ждет запчасти"],
      ["в ремонте", "В ремонте"],
      ["проверка", "На выдаче"],
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
      details: "",
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
    details: "",
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
    const plan = String(order.planned_work ?? "").trim();
    workOrderDetailHint.textContent = plan || "—";
  }

  // Repair timer (active repair)
  const timerBlock = document.getElementById("repair-timer-block");
  const pauseBlock = document.getElementById("pause-repair-block");
  const isActive = order.status === "в ремонте" && order.started_at;
  const isPaused = order.status === "приостановлен";

  if (timerBlock) {
    timerBlock.classList.toggle("hidden", !isActive);
    if (isActive) {
      timerBlock.dataset.orderId = order.id;
      timerBlock.dataset.startedAt = order.started_at;
      const actualEl = timerBlock.querySelector(".repair-timer-actual");
      if (actualEl && order.actual_minutes) {
        actualEl.textContent = `Сохранено: ${order.actual_minutes} мин`;
        actualEl.classList.remove("hidden");
      } else if (actualEl) {
        actualEl.classList.add("hidden");
      }
      // Store order id on pause button
      timerBlock.querySelector(".repair-pause-btn")?.setAttribute("data-order-id", order.id);
      startRepairTimer(order.id, order.started_at);
    } else {
      stopRepairTimer();
    }
  }

  if (pauseBlock) {
    pauseBlock.classList.toggle("hidden", !isPaused);
    if (isPaused) {
      pauseBlock.dataset.orderId = order.id;
      const reasonEl = document.getElementById("pause-info-reason");
      const minutesEl = document.getElementById("pause-info-minutes");
      if (reasonEl) reasonEl.textContent = order.pause_reason || "не указана";
      if (minutesEl) minutesEl.textContent = order.actual_minutes ? `${order.actual_minutes} мин` : "нет данных";
    }
  }

  workOrderOverlay.classList.remove("hidden");
}

function getDashboardJumpPayload(jump) {
  const bikeIdByCode = (code) =>
    (state.bikes || []).find((b) => String(b.code || "").trim() === String(code || "").trim())?.id || "";

  if (jump === "ready") {
    const rows = (state.bikes || [])
      .filter((b) => b.status === "готов")
      .map((b) => {
        const lastOrder = (state.workOrders || [])
          .filter((o) => String(o.bike_code || "").trim() === String(b.code || "").trim())
          .sort((a, z) => (z.completed_at || z.created_at || "").localeCompare(a.completed_at || a.created_at || ""))[0];
        const detail = lastOrder ? (lastOrder.fault || lastOrder.issue || "Ремонт завершён") : "Готов к выдаче";
        const completedAt = lastOrder?.completed_at ? new Date(lastOrder.completed_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        return { bike: b.code, text: completedAt ? `${detail} · ${completedAt}` : detail, bikeId: b.id };
      });
    return { title: "✅ Готовы к выдаче", rows };
  }

  if (jump === "repair") {
    const rows = (state.workOrders || [])
      .filter((o) => o.status === "в ремонте")
      .map((o) => {
        const startedAt = o.started_at ? new Date(o.started_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        return {
          bike: o.bike_code || "-",
          text: [o.fault || o.issue, startedAt ? `с ${startedAt}` : ""].filter(Boolean).join(" · "),
          orderId: o.id,
        };
      });
    return { title: "🔧 В ремонте сейчас", rows };
  }

  if (jump === "in-diagnostics") {
    const rows = (state.bikes || [])
      .filter((b) => b.status === "на диагностике")
      .map((b) => {
        const lastDiag = (state.diagnostics || [])
          .filter((d) => String(d.bike || "").trim() === String(b.code || "").trim())
          .sort((a, z) => (z.date || "").localeCompare(a.date || ""))[0];
        const detail = lastDiag ? [lastDiag.category, lastDiag.fault].filter(Boolean).join(" · ") || "Диагностика" : "На диагностике";
        return { bike: b.code, text: detail, bikeId: b.id };
      });
    return { title: "🔍 На диагностике", rows };
  }

  if (jump === "diagnostics") {
    const periodLabel = { today: "сегодня", yesterday: "вчера", week: "7 дней", month: "30 дней" }[state.dashboardPeriod] || "период";
    const allDiags = [...(state.diagnostics || [])]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const inPeriod = allDiags.filter((item) => isDateInDashboardPeriod(item.date));
    const source = inPeriod.length ? inPeriod : allDiags.slice(0, 20);
    const rows = source.map((item) => ({
      bike: item.bike || "-",
      text: [item.category, item.fault].filter(Boolean).join(" · ") || "Поломка не указана",
      diagId: item.id,
    }));
    return { title: inPeriod.length ? `Диагностика за ${periodLabel}` : "Все диагностики", rows };
  }

  if (jump === "accepted") {
    const rows = (state.workOrders || [])
      .filter((o) => o.status === "принят")
      .map((o) => ({
        bike: o.bike_code || "-",
        text: [o.fault || o.issue, o.priority !== "обычный" ? `⚡ ${o.priority}` : ""].filter(Boolean).join(" · "),
        orderId: o.id,
      }));
    return { title: "📋 Принят в работу", rows };
  }

  if (jump === "inspection") {
    const rows = (state.workOrders || [])
      .filter((o) => o.status === "проверка")
      .map((o) => ({
        bike: o.bike_code || "-",
        text: o.fault || o.issue || "Финальная проверка",
        orderId: o.id,
      }));
    return { title: "🔎 На проверке", rows };
  }

  if (jump === "waiting-parts") {
    const rows = (state.workOrders || [])
      .filter((o) => o.status === "ждет запчасти")
      .map((o) => ({
        bike: o.bike_code || "-",
        text: o.missing_parts?.length
          ? "Нет: " + o.missing_parts.map((p) => p.name).join(", ")
          : "Ожидает комплектность",
        orderId: o.id,
      }));
    return { title: "⏳ Ждут запчасти", rows };
  }

  if (jump === "rented") {
    const rows = (state.bikes || [])
      .filter((b) => b.status === "в аренде")
      .map((b) => ({ bike: b.code, text: b.model || "Wenbox U2", bikeId: b.id }));
    return { title: "🛴 В аренде", rows };
  }

  if (jump === "paused") {
    const rows = (state.workOrders || [])
      .filter((o) => o.status === "приостановлен")
      .map((o) => ({
        bike: o.bike_code || "-",
        text: [
          o.fault || o.issue,
          o.actual_minutes ? `${o.actual_minutes} мин` : null,
          o.pause_reason ? `«${o.pause_reason}»` : null,
        ].filter(Boolean).join(" · "),
        orderId: o.id,
      }));
    return { title: "⏸ Приостановленные ремонты", rows };
  }

  return { title: "Нет данных", rows: [] };
}

function openDashboardJumpModal(jump) {
  if (!dashboardJumpOverlay || !dashboardJumpList) return;
  const payload = getDashboardJumpPayload(jump);
  if (dashboardJumpTitle) dashboardJumpTitle.textContent = payload.title;
  dashboardJumpList.innerHTML = payload.rows.length
    ? payload.rows
        .map((row) => {
          const clickable = row.orderId || row.bikeId || row.diagId;
          const action = row.orderId ? "open-dashboard-order" : row.diagId ? "open-dashboard-diag" : "open-dashboard-bike";
          const dataId = row.orderId || row.diagId || row.bikeId || "";
          return `
            <article class="jump-list-row ${clickable ? "jump-list-row-clickable" : ""}" ${clickable ? `data-action="${action}" data-id="${dataId}"` : ""}>
              <div class="jump-list-row-code">${escapeHtml(row.bike)}</div>
              <div class="jump-list-row-text muted">${escapeHtml(row.text)}</div>
              ${clickable ? `<span class="jump-list-row-arrow">›</span>` : ""}
            </article>
          `;
        })
        .join("")
    : '<p class="muted" style="padding:20px 16px">Нет байков в этом статусе.</p>';
  dashboardJumpOverlay.classList.remove("hidden");
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
  const diagnosedInPeriod = (state.diagnostics || []).filter(
    (item) => isDateInDashboardPeriod(item.date)
  ).length;

  const ordersInPeriod = (state.workOrders || []).filter((item) =>
    isDateInDashboardPeriod(item.intake_date || item.started_at || item.created_at)
  );

  const inRepairNow = (state.workOrders || []).filter((item) => item.status === "в ремонте").length;
  const waitingPartsNow = (state.workOrders || []).filter((item) => item.status === "ждет запчасти").length;
  const inspectionNow = (state.workOrders || []).filter((item) => item.status === "проверка" || item.status === "диагностика").length;

  const intakeInPeriod = ordersInPeriod.length;
  const waitingPartsInPeriod = ordersInPeriod.filter((item) => item.status === "ждет запчасти").length;
  const startedInPeriod = ordersInPeriod.filter((item) => Boolean(item.started_at)).length;

  return {
    diagnosedInPeriod,
    intakeInPeriod,
    startedInPeriod,
    inRepairNow,
    inspectionNow,
    waitingPartsNow,
    waitingPartsInPeriod,
  };
}

function renderSectionHeader() {
  const sectionMeta = {
    overview: { title: "Дашборд" },
    bikes: { title: "Парк" },
    profile: { title: "Профиль" },
    chat: { title: "Чат" },
    diagnostics: { title: "Диагностика" },
    repairs: { title: "Очередь" },
    "issue-checklist": { title: "Выдача" },
    inventory: { title: "Склад" },
    owner: { title: "Показатели" },
    "knowledge-base": { title: "Учебник — Wenbox U2" },
  };
  const meta = sectionMeta[state.activeSection] || sectionMeta.overview;
  pageTitle.textContent = meta.title;
}

function renderRoleContent() {
  const ownerMode = getRole() === "owner";
  const roleLabel = getRoleLabel();

  if (sidebarRoleTitle) {
    sidebarRoleTitle.textContent = roleLabel;
  }
  if (topbarRolePill) {
    topbarRolePill.textContent = roleLabel.toLowerCase();
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

function renderTelegramTransport() {
  if (!telegramTransportPill) return;
  const transport = state.telegramTransport || {};
  const transportState = String(transport.state || "disabled").trim() || "disabled";
  const label = String(transport.label || "Telegram: off").trim() || "Telegram: off";
  telegramTransportPill.textContent = label;
  telegramTransportPill.classList.remove("is-ok", "is-degraded", "is-disabled", "is-checking");
  const cls =
    transportState === "ok"
      ? "is-ok"
      : transportState === "degraded"
        ? "is-degraded"
        : transportState === "checking"
          ? "is-checking"
          : "is-disabled";
  telegramTransportPill.classList.add(cls);
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
  profileRoleDisplay.textContent = getRoleLabel();
  profilePhoneDisplay.textContent = state.user.phone || "Не заполнен";
  profileTelegramDisplay.textContent = state.user.telegram || "Не заполнен";
  profilePositionDisplay.textContent = state.user.position || getRoleLabel();

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

  document.querySelectorAll(".mobile-tab").forEach((button) => {
    if (button.classList.contains("mobile-tab-cta")) {
      button.classList.remove("is-active");
      return;
    }
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

function renderMechanicDayFocus() {
  if (!mechanicDayFocus) return;
  const focus = String(state.kpi.mechanicFocus || "").trim();
  const shouldShow = getRole() === "mechanic" && Boolean(focus);
  mechanicDayFocus.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    mechanicDayFocus.textContent = "";
    return;
  }
  mechanicDayFocus.innerHTML = `
    <span class="mechanic-day-focus-label">Фокус на день</span>
    <strong class="mechanic-day-focus-value">${escapeHtml(focus)}</strong>
  `;
}

function renderDiagnosticsTable() {
  if (!diagnosticsGrid) return;
  const isMechanic = getRole() === "mechanic";

  if (!state.diagnostics.length) {
    diagnosticsGrid.innerHTML = '<article class="inventory-card"><p class="muted">Нет записей.</p></article>';
    return;
  }

  diagnosticsGrid.innerHTML = state.diagnostics
    .map((item) => {
      const timeLabel = item.diagnostic_minutes
        ? `⏱ ${item.diagnostic_minutes} мин`
        : "";
      const dateLabel = item.date
        ? new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
        : "";
      const metaLine = [item.mechanic_name, dateLabel, timeLabel].filter(Boolean).join(" · ");
      if (isMechanic) {
        return `
          <article class="diagnostic-mini-card is-clickable" data-action="edit-diagnostic" data-id="${item.id}">
            <strong class="diagnostic-mini-bike">${escapeHtml(item.bike)}</strong>
            <p class="muted diagnostic-mini-fault">${escapeHtml(item.fault || "Поломка не указана")}</p>
            ${metaLine ? `<p class="diagnostic-mini-meta muted">${escapeHtml(metaLine)}</p>` : ""}
          </article>
        `;
      }
      // Owner: clickable read-only card
      const hasPhotos = item.photos_count > 0;
      return `
        <article class="diagnostic-mini-card diagnostic-owner-card is-clickable" data-action="view-diagnostic" data-id="${item.id}">
          <div class="diag-owner-head">
            <strong class="diagnostic-mini-bike">${escapeHtml(item.bike)}</strong>
            <div class="diag-owner-head-right">
              ${hasPhotos ? `<span class="diag-photo-badge">📷 ${item.photos_count}</span>` : ""}
              ${timeLabel ? `<span class="diag-time-badge">${escapeHtml(timeLabel)}</span>` : ""}
            </div>
          </div>
          <p class="diagnostic-mini-fault">${escapeHtml(item.fault || "Поломка не указана")}</p>
          <p class="diag-owner-meta muted">${escapeHtml([item.category, item.severity].filter(Boolean).join(" · ") || "—")}</p>
          <p class="diag-owner-mechanic muted">Механик: ${escapeHtml(item.mechanic_name || "—")} · ${escapeHtml(dateLabel)}</p>
          ${item.recommendation ? `<p class="diag-owner-rec">Решение: ${escapeHtml(item.recommendation)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderDiagnosticCategoryGrid() {
  const cards = Object.entries(DIAGNOSTIC_LIBRARY).map(([category]) => {
    const count = getDiagnosticCategoryCount(category);
    return `
      <button class="diagnostic-category-card" type="button" data-action="start-diagnostic-category" data-category="${escapeHtml(category)}">
        <strong>${escapeHtml(category)}</strong>
        <span class="diagnostic-category-count">${count}</span>
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
    diagnosticFaultGrid.innerHTML = "";
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

const DIAGNOSTIC_QUICK_TOTAL_STEPS = 4;
const DIAGNOSTIC_QUICK_FAULT_CATALOG = {
  "Электрика": [
    { label: "Не включается / пропадает питание", parts: ["Предохранитель", "Комплект проводки"] },
    { label: "Ошибка контроллера / датчиков", parts: ["Контроллер"] },
    { label: "Проблема ручки газа", parts: ["Ручка газа"] },
    { label: "Проблема зарядки", parts: ["Зарядный порт", "Зарядное устройство"] },
  ],
  "Колеса": [
    { label: "Спускает колесо", parts: ["Камера"] },
    { label: "Прокол / порез покрышки", parts: ["Камера", "Покрышка"] },
    { label: "Люфт переднего колеса", parts: ["Подшипник колеса"] },
    { label: "Люфт заднего колеса", parts: ["Подшипник колеса"] },
    { label: "Биение / деформация колеса", parts: [] },
  ],
  "Тормоза": [
    { label: "Скрип тормозов", parts: ["Колодки"] },
    { label: "Слабое торможение", parts: ["Колодки"] },
    { label: "Подклинивание суппорта", parts: ["Суппорт"] },
    { label: "Не возвращается ручка тормоза", parts: ["Рычаг тормоза"] },
  ],
  "Руль": [
    { label: "Люфт рулевой колонки", parts: ["Подшипник рулевой"] },
    { label: "Тугой поворот руля", parts: ["Подшипник рулевой"] },
    { label: "Руль стоит криво", parts: [] },
    { label: "Стук в руле", parts: ["Крепеж рулевой"] },
  ],
  "Мотор": [
    { label: "Не тянет мотор", parts: ["Контроллер"] },
    { label: "Рывки при разгоне", parts: ["Контроллер"] },
    { label: "Посторонний шум мотора", parts: ["Подшипник мотора"] },
    { label: "Перегрев мотора", parts: [] },
    { label: "Повышенная вибрация мотора", parts: ["Подшипник мотора"] },
  ],
  "Пластик": [
    { label: "Трещина пластика", parts: ["Крепеж пластика"] },
    { label: "Сломаны крепления / клипсы", parts: ["Крепеж пластика", "Клипса"] },
    { label: "Отсутствует элемент пластика", parts: ["Крепеж пластика"] },
    { label: "Дребезг пластика", parts: ["Крепеж пластика"] },
    { label: "Порез сиденья", parts: ["Чехол сиденья"] },
  ],
};
const DIAGNOSTIC_SCENARIO_OPTIONS = [
  {
    id: "fast",
    title: "Быстрый запуск",
    hint: "Минимум простоя, базовый ремонт",
  },
  {
    id: "balanced",
    title: "Сбалансированный",
    hint: "Оптимально по сроку и надежности",
  },
  {
    id: "reliable",
    title: "Надежный",
    hint: "Максимум качества и запаса прочности",
  },
];

const DIAGNOSTIC_KNOWLEDGE_BASE = {
  "Электрика": {
    "не включается": {
      fast: {
        title: "Быстрый запуск по электрике",
        steps: [
          "Проверить разъемы питания, предохранитель и кнопку включения.",
          "Зачистить контакты и восстановить соединение по цепи питания.",
          "Сделать тестовый запуск без нагрузки.",
        ],
        check: "Байк стабильно включается 3 раза подряд.",
      },
      balanced: {
        title: "Сбалансированный ремонт электрики",
        steps: [
          "Диагностика цепи мультиметром: питание, масса, управляющая линия.",
          "Заменить поврежденные разъемы/участки проводки.",
          "Проверить контроллер и панель управления на ошибки.",
        ],
        check: "Нет ошибки на экране, запуск и отклик газа в норме.",
      },
      reliable: {
        title: "Надежный сценарий электрики",
        steps: [
          "Полная ревизия жгута и точек окисления, профилактика контактов.",
          "Замена слабых узлов цепи питания и повторная изоляция.",
          "Финальный тест под нагрузкой 5-10 минут.",
        ],
        check: "Питание стабильное под нагрузкой, повторных сбоев нет.",
      },
    },
    default: {
      balanced: {
        title: "Базовый протокол по электрике",
        steps: [
          "Проверить питание, разъемы и визуальные повреждения.",
          "Локализовать неисправный участок цепи.",
          "Восстановить контакт/заменить поврежденный элемент.",
        ],
        check: "Все электроузлы работают без ошибок.",
      },
    },
  },
  "Тормоза": {
    "шум": {
      balanced: {
        title: "Устранение шума тормозов",
        steps: [
          "Проверить износ колодок и состояние диска.",
          "Очистить тормозной узел и отцентрировать суппорт.",
          "При необходимости заменить колодки/диск.",
        ],
        check: "При торможении нет скрипа и уводов.",
      },
    },
    default: {
      balanced: {
        title: "Базовый протокол по тормозам",
        steps: [
          "Осмотреть диск, суппорт, колодки и ход ручки.",
          "Отрегулировать тормозной контур.",
          "Провести тест торможения на малой скорости.",
        ],
        check: "Торможение ровное, ручка возвращается корректно.",
      },
    },
  },
  "Колеса": {
    "спускает": {
      balanced: {
        title: "Устранение спуска колеса",
        steps: [
          "Выявить место утечки (ниппель/камера/покрышка).",
          "Заменить камеру или покрышку по результату осмотра.",
          "Выставить рабочее давление и проверить герметичность.",
        ],
        check: "Через 15 минут давление стабильно, утечки нет.",
      },
    },
    default: {
      balanced: {
        title: "Базовый протокол по колесам",
        steps: [
          "Проверить покрышку, камеру, ниппель и посадку колеса.",
          "Устранить дефект и выполнить балансировку по месту.",
          "Сделать короткий тест-райд.",
        ],
        check: "Нет биения, давление держится, байк едет ровно.",
      },
    },
  },
  "Руль": {
    default: {
      balanced: {
        title: "Базовый протокол по рулю",
        steps: [
          "Проверить люфты рулевой и крепежные точки.",
          "Подтянуть или заменить изношенные элементы.",
          "Проверить центровку руля и ход поворота.",
        ],
        check: "Люфта нет, руль вращается плавно.",
      },
    },
  },
  "Пластик": {
    default: {
      balanced: {
        title: "Базовый протокол по пластику",
        steps: [
          "Осмотреть крепления и зону повреждения.",
          "Заменить сломанные клипсы/крепеж, при необходимости элемент.",
          "Проверить плотность посадки после сборки.",
        ],
        check: "Нет люфта и дребезга пластика на ходу.",
      },
    },
  },
  "Мотор": {
    default: {
      balanced: {
        title: "Базовый протокол по мотору",
        steps: [
          "Проверить ошибки контроллера и поведение под нагрузкой.",
          "Диагностировать шум/вибрации и состояние подшипников.",
          "Выполнить ремонт узла и контрольный прогон.",
        ],
        check: "Тяга ровная, без посторонних шумов и перегрева.",
      },
    },
  },
};
const DIAGNOSTIC_QUICK_STEPS = {
  1: {
    title: "Где проблема?",
    subtitle: "Можно выбрать несколько узлов",
    key: "categories",
    multi: true,
    min: 1,
    options: ["Электрика", "Тормоза", "Колеса", "Руль", "Пластик", "Мотор"],
  },
  2: {
    title: "Какая поломка?",
    subtitle: "Выбери поломки",
    key: "faults",
    multi: true,
    min: 1,
    options: [],
  },
  3: {
    title: "Насколько критично?",
    subtitle: "Выбери уровень срочности",
    key: "criticality",
    multi: false,
    options: ["Можно ездить", "Нужен ремонт", "Стоп-эксплуатация"],
  },
  4: {
    title: "Запчасти",
    subtitle: "Выбери нужные позиции со склада",
    key: "selectedParts",
    multi: true,
    min: 0,
    max: 50,
    options: [],
  },
};

function getQuickSeverity() {
  const map = {
    "Можно ездить": "Низкая",
    "Нужен ремонт": "Средняя",
    "Стоп-эксплуатация": "Критичная",
  };
  return map[state.diagnosticQuickFlow.criticality] || "Средняя";
}

function getQuickFaultOptionsByCategory() {
  return (DIAGNOSTIC_QUICK_FAULT_CATALOG[state.diagnosticQuickFlow.category] || []).map((item) => item.label);
}

function getQuickDefaultPartsByFault() {
  const categoryItems = DIAGNOSTIC_QUICK_FAULT_CATALOG[state.diagnosticQuickFlow.category] || [];
  const selected = categoryItems.find((item) => item.label === state.diagnosticQuickFlow.fault);
  return selected?.parts || [];
}

function getQuickInventoryOptions() {
  return (state.inventory || [])
    .map((item) => String(item.name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));
}

function getQuickInventoryGroupedOptions() {
  const grouped = new Map();
  [...INVENTORY_GROUPS.map((group) => group.key), "other"].forEach((key) => grouped.set(key, []));
  (state.inventory || []).forEach((item) => {
    const name = String(item.name || "").trim();
    if (!name) return;
    const key = resolveInventoryCategory(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(name);
  });
  grouped.forEach((items, key) => {
    const uniqueSorted = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, "ru"));
    grouped.set(key, uniqueSorted);
  });
  return grouped;
}

function getQuickRecommendation() {
  if (state.diagnosticQuickFlow.criticality === "Можно ездить") {
    return "Можно ездить: мастер вручную выбирает нужные запчасти.";
  }
  if (state.diagnosticQuickFlow.criticality === "Нужен ремонт") {
    return "Нужен ремонт: проверяем наличие выбранных запчастей на складе.";
  }
  if (state.diagnosticQuickFlow.criticality === "Стоп-эксплуатация") {
    return "Стоп-эксплуатация: срочный ремонт и приоритетная комплектация.";
  }
  return "Определи приоритет, чтобы сформировать план работ.";
}

function getQuickRequiredPartsText() {
  const selectedParts = state.diagnosticQuickFlow.selectedParts || [];
  if (!selectedParts.length) return "-";
  return selectedParts.map((name) => `${name}:1`).join(", ");
}

function buildQuickFaultTitle() {
  const faults = state.diagnosticQuickFlow.faults || [];
  if (faults.length) return faults.join("; ");
  return state.diagnosticQuickFlow.fault || "неисправность";
}

function buildQuickSymptomsText() {
  const categories = state.diagnosticQuickFlow.categories || [];
  const faults = state.diagnosticQuickFlow.faults || [];
  const catStr = categories.length ? categories.join(", ") : (state.diagnosticQuickFlow.category || "—");
  const faultStr = faults.length ? faults.join("; ") : (state.diagnosticQuickFlow.fault || "—");
  return `Категории: ${catStr}. Поломки: ${faultStr}.`;
}

function buildQuickConclusionText() {
  const decisionText =
    state.diagnosticQuickFlow.decision === "take_repair"
      ? "Вариант: взять в ремонт."
      : state.diagnosticQuickFlow.decision === "queue"
        ? `Вариант: поставить в очередь. Причина: ${state.diagnosticQuickFlow.queueReason || "не указана"}.`
        : "Вариант развития событий не выбран.";
  return [
    `Предварительный диагноз: ${buildQuickFaultTitle()}.`,
    `Критичность: ${state.diagnosticQuickFlow.criticality}.`,
    decisionText,
  ].join(" ");
}

function canGoNextQuickStep() {
  const step = state.diagnosticQuickFlow.step;
  if (step === DIAGNOSTIC_QUICK_TOTAL_STEPS) {
    if (!state.diagnosticQuickFlow.decision) return false;
    if (state.diagnosticQuickFlow.decision === "queue") {
      return Boolean(String(state.diagnosticQuickFlow.queueReason || "").trim());
    }
    return true;
  }
  const cfg = DIAGNOSTIC_QUICK_STEPS[step];
  if (!cfg) return false;
  const value = state.diagnosticQuickFlow[cfg.key];
  if (cfg.multi) return Array.isArray(value) && value.length >= (cfg.min || 1);
  return Boolean(String(value || "").trim());
}

function showDiagnosticQuickErrors(messages) {
  if (!diagnosticQuickError) return;
  const list = (messages || []).filter(Boolean);
  if (!list.length) {
    diagnosticQuickError.classList.add("hidden");
    diagnosticQuickError.innerHTML = "";
    return;
  }
  diagnosticQuickError.innerHTML = `
    <strong>Проверь заполнение:</strong>
    <ul>${list.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
  `;
  diagnosticQuickError.classList.remove("hidden");
}

function getDiagnosticSubmitErrors(bikeCode, mechanicName) {
  const errors = [];
  const categories = state.diagnosticQuickFlow.categories || [];
  const faults = state.diagnosticQuickFlow.faults || [];
  if (!categories.length && !String(state.diagnosticQuickFlow.category || "").trim()) {
    errors.push("Выбери хотя бы один узел (категорию поломки).");
  }
  if (!faults.length && !String(state.diagnosticQuickFlow.fault || "").trim()) {
    errors.push("Выбери хотя бы одну поломку.");
  }
  if (!String(state.diagnosticQuickFlow.criticality || "").trim()) {
    errors.push("Укажи приоритет (критичность) диагностики.");
  }
  if (!isValidBikeCode(bikeCode)) {
    errors.push("Укажи номер байка в формате РЕ123У.");
  }
  if (!(state.diagnosticQuickFlow.selectedParts || []).length) {
    errors.push("Выбери хотя бы одну необходимую запчасть.");
  }
  if (!state.diagnosticQuickFlow.decision) {
    errors.push("Выбери вариант развития событий: взять в ремонт или поставить в очередь.");
  }
  if (state.diagnosticQuickFlow.decision === "queue" && !String(state.diagnosticQuickFlow.queueReason || "").trim()) {
    errors.push("Укажи причину, почему байк ставим в очередь.");
  }
  if (!mechanicName) {
    errors.push("Не удалось определить пользователя. Перезайди в аккаунт.");
  }
  return errors;
}

function renderQuickSummaryCard() {
  if (!diagnosticQuickSummaryCard) return;
  const selectedParts = new Set(state.diagnosticQuickFlow.selectedParts || []);
  const decision = state.diagnosticQuickFlow.decision || "";
  const queueReason = state.diagnosticQuickFlow.queueReason || "";
  const groupedParts = getQuickInventoryGroupedOptions();
  const activePartsCategory = state.diagnosticQuickFlow.selectedPartsCategory || "";
  const activeCategoryItems = groupedParts.get(activePartsCategory) || [];
  const hasActiveCategory = Boolean(activePartsCategory && activeCategoryItems.length);
  const categoryButtons = Array.from(groupedParts.entries())
    .filter(([, items]) => items.length > 0)
    .map(
      ([categoryKey, items]) => `
        <button
          class="diagnostic-scenario-card ${activePartsCategory === categoryKey ? "is-active" : ""}"
          type="button"
          data-action="diagnostic-quick-part-category"
          data-category="${escapeHtml(categoryKey)}"
        >
          <strong>${escapeHtml(INVENTORY_GROUP_TITLE.get(categoryKey) || "Прочее")}</strong>
          <span>${items.length} позиций</span>
        </button>
      `
    )
    .join("");
  const partButtons = activeCategoryItems
    .map((partName) => {
      const active = selectedParts.has(partName);
      return `
        <button
          class="diagnostic-scenario-card ${active ? "is-active" : ""}"
          type="button"
          data-action="diagnostic-quick-part"
          data-part="${escapeHtml(partName)}"
        >
          <strong>${escapeHtml(partName)}</strong>
          <span>Добавить в необходимые запчасти</span>
        </button>
      `;
    })
    .join("");
  const summaryCats = state.diagnosticQuickFlow.categories || [];
  const summaryFaults = state.diagnosticQuickFlow.faults || [];
  const categorySummaryHtml = summaryCats.length > 1
    ? `<div class="diagnostic-quick-summary-row"><strong>Узлы:</strong> ${escapeHtml(summaryCats.join(", "))}</div>`
    : `<div class="diagnostic-quick-summary-row"><strong>Узел:</strong> ${escapeHtml(summaryCats[0] || state.diagnosticQuickFlow.category || "-")}</div>`;
  const faultSummaryHtml = summaryFaults.length > 1
    ? summaryFaults.map((f) => `<div class="diagnostic-quick-summary-tag">${escapeHtml(f)}</div>`).join("")
    : `<div class="diagnostic-quick-summary-row"><strong>Поломка:</strong> ${escapeHtml(summaryFaults[0] || state.diagnosticQuickFlow.fault || "-")}</div>`;
  const faultBlock = summaryFaults.length > 1
    ? `<div class="diagnostic-quick-summary-row"><strong>Поломки:</strong></div><div class="diagnostic-quick-summary-tags">${faultSummaryHtml}</div>`
    : faultSummaryHtml;
  diagnosticQuickSummaryCard.innerHTML = `
    ${categorySummaryHtml}
    ${faultBlock}
    <div class="diagnostic-quick-summary-row"><strong>Приоритет:</strong> ${escapeHtml(state.diagnosticQuickFlow.criticality)}</div>
    <div class="diagnostic-scenario-block">
      <div class="diagnostic-quick-summary-row"><strong>Варианты развития событий:</strong></div>
      <div class="diagnostic-scenario-grid">
        <button class="diagnostic-scenario-card ${decision === "take_repair" ? "is-active" : ""}" type="button" data-action="diagnostic-decision" data-decision="take_repair">
          <strong>Взять в ремонт</strong>
          <span>Работы начинаем сразу</span>
        </button>
        <button class="diagnostic-scenario-card ${decision === "queue" ? "is-active" : ""}" type="button" data-action="diagnostic-decision" data-decision="queue">
          <strong>Поставить в очередь</strong>
          <span>Нужно указать причину</span>
        </button>
      </div>
      <label class="${decision === "queue" ? "" : "hidden"}">
        <span>Причина, почему не можем взять в ремонт сейчас</span>
        <textarea id="diagnostic-queue-reason" rows="3" placeholder="Например: нет места, ждём запчасть">${escapeHtml(queueReason)}</textarea>
      </label>
    </div>
    <div class="diagnostic-scenario-block">
      <div class="diagnostic-quick-summary-row"><strong>Выбор запчастей со склада:</strong></div>
      ${
        hasActiveCategory
          ? `<div class="diagnostic-parts-toolbar">
              <button class="ghost-btn" type="button" data-action="diagnostic-quick-part-category-back">Вернуться к категориям</button>
              <span>${escapeHtml(INVENTORY_GROUP_TITLE.get(activePartsCategory) || "Прочее")}</span>
            </div>
            <div class="diagnostic-scenario-grid">${partButtons}</div>`
          : `<div class="diagnostic-scenario-grid">${categoryButtons}</div>`
      }
    </div>
    <div class="diagnostic-quick-summary-row"><strong>Запчасти:</strong> ${escapeHtml(getQuickRequiredPartsText())}</div>
    <div class="diagnostic-scenario-block">
      <div class="diagnostic-quick-summary-row"><strong>Фото байка (обязательно при взятии в ремонт):</strong></div>
      <label class="diag-photo-btn" for="diagnostic-photo-input">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Сфотографировать
      </label>
      <input type="file" id="diagnostic-photo-input" accept="image/*" capture="environment" multiple style="display:none" />
      <div id="diagnostic-photo-preview" class="diag-photo-grid"></div>
    </div>
    <button class="ghost-btn" type="button" data-action="save-as-template" style="margin-top:8px">Сохранить как шаблон</button>
  `;
}

function renderQuickStepOptions() {
  if (!diagnosticQuickOptions) return;
  const step = state.diagnosticQuickFlow.step;
  const cfg = DIAGNOSTIC_QUICK_STEPS[step];
  if (!cfg) {
    diagnosticQuickOptions.innerHTML = "";
    return;
  }
  const selected = state.diagnosticQuickFlow[cfg.key];

  if (step === 4) {
    diagnosticQuickOptions.innerHTML = "";
    return;
  }

  if (step === 2) {
    const selectedCategories = state.diagnosticQuickFlow.categories || [];
    const selectedFaults = new Set(state.diagnosticQuickFlow.faults || []);
    const showGroups = selectedCategories.length > 1;

    diagnosticQuickOptions.innerHTML = selectedCategories
      .map((cat) => {
        const faults = (DIAGNOSTIC_QUICK_FAULT_CATALOG[cat] || []).map((item) => item.label);
        if (!faults.length) return "";
        const groupHeader = showGroups
          ? `<div class="diagnostic-fault-group-label">${escapeHtml(cat)}</div>`
          : "";
        const buttons = faults
          .map((fault) => `
            <button
              class="diagnostic-quick-option ${selectedFaults.has(fault) ? "is-active" : ""}"
              type="button"
              data-action="diagnostic-quick-option"
              data-value="${escapeHtml(fault)}"
              data-category="${escapeHtml(cat)}"
            >${escapeHtml(fault)}</button>
          `)
          .join("");
        return `${groupHeader}<div class="diagnostic-fault-group">${buttons}</div>`;
      })
      .join("");
    return;
  }

  const options = cfg.options;
  diagnosticQuickOptions.innerHTML = options
    .map((option) => {
      const active = cfg.multi ? (Array.isArray(selected) ? selected.includes(option) : false) : selected === option;
      return `
        <button
          class="diagnostic-quick-option ${active ? "is-active" : ""}"
          type="button"
          data-action="diagnostic-quick-option"
          data-value="${escapeHtml(option)}"
        >${escapeHtml(option)}</button>
      `;
    })
    .join("");
}

function syncDiagnosticWizard() {
  if (!diagnosticQuickWizard) return;
  const step = state.diagnosticQuickFlow.step;
  const progress = Math.max(1, Math.min(step, DIAGNOSTIC_QUICK_TOTAL_STEPS));
  const percent = (progress / DIAGNOSTIC_QUICK_TOTAL_STEPS) * 100;
  diagnosticModalTitle.textContent = state.diagnosticQuickFlow.editingId ? "Редактировать диагностику" : "Новая диагностика";
  if (diagnosticQuickProgressText) diagnosticQuickProgressText.textContent = `Шаг ${progress}/${DIAGNOSTIC_QUICK_TOTAL_STEPS}`;
  if (diagnosticQuickProgressCounter) diagnosticQuickProgressCounter.textContent = `${progress}/${DIAGNOSTIC_QUICK_TOTAL_STEPS}`;
  if (diagnosticQuickProgressFill) diagnosticQuickProgressFill.style.width = `${percent}%`;

  const isSummary = step === DIAGNOSTIC_QUICK_TOTAL_STEPS;
  const canProceed = canGoNextQuickStep();
  diagnosticQuickStepQuestion?.classList.toggle("hidden", isSummary);
  diagnosticQuickStepSummary?.classList.toggle("hidden", !isSummary);
  if (diagnosticQuickBack) diagnosticQuickBack.classList.toggle("hidden", progress === 1);
  if (diagnosticQuickDelete) {
    const editingId = String(diagnosticForm?.dataset?.editId || "").trim();
    diagnosticQuickDelete.classList.toggle("hidden", !(isSummary && editingId));
  }
  const isMultiSelectionStep = step === 1 || step === 2;

  if (diagnosticQuickSaveOpen) {
    diagnosticQuickSaveOpen.classList.toggle("hidden", !isSummary);
    diagnosticQuickSaveOpen.disabled = false;
  }
  if (diagnosticQuickNext) {
    diagnosticQuickNext.classList.toggle("hidden", false);
    if (isSummary) {
      diagnosticQuickNext.textContent = "Сохранить диагностику";
    } else if (isMultiSelectionStep) {
      diagnosticQuickNext.textContent = "Далее →";
    } else {
      diagnosticQuickNext.classList.add("hidden");
    }
    diagnosticQuickNext.disabled = false;
  }

  if (isSummary) {
    renderQuickSummaryCard();
    return;
  }

  const cfg = DIAGNOSTIC_QUICK_STEPS[step];
  if (!cfg) return;
  if (diagnosticQuickTitle) diagnosticQuickTitle.textContent = cfg.title;
  if (diagnosticQuickSubtitle) {
    if (step === 2) {
      const cats = state.diagnosticQuickFlow.categories || [];
      diagnosticQuickSubtitle.textContent = cats.length
        ? `Поломки: ${cats.join(", ")}`
        : cfg.subtitle;
    } else {
      diagnosticQuickSubtitle.textContent = cfg.subtitle;
    }
  }
  renderQuickStepOptions();
}

function loadDiagnosticIntoFlow(item) {
  const rawCategory = String(item.category || "").trim();
  const rawFault = String(item.fault || "").trim();
  const categories = rawCategory ? rawCategory.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const faults = rawFault ? rawFault.split(";").map((s) => s.trim()).filter(Boolean) : [];
  state.diagnosticQuickFlow.categories = categories;
  state.diagnosticQuickFlow.faults = faults;
  state.diagnosticQuickFlow.category = categories[0] || rawCategory;
  state.diagnosticQuickFlow.fault = faults[0] || rawFault;
  state.diagnosticQuickFlow.criticality =
    String(item.severity || "").trim() === "Критичная"
      ? "Стоп-эксплуатация"
      : String(item.severity || "").trim() === "Низкая"
        ? "Можно ездить"
        : "Нужен ремонт";
  state.diagnosticQuickFlow.selectedParts = [];
  state.diagnosticQuickFlow.selectedPartsCategory = "";
  state.diagnosticQuickFlow.decision = String(item.recommendation || "").toLowerCase().includes("очеред")
    ? "queue"
    : "take_repair";
  state.diagnosticQuickFlow.queueReason = state.diagnosticQuickFlow.decision === "queue"
    ? String(item.recommendation || "")
    : "";
  state.diagnosticQuickFlow.step = DIAGNOSTIC_QUICK_TOTAL_STEPS;
}

function resetDiagnosticFlow() {
  state.diagnosticFlow = {
    mode: "create",
    category: "",
    zone: "",
    fault: "",
  };
  state.diagnosticQuickFlow = {
    step: 1,
    categories: [],
    faults: [],
    category: "",
    fault: "",
    criticality: "",
    selectedParts: [],
    selectedPartsCategory: "",
    decision: "",
    queueReason: "",
    photos: [],
  };
  state.diagnosticStartedAt = null;
  diagnosticForm.reset();
  resetBikeCodeValue("diagnostic");
  delete diagnosticForm.dataset.editId;
  diagnosticForm.elements.date.value = new Date().toISOString().slice(0, 10);
  diagnosticForm.elements.mechanicName.value = state.user?.full_name || "";
  diagnosticForm.elements.category.value = "";
  diagnosticForm.elements.fault.value = "";
  showDiagnosticQuickErrors([]);
  syncDiagnosticWizard();
}

/** Закрыть все модальные окна при смене раздела (иначе на мобиле остаётся поверх нижнего меню). */
function closeAllModals() {
  workOrderOverlay?.classList.add("hidden");
  diagnosticOverlay?.classList.add("hidden");
  resetDiagnosticFlow();
  repairOverlay?.classList.add("hidden");
  if (repairForm) {
    repairForm.reset();
    resetBikeCodeValue("repair");
    delete repairForm.dataset.editId;
  }
  state.repairDraftFromDiagnostic = null;
  inventoryOverlay?.classList.add("hidden");
  if (inventoryForm) {
    inventoryForm.reset();
    delete inventoryForm.dataset.editId;
  }
  bikeOverlay?.classList.add("hidden");
  if (bikeForm) {
    bikeForm.reset();
    resetBikeCodeValue("bike");
    delete bikeForm.dataset.editId;
  }
  accountOverlay?.classList.add("hidden");
}

function openDiagnosticOverlay() {
  // Track when diagnostic was started (for duration calculation on save)
  if (!state.diagnosticStartedAt) {
    state.diagnosticStartedAt = Date.now();
  }
  const viewPanel = document.getElementById("diagnostic-view-panel");
  const wizard = document.getElementById("diagnostic-quick-wizard");
  if (viewPanel) viewPanel.classList.add("hidden");
  if (wizard) wizard.classList.remove("hidden");
  diagnosticOverlay.classList.remove("hidden");
  syncDiagnosticWizard();
}

async function openDiagnosticViewForOwner(item) {
  if (!diagnosticOverlay) return;
  const viewPanel = document.getElementById("diagnostic-view-panel");
  const wizard = document.getElementById("diagnostic-quick-wizard");
  const diagForm = document.getElementById("diagnostic-form");
  if (!viewPanel) return;

  // Switch to view mode
  if (wizard) wizard.classList.add("hidden");
  if (diagForm) diagForm.classList.add("hidden");
  viewPanel.classList.remove("hidden");

  const dateLabel = item.date
    ? new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const timeLabel = item.diagnostic_minutes ? `${item.diagnostic_minutes} мин` : null;

  // Update modal title
  if (diagnosticModalTitle) diagnosticModalTitle.textContent = `Байк ${escapeHtml(item.bike || "—")}`;

  viewPanel.innerHTML = `
    <div class="diag-view-rows">
      <div class="diag-view-row">
        <span class="diag-view-label">Байк</span>
        <span class="diag-view-value">${escapeHtml(item.bike || "—")}</span>
      </div>
      <div class="diag-view-row">
        <span class="diag-view-label">Узел / категория</span>
        <span class="diag-view-value">${escapeHtml(item.category || "—")}</span>
      </div>
      <div class="diag-view-row">
        <span class="diag-view-label">Поломка</span>
        <span class="diag-view-value">${escapeHtml(item.fault || "—")}</span>
      </div>
      <div class="diag-view-row">
        <span class="diag-view-label">Критичность</span>
        <span class="diag-view-value">${escapeHtml(item.severity || "—")}</span>
      </div>
      <div class="diag-view-row">
        <span class="diag-view-label">Механик</span>
        <span class="diag-view-value">${escapeHtml(item.mechanic_name || "—")}</span>
      </div>
      <div class="diag-view-row">
        <span class="diag-view-label">Дата</span>
        <span class="diag-view-value">${escapeHtml(dateLabel)}${timeLabel ? ` · ⏱ ${timeLabel}` : ""}</span>
      </div>
      ${item.recommendation ? `
      <div class="diag-view-row">
        <span class="diag-view-label">Решение</span>
        <span class="diag-view-value">${escapeHtml(item.recommendation)}</span>
      </div>` : ""}
    </div>
    <div class="diag-view-photos-section">
      <div class="diag-view-photos-title">Фотоконтроль</div>
      <div id="diag-view-photos" class="diag-view-photos-grid">
        <span class="muted" style="font-size:0.85rem">Загрузка фото…</span>
      </div>
    </div>
  `;

  diagnosticOverlay.classList.remove("hidden");

  // Fetch photos
  try {
    const data = await api(`/api/diagnostics/${item.id}/photos`);
    const photosEl = document.getElementById("diag-view-photos");
    if (!photosEl) return;
    const photos = data?.photos || [];
    if (!photos.length) {
      photosEl.innerHTML = '<span class="muted" style="font-size:0.85rem">Фотографии не прикреплены</span>';
    } else {
      photosEl.innerHTML = photos
        .map((p) => `
          <div class="diag-view-photo-thumb">
            <img src="${p.photoData}" alt="Фотоконтроль" loading="lazy" />
          </div>
        `)
        .join("");
    }
  } catch {
    const photosEl = document.getElementById("diag-view-photos");
    if (photosEl) photosEl.innerHTML = '<span class="muted" style="font-size:0.85rem">Не удалось загрузить фото</span>';
  }
}

function renderMetrics() {
  if (!metricsGrid) return;
  const stats = getDashboardStats();
  document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.dashboardPeriod === state.dashboardPeriod);
  });
  const cards = [
    {
      key: "diagnosed",
      icon: SVG_ICONS.stethoscope,
      tint: "stat-neutral",
      label: "Диагностика за период",
      value: String(stats.diagnosedInPeriod),
      jump: "diagnostics",
    },
    {
      key: "inspection",
      icon: SVG_ICONS.eye,
      tint: "stat-ok",
      label: "ТО / проверка",
      value: String(stats.inspectionNow),
      jump: "inspection",
    },
    {
      key: "repair",
      icon: SVG_ICONS.wrench,
      tint: "stat-accent",
      label: "В ремонте сейчас",
      value: String(stats.inRepairNow),
      jump: "repair",
    },
    {
      key: "waiting",
      icon: SVG_ICONS.clock,
      tint: "stat-warn",
      label: "Ждут запчасти",
      value: String(stats.waitingPartsNow),
      jump: "waiting-parts",
    },
  ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <button class="dashboard-status-row" type="button" data-dashboard-jump="${card.jump}">
          <span class="dashboard-status-left">
            <span class="dashboard-status-icon" aria-hidden="true">${card.icon || ""}</span>
            <span class="dashboard-status-label">${escapeHtml(card.label)}</span>
          </span>
          <span class="dashboard-status-right">
            <strong class="dashboard-status-value">${escapeHtml(card.value)}</strong>
            <span class="dashboard-status-arrow" aria-hidden="true">›</span>
          </span>
        </button>
      `
    )
    .join("");
}

function renderTimeline() {
  if (!timeline) return;
  const stats = getDashboardStats();
  const readyNow = state.workOrders.filter((item) => item.status === "готов").length;
  const rows = [
    { label: "Срочно: ждут запчасти", value: stats.waitingPartsNow },
    { label: "В работе прямо сейчас", value: stats.inRepairNow },
    { label: "Нужно проверить (ТО/диаг.)", value: stats.inspectionNow },
    { label: "Готово к выдаче", value: readyNow },
  ];
  timeline.innerHTML = rows
    .map(
      (row) => `
        <div class="simple-row">
          <span class="simple-row-label">${escapeHtml(row.label)}</span>
          <span class="simple-row-value">${escapeHtml(String(row.value))}</span>
        </div>
      `
    )
    .join("");
}

function getBikeStatusRows() {
  const bikes = state.bikes || [];
  const mechanicMode = getRole() === "mechanic";
  const mechanicVisible = new Set(["принят", "ждет запчасти", "в ремонте", "проверка", "готов"]);
  const bikesForRows = mechanicMode
    ? bikes.filter((bike) => mechanicVisible.has(String(bike.status || "").trim()))
    : bikes;
  const total = bikesForRows.length || 1;
  const counts = bikesForRows.reduce((acc, bike) => {
    const key = String(bike.status || "нет данных").trim() || "нет данных";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const order = [
    "в аренде",
    "готов",
    "на диагностике",
    "в ремонте",
    "проверка",
    "ждет запчасти",
    "принят",
  ];

  const known = order
    .filter((key) => counts[key])
    .map((key) => ({ key, count: counts[key], percent: Math.round((counts[key] / total) * 100) }));

  const unknown = Object.keys(counts)
    .filter((key) => !order.includes(key))
    .map((key) => ({ key, count: counts[key], percent: Math.round((counts[key] / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  return [...known, ...unknown];
}

const SVG_ICONS = {
  check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M20 6L9 17l-5-5"/></svg>`,
  wrench:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M14.7 6.3a3.5 3.5 0 0 0-4.9 4.9l-5.4 5.4a1.2 1.2 0 1 0 1.7 1.7l5.4-5.4a3.5 3.5 0 0 0 4.9-4.9l-2.2 2.2-2.7-2.7z"/></svg>`,
  search:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>`,
  clock:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  list:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/></svg>`,
  pause:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  bike:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16l3-8h6l2 5"/><path d="M12 8V5l3 1"/></svg>`,
  stethoscope: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h0a2.5 2.5 0 0 1 2.5 2.5v6a5.5 5.5 0 0 0 11 0v-1"/><circle cx="20.5" cy="10.5" r="1"/></svg>`,
  eye:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

const BIKE_STATUS_JUMP_MAP = {
  "готов":           { jump: "ready",         icon: SVG_ICONS.check,  accent: "#22a85a" },
  "в ремонте":       { jump: "repair",        icon: SVG_ICONS.wrench, accent: "#e07c2e" },
  "на диагностике":  { jump: "in-diagnostics",icon: SVG_ICONS.search, accent: "#007aff" },
  "принят":          { jump: "accepted",      icon: SVG_ICONS.list,   accent: "#007aff" },
  "проверка":        { jump: "inspection",    icon: SVG_ICONS.eye,    accent: "#8a5cf6" },
  "ждет запчасти":   { jump: "waiting-parts", icon: SVG_ICONS.clock,  accent: "#e05c5c" },
  "в аренде":        { jump: "rented",        icon: SVG_ICONS.bike,   accent: "#2ebbc1" },
  "приостановлен":   { jump: "paused",        icon: SVG_ICONS.pause,  accent: "#f59e0b" },
};

function renderBikeStatuses() {
  if (!bikeStatuses) return;
  const rows = getBikeStatusRows();
  if (!rows.length) {
    bikeStatuses.innerHTML = '<div class="muted">Нет данных по парку.</div>';
    return;
  }

  bikeStatuses.innerHTML = rows
    .slice(0, 10)
    .map((row) => {
      const meta = BIKE_STATUS_JUMP_MAP[row.key];
      const label = row.key === "ждет запчасти" ? "ждут запчасти" : row.key;
      const icon = meta?.icon || SVG_ICONS.bike;
      const accent = meta?.accent || "var(--accent)";
      const jumpAttr = meta ? `data-dashboard-jump="${meta.jump}"` : "";
      const clickable = meta ? "status-row-clickable" : "";

      return `
        <div class="status-row ${clickable}" ${jumpAttr} style="--row-accent:${accent}">
          <span class="status-row-icon">${icon}</span>
          <span class="status-row-label">${escapeHtml(label)}</span>
          <span class="status-row-count">${row.count}</span>
          ${meta ? `<span class="status-row-arrow">›</span>` : ""}
        </div>
      `;
    })
    .join("");
}

function toTs(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`).getTime();
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function getEvents() {
  const items = [];

  (state.diagnostics || []).forEach((d) => {
    items.push({
      ts: toTs(d.date),
      title: d.bike,
      type: "diagnostic",
      text: `Диагностика · ${[d.category, d.fault].filter(Boolean).join(" · ") || "—"}`,
    });
  });

  (state.workOrders || []).forEach((o) => {
    items.push({
      ts: toTs(o.intake_date || o.started_at || o.created_at),
      title: o.bike_code,
      type: "workorder",
      text: `Заявка · ${o.status || "—"} · ${o.fault || o.issue || "—"}`,
    });
  });

  (state.repairs || []).forEach((r) => {
    items.push({
      ts: toTs(r.date),
      title: r.bike,
      type: "repair",
      text: `Ремонт · ${r.status || "—"} · ${r.issue || "—"}`,
    });
  });

  const low = (state.inventory || []).filter((i) => Number(i.stock) <= Number(i.min));
  low.forEach((i) => {
    items.push({
      ts: Date.now(),
      title: i.name,
      type: "stock",
      text: `Склад · дефицит (${i.stock}/${i.min})`,
    });
  });

  return items
    .filter((e) => e.ts)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12);
}

function renderEventsFeed() {
  if (!eventsFeed) return;
  const events = getEvents();
  if (!events.length) {
    eventsFeed.innerHTML = '<div class="muted">Пока нет событий.</div>';
    return;
  }

  eventsFeed.innerHTML = events
    .map((e) => {
      const time = new Date(e.ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `
        <div class="event-row">
          <div class="event-main">
            <div class="event-title">${escapeHtml(e.title || "—")}</div>
            <div class="event-text muted">${escapeHtml(e.text || "")}</div>
          </div>
          <div class="event-time">${escapeHtml(time)}</div>
        </div>
      `;
    })
    .join("");
}

function renderAlerts() {
  if (!alertsList) return;

  const focus = String(state.kpi.mechanicFocus || "").trim();
  const showFocus = getRole() === "mechanic" && Boolean(focus);

  const inRepair = (state.workOrders || []).filter((o) => o.status === "в ремонте");
  const waitingParts = (state.workOrders || []).filter((o) => o.status === "ждет запчасти");

  const goalHtml = showFocus ? `
    <div class="focus-goal-card">
      <div class="focus-goal-label">Цель на неделю</div>
      <div class="focus-goal-text">${escapeHtml(focus)}</div>
    </div>
  ` : "";

  const repairSection = inRepair.length ? `
    <div class="focus-section-title">В ремонте сейчас</div>
    ${inRepair.map((o) => `
      <button class="focus-order-card" type="button" data-action="open-dashboard-order" data-id="${o.id}">
        <div class="focus-order-left">
          <div class="focus-order-code">${escapeHtml(o.bike_code || "—")}</div>
          <div class="focus-order-fault muted">${escapeHtml(o.fault || o.issue || "—")}</div>
        </div>
        <div class="focus-order-right">
          <span class="status-pill status-repair">в ремонте</span>
          <span class="focus-order-arrow">›</span>
        </div>
      </button>
    `).join("")}
  ` : "";

  const waitingSection = waitingParts.length ? `
    <div class="focus-section-title">Ждут запчасти</div>
    ${waitingParts.map((o) => {
      const missing = o.missing_parts?.length
        ? o.missing_parts.map((p) => p.name).join(", ")
        : "Ожидает комплектность";
      return `
        <button class="focus-order-card focus-order-card--warn" type="button" data-action="open-dashboard-order" data-id="${o.id}">
          <div class="focus-order-left">
            <div class="focus-order-code">${escapeHtml(o.bike_code || "—")}</div>
            <div class="focus-order-fault muted">${escapeHtml(missing)}</div>
          </div>
          <div class="focus-order-right">
            <span class="status-pill status-waiting">ждёт ЗЧ</span>
            <span class="focus-order-arrow">›</span>
          </div>
        </button>
      `;
    }).join("")}
  ` : "";

  const emptyHtml = !inRepair.length && !waitingParts.length ? `
    <p class="muted" style="padding:12px 0;">Нет срочных задач — всё под контролем 👍</p>
  ` : "";

  alertsList.innerHTML = goalHtml + repairSection + waitingSection + emptyHtml;
}

function renderRepairsTable() {
  if (!repairsTable) return;
  const rows = getFilteredRepairs();
  const canManage = getRole() === "mechanic";

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

/** 0 = нет на складе, 1 = мало (как stock-chip-warn), 2 = норма — для сортировки и цветовых групп. */
function inventoryStockTier(item) {
  const s = Number(item.stock || 0);
  if (s <= 0) return 0;
  if (s <= 1) return 1;
  return 2;
}

const INVENTORY_GROUPS = [
  {
    key: "plastic",
    title: "Пластик",
    keywords: ["пластик", "сабля", "щиток", "корпус", "дека", "порог", "сиден", "клипс", "крепеж пластика"],
  },
  {
    key: "brakes",
    title: "Тормоза",
    keywords: ["тормоз", "суппорт", "колодк", "шланг", "диск", "рычаг тормоза"],
  },
  {
    key: "electrics",
    title: "Электрика",
    keywords: ["фара", "фонар", "поворот", "контроллер", "провод", "разъем", "панел", "сигнал", "зарядн", "bms"],
  },
  {
    key: "motor",
    title: "Мотор",
    keywords: ["мотор", "мотор-колес", "обмотк", "холл", "ротор", "статор"],
  },
  {
    key: "suspension",
    title: "Подвеска",
    keywords: ["подшип", "амортиз", "вилка", "сальник", "втулк подвеск"],
  },
];
const INVENTORY_GROUP_TITLE = new Map(INVENTORY_GROUPS.map((group) => [group.key, group.title]));
INVENTORY_GROUP_TITLE.set("other", "Прочее");

function normalizeInventoryCategoryKey(rawValue) {
  const key = String(rawValue || "").trim().toLowerCase();
  return INVENTORY_GROUP_TITLE.has(key) ? key : "";
}

function resolveInventoryCategory(item) {
  const explicit = normalizeInventoryCategoryKey(item?.category);
  return explicit || getInventoryGroupForName(item?.name);
}

function setInventoryCategoryInForm(categoryKey) {
  if (!inventoryForm?.elements?.category) return;
  const normalized = normalizeInventoryCategoryKey(categoryKey);
  inventoryForm.elements.category.value = normalized;
  if (inventoryCurrentCategory) {
    inventoryCurrentCategory.textContent = INVENTORY_GROUP_TITLE.get(normalized) || "Не выбрана";
  }
}

function renderInventoryTransferOptions(selectedKey) {
  if (!inventoryTransferOptions) return;
  const options = [...INVENTORY_GROUPS.map((g) => g.key), "other"];
  inventoryTransferOptions.innerHTML = options
    .map((key) => {
      const active = key === selectedKey;
      return `<button class="inventory-transfer-option ${active ? "is-active" : ""}" type="button" data-action="inventory-transfer-select" data-category="${key}">${escapeHtml(
        INVENTORY_GROUP_TITLE.get(key) || "Прочее"
      )}</button>`;
    })
    .join("");
}

function getInventoryGroupForName(rawName) {
  const name = String(rawName || "").toLowerCase();
  const match = INVENTORY_GROUPS.find((group) => group.keywords.some((keyword) => name.includes(keyword)));
  return match?.key || "other";
}

function renderInventory() {
  const canManage = getRole() === "mechanic";
  if (inventorySearchInput) {
    inventorySearchInput.value = state.inventorySearch || "";
  }
  const query = String(state.inventorySearch || "").trim().toLowerCase();
  const rows = state.inventory
    .filter((item) => (!query ? true : String(item.name || "").toLowerCase().includes(query)))
    .sort((a, b) => {
      const ta = inventoryStockTier(a);
      const tb = inventoryStockTier(b);
      if (ta !== tb) return ta - tb;
      return String(a.name || "").localeCompare(String(b.name || ""), "ru", { sensitivity: "base" });
    });

  if (!rows.length) {
    state.inventoryActiveGroup = "";
    inventoryGrid.innerHTML = '<article class="inventory-card"><p class="muted">Запчасти не найдены.</p></article>';
    return;
  }

  const grouped = new Map();
  [...INVENTORY_GROUPS.map((g) => g.key), "other"].forEach((key) => grouped.set(key, []));
  rows.forEach((item) => {
    grouped.get(resolveInventoryCategory(item)).push(item);
  });

  const nonEmptyGroups = Array.from(grouped.entries()).filter(([, items]) => items.length > 0);
  const hasActiveGroup = state.inventoryActiveGroup && grouped.has(state.inventoryActiveGroup) && grouped.get(state.inventoryActiveGroup).length > 0;

  if (!hasActiveGroup) {
    state.inventoryActiveGroup = "";
    inventoryGrid.innerHTML = `
      <div class="inventory-category-grid">
        ${nonEmptyGroups
          .map(
            ([groupKey, items]) => `
              <button class="inventory-category-card" type="button" data-action="open-inventory-group" data-group="${escapeHtml(groupKey)}">
                <span class="inventory-category-title">${escapeHtml(INVENTORY_GROUP_TITLE.get(groupKey) || "Прочее")}</span>
                <span class="inventory-category-count">${items.length}</span>
              </button>
            `
          )
          .join("")}
      </div>
    `;
    return;
  }

  const cardHtml = (item) => {
    const stock = Number(item.stock || 0);
    const isOut = stock <= 0;
    const isLow = stock === 1;
    const chipClass = isOut ? "stock-chip-danger" : isLow ? "stock-chip-warn" : "stock-chip-ok";
    return `
      <article class="inventory-card inventory-card-minimal ${canManage ? "is-clickable" : ""}" ${canManage ? `data-action="open-inventory-item" data-id="${item.id}"` : ""}>
        <div class="inventory-minimal-head">
          <strong>${escapeHtml(item.name)}</strong>
          <div class="inventory-minimal-right">
            <span class="stock-chip ${chipClass}">${escapeHtml(String(Math.max(stock, 0)))}</span>
          </div>
        </div>
      </article>
    `;
  };

  const groupItems = grouped.get(state.inventoryActiveGroup) || [];
  inventoryGrid.innerHTML = `
    <section class="inventory-group">
      <div class="inventory-group-toolbar">
        <button class="ghost-btn inventory-group-back" type="button" data-action="close-inventory-group">Назад к категориям</button>
        <h3 class="inventory-group-title">${escapeHtml(INVENTORY_GROUP_TITLE.get(state.inventoryActiveGroup) || "Прочее")} <span>(${groupItems.length})</span></h3>
      </div>
      <div class="inventory-group-grid">
        ${groupItems.map(cardHtml).join("")}
      </div>
    </section>
  `;
}

function getBikeStatusChipList() {
  const bikes = state.bikes || [];
  const mechanicMode = getRole() === "mechanic";
  const mechanicVisible = new Set(["принят", "ждет запчасти", "в ремонте", "проверка", "готов"]);
  const bikesForFilter = mechanicMode
    ? bikes.filter((bike) => mechanicVisible.has(String(bike.status || "").trim()))
    : bikes;
  const counts = bikesForFilter.reduce((acc, bike) => {
    const status = String(bike.status || "нет данных").trim() || "нет данных";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return [
    { key: "all", label: `Все (${bikesForFilter.length})` },
    ...keys.map((key) => ({ key, label: `${key} (${counts[key]})` })),
  ];
}

function renderBikeFilterChips() {
  if (!bikeFilterChips) return;
  bikeFilterChips.innerHTML = getBikeStatusChipList()
    .map(
      (chip) =>
        `<button class="status-filter-chip ${state.bikeStatusFilter === chip.key ? "is-active" : ""}" type="button" data-bike-status-filter="${escapeHtml(chip.key)}">${escapeHtml(chip.label)}</button>`
    )
    .join("");
}

/** Завершённые ремонты (из очереди и вручную со статусом «Готов») для блока в парке. */
function getParkRepairHistoryItems() {
  const done = (state.repairs || []).filter((r) => String(r.status || "").trim().toLowerCase() === "готов");
  const q = String(state.bikeSearch || "").trim().toLowerCase();
  const rows = q
    ? done.filter((r) => {
        const hay = [r.bike, r.issue, r.work, r.parts_used].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
    : done;
  return rows
    .sort((a, b) => {
      const da = String(a.date || "");
      const db = String(b.date || "");
      if (da !== db) return db.localeCompare(da);
      return Number(b.id) - Number(a.id);
    })
    .slice(0, 100);
}

function renderBikeRepairHistory() {
  if (!bikeRepairHistory) return;
  const rows = getParkRepairHistoryItems();
  if (!rows.length) {
    bikeRepairHistory.innerHTML =
      '<p class="muted bike-history-empty">Нет записей.</p>';
    return;
  }
  bikeRepairHistory.innerHTML = rows
    .map(
      (item) => `
        <article class="bike-history-item">
          <div class="bike-history-item-head">
            <strong class="bike-history-code">${escapeHtml(item.bike)}</strong>
            <time class="muted bike-history-date" datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
          </div>
          <p class="bike-history-issue">${escapeHtml(item.issue || "—")}</p>
          <p class="bike-history-work muted">${escapeHtml(item.work || "—")}</p>
          ${
            item.parts_used && item.parts_used !== "-"
              ? `<p class="bike-history-parts"><span class="section-label">Запчасти</span> ${escapeHtml(item.parts_used)}</p>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function getFilteredBikes() {
  const query = String(state.bikeSearch || "").trim().toLowerCase();
  const mechanicMode = getRole() === "mechanic";
  const mechanicVisible = new Set(["принят", "ждет запчасти", "в ремонте", "проверка", "готов"]);
  return (state.bikes || [])
    .filter((bike) => {
      if (mechanicMode && !mechanicVisible.has(String(bike.status || "").trim())) return false;
      if (state.bikeStatusFilter !== "all" && String(bike.status) !== state.bikeStatusFilter) return false;
      if (!query) return true;
      const hay = [
        bike.code,
        bike.model,
        bike.status,
        bike.notes,
        bike.latest_repair_issue,
        bike.latest_repair_date,
        bike.vin,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
}

function renderBikes() {
  if (!bikesTable) return;
  const canManage = getRole() === "mechanic";
  renderBikeFilterChips();
  if (bikeSearchInput) bikeSearchInput.value = state.bikeSearch || "";

  const rows = getFilteredBikes();
  bikesTable.innerHTML = rows
    .map((bike, index) => {
      const rowClick = canManage ? ` class="bike-row-clickable" data-action="edit-bike" data-id="${bike.id}"` : "";
      return `
        <tr${rowClick}>
          <td data-label="Номер">
            <span class="bike-row-leading">${BIKE_ROW_ICON_HTML}<strong>${escapeHtml(bike.code)}</strong></span>
          </td>
          <td data-label="Статус"><span class="status-pill ${getBikeStatusClass(bike.status)}">${escapeHtml(bike.status)}</span></td>
          <td class="mechanic-only" data-label="Действия">
            ${
              canManage
                ? `<div class="table-actions">
                    <button class="icon-btn" type="button" data-action="edit-bike" data-id="${bike.id}">Ред.</button>
                    <button class="danger-btn" type="button" data-action="delete-bike" data-id="${bike.id}">Удалить</button>
                  </div>`
                : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");

  if (!rows.length) {
    bikesTable.innerHTML = `<tr><td colspan="3" class="muted">Байки не найдены.</td></tr>`;
  }

  renderBikeRepairHistory();
}

function renderQueueFilterToolbar() {
  if (!queueFilterChipsEl) return;
  const orders = state.workOrders || [];
  const counts = {
    all: orders.length,
    in_repair: orders.filter((o) => o.status === "в ремонте").length,
    waiting_parts: orders.filter((o) => o.status === "ждет запчасти" || (o.missing_parts?.length > 0)).length,
    complex: orders.filter((o) => getOrderComplexityTone(o) === "is-red").length,
  };
  const chips = [
    { key: "all", label: `Все (${counts.all})` },
    { key: "in_repair", label: `В ремонте (${counts.in_repair})` },
    { key: "waiting_parts", label: `Ждут запчасти (${counts.waiting_parts})` },
    { key: "complex", label: `Сложные (${counts.complex})` },
  ];
  queueFilterChipsEl.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="status-filter-chip queue-filter-chip ${state.queueFilter === c.key ? "is-active" : ""}" data-queue-filter="${escapeHtml(c.key)}">${escapeHtml(c.label)}</button>`
    )
    .join("");
}

function renderStaleBadgesHtml(order) {
  if (order.status !== "в ремонте") return "";
  const st = getRepairStaleness(order);
  if (st === "overdue") return '<span class="queue-stale-badge is-overdue">Просрочено</span>';
  if (st === "long") return '<span class="queue-stale-badge is-long">Долго</span>';
  return "";
}

function staleActiveCardClass(order) {
  if (order.status !== "в ремонте") return "";
  return getRepairStaleness(order) ? " has-stale-warning" : "";
}

function renderWorkOrders() {
  if (!workOrdersBoard || !activeRepairBoard) return;
  const canManage = getRole() === "mechanic";
  renderQueueFilterToolbar();
  const filtered = (state.workOrders || []).filter(matchesQueueFilter);
  const activeOrders = filtered.filter((order) => order.status === "в ремонте");
  const queueOrders = filtered.filter((order) => order.status !== "в ремонте");

  const getPartsLine = (order) => {
    if (order.missing_parts?.length) {
      return order.missing_parts.map((p) => `${p.name} x${p.missing}`).join(", ");
    }
    return order.required_parts_text || "Запчасти не указаны";
  };

  const getTimeMetaLine = (order) => {
    if (order.status === "в ремонте" && order.started_at) {
      const started = new Date(order.started_at);
      const startedLabel = Number.isNaN(started.getTime()) ? "" : started.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      if (order.estimated_ready_at) {
        const eta = new Date(order.estimated_ready_at);
        const etaLabel = Number.isNaN(eta.getTime()) ? "" : eta.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
        if (startedLabel && etaLabel) return `Старт ${startedLabel} · ETA ${etaLabel}`;
      }
      if (startedLabel) return `Старт ${startedLabel}`;
    }
    const intakeRaw = order.intake_date || order.created_at;
    if (!intakeRaw) return "";
    const intakeDate = new Date(intakeRaw);
    if (Number.isNaN(intakeDate.getTime())) return "";
    return `Принят ${intakeDate.toLocaleDateString("ru-RU")}`;
  };

  const getPriorityBadge = (order) => {
    if (String(order.priority || "").toLowerCase() !== "высокий") return "";
    const note = String(order.owner_note || "").trim();
    const text = note ? `Приоритет: ${note}` : "Приоритет владельца";
    return `<span class="queue-priority-badge">${escapeHtml(text)}</span>`;
  };

  if (!activeOrders.length) {
    activeRepairBoard.innerHTML = '<div class="stack-item muted">Нет активного ремонта.</div>';
  } else {
    activeRepairBoard.innerHTML = activeOrders
      .map((order) => {
        const toneClass = getOrderComplexityTone(order);
        const parts = getPartsLine(order);
        return `
          <article class="content-card owner-card repair-compact-card queue-mini-card ${toneClass}${staleActiveCardClass(order)}" data-action="open-work-order" data-id="${order.id}">
            <div class="queue-mini-head">
              <strong class="queue-mini-bike">${escapeHtml(order.bike_code)}</strong>
              <div class="queue-mini-badges">${renderStaleBadgesHtml(order)}</div>
            </div>
            <p class="queue-mini-line queue-fault">${escapeHtml(order.fault || order.issue || "Поломка не указана")}</p>
            <p class="queue-mini-line queue-parts">${escapeHtml(parts)}</p>
            ${getTimeMetaLine(order) ? `<p class="queue-mini-line queue-meta">${escapeHtml(getTimeMetaLine(order))}</p>` : ""}
            ${getPriorityBadge(order)}
            <div class="table-actions">
              ${canManage ? `<button class="icon-btn" type="button" data-action="edit-work-order-diagnostic" data-id="${order.id}">Ред. диагн.</button>` : ""}
              ${canManage ? `<button class="icon-btn" type="button" data-action="edit-work-order-repair" data-id="${order.id}">Ред. ремонт</button>` : ""}
              ${order.can_mark_ready ? `<button class="primary-btn primary-btn-small" type="button" data-action="work-order-ready" data-id="${order.id}">На выдачу</button>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  if (!queueOrders.length) {
    workOrdersBoard.innerHTML = '<div class="stack-item muted">Очередь пуста.</div>';
    refreshRepairTimers();
    return;
  }

  workOrdersBoard.innerHTML = queueOrders
    .map((order) => {
      const toneClass = getOrderComplexityTone(order);
      const partsSummary = getPartsLine(order);
      return `
        <article class="content-card owner-card repair-compact-card queue-mini-card ${toneClass}" data-action="open-work-order" data-id="${order.id}">
          <div class="queue-mini-head">
            <strong class="queue-mini-bike">${escapeHtml(order.bike_code)}</strong>
          </div>
          <p class="queue-mini-line queue-fault">${escapeHtml(order.fault || order.issue || "Поломка не указана")}</p>
          <p class="queue-mini-line queue-parts">${escapeHtml(partsSummary)}</p>
          ${getTimeMetaLine(order) ? `<p class="queue-mini-line queue-meta">${escapeHtml(getTimeMetaLine(order))}</p>` : ""}
          ${getPriorityBadge(order)}
          <div class="table-actions">
            ${canManage ? `<button class="icon-btn" type="button" data-action="edit-work-order-diagnostic" data-id="${order.id}">Ред. диагн.</button>` : ""}
            ${canManage ? `<button class="icon-btn" type="button" data-action="edit-work-order-repair" data-id="${order.id}">Ред. ремонт</button>` : ""}
            ${order.can_start ? `<button class="primary-btn primary-btn-small" type="button" data-action="work-order-start" data-id="${order.id}">Начать ремонт</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  refreshRepairTimers();
}

function renderOwnerPanel() {
  const stats = getDashboardStats();
  ownerKpi.textContent = `${stats.inRepairNow}`;
  ownerKpiNote.textContent = "Байков в ремонте сейчас";

  const notifications = state.ownerNotifications || [];
  ownerNotificationsEl.innerHTML = notifications.length
    ? notifications
        .slice(0, 10)
        .map((item) => `<div class="stack-item"><strong>${item.severity === "high" ? "Срочно" : "Внимание"}</strong><p class="muted">${escapeHtml(item.text)}</p></div>`)
        .join("")
    : '<div class="stack-item muted">Уведомлений нет.</div>';

  // Paused repairs section
  const pausedEl = document.getElementById("owner-paused-repairs");
  if (pausedEl) {
    const paused = (state.workOrders || []).filter((o) => o.status === "приостановлен");
    if (!paused.length) {
      pausedEl.innerHTML = '<div class="stack-item muted">Все ремонты активны.</div>';
    } else {
      pausedEl.innerHTML = paused
        .map((o) => {
          const timeSpent = o.actual_minutes ? `${o.actual_minutes} мин` : "нет данных";
          const reason = o.pause_reason || "причина не указана";
          // Get last history entry for context
          return `
            <div class="paused-repair-card">
              <div class="paused-repair-top">
                <strong class="paused-repair-code">${escapeHtml(o.bike_code || "—")}</strong>
                <span class="paused-repair-time">⏱ ${escapeHtml(timeSpent)}</span>
              </div>
              <div class="paused-repair-fault muted">${escapeHtml(o.fault || o.issue || "—")}</div>
              <div class="paused-repair-mechanic muted">Механик: ${escapeHtml(o.mechanic_name || "—")}</div>
              <div class="paused-repair-reason">
                <span class="paused-reason-label">Причина паузы:</span>
                <span>${escapeHtml(reason)}</span>
              </div>
              <button class="ghost-btn paused-resume-btn" type="button"
                data-action="open-work-order" data-id="${o.id}">
                Открыть заявку →
              </button>
            </div>
          `;
        })
        .join("");
    }
  }

  ownerProcess.innerHTML = [
    `<div class="stack-item"><strong>Диагностика (период)</strong><p class="muted">${stats.diagnosedInPeriod}</p></div>`,
    `<div class="stack-item"><strong>ТО / проверка</strong><p class="muted">${stats.inspectionNow}</p></div>`,
    `<div class="stack-item"><strong>Ждут запчасти</strong><p class="muted">${stats.waitingPartsNow}</p></div>`,
    `<div class="stack-item"><strong>Приостановлено</strong><p class="muted">${(state.workOrders || []).filter((o) => o.status === "приостановлен").length}</p></div>`,
  ].join("");
}

function renderTeamChat() {
  if (!teamChatList) return;
  const rows = state.teamChat || [];
  if (!rows.length) {
    teamChatList.innerHTML = '<div class="muted">Пока пусто.</div>';
    return;
  }
  teamChatList.innerHTML = rows
    .slice(-40)
    .map((item) => {
      const mine = item.sender_role === getRole();
      return `
        <article class="team-chat-item ${mine ? "is-mine" : ""}">
          <div class="team-chat-meta">${escapeHtml(item.sender_name)} · ${new Date(item.created_at).toLocaleString("ru-RU")}</div>
          <div class="team-chat-text">${escapeHtml(item.message)}</div>
        </article>
      `;
    })
    .join("");
  teamChatList.scrollTop = teamChatList.scrollHeight;
}

function getChatLastReadAtMs() {
  try {
    const raw = window.localStorage.getItem(CHAT_LAST_READ_STORAGE_KEY);
    const value = Number(raw || 0);
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    return 0;
  }
}

function setChatLastReadAtMs(value) {
  const safeValue = Number(value || 0);
  if (!Number.isFinite(safeValue) || safeValue <= 0) return;
  try {
    window.localStorage.setItem(CHAT_LAST_READ_STORAGE_KEY, String(safeValue));
  } catch (error) {
    // ignore storage quota/private mode issues
  }
}

function getMessageCreatedAtMs(item) {
  const timestamp = Date.parse(String(item?.created_at || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getChatUnreadCount() {
  const myRole = getRole();
  if (!myRole) return 0;
  const lastReadAt = getChatLastReadAtMs();
  return (state.teamChat || []).reduce((count, item) => {
    if (!item || item.sender_role === myRole) return count;
    return getMessageCreatedAtMs(item) > lastReadAt ? count + 1 : count;
  }, 0);
}

function markChatAsRead() {
  if (state.activeSection !== "chat") return;
  const latestTimestamp = (state.teamChat || []).reduce(
    (maxValue, item) => Math.max(maxValue, getMessageCreatedAtMs(item)),
    0
  );
  setChatLastReadAtMs(latestTimestamp);
}

function renderChatUnreadBadges() {
  if (!chatUnreadBadges.length) return;
  const unreadCount = getChatUnreadCount();
  const visibleCount = unreadCount > 99 ? "99+" : String(unreadCount);
  chatUnreadBadges.forEach((badge) => {
    badge.textContent = visibleCount;
    badge.classList.toggle("hidden", unreadCount < 1);
  });
}

async function refreshTeamChat() {
  if (!state.user || teamChatPollInFlight) return;
  teamChatPollInFlight = true;
  try {
    const payload = await api("/api/team-chat", { method: "GET", headers: {}, notifyError: false });
    state.teamChat = payload.teamChat || [];
    state.repairTemplates = payload.repairTemplates || [];
    if (payload.telegramTransport) {
      state.telegramTransport = payload.telegramTransport;
      renderTelegramTransport();
    }
    renderTeamChat();
    markChatAsRead();
    renderChatUnreadBadges();
  } catch (error) {
    if (String(error.message).includes("Авторизация")) {
      state.user = null;
      render();
    }
  } finally {
    teamChatPollInFlight = false;
  }
}

// ─── REPAIR TIMER ────────────────────────────────────────────────────────────

let _timerCurrentOrderId = null;

function formatElapsedTime(startedAtIso) {
  if (!startedAtIso) return "00:00:00";
  const elapsed = Math.max(0, Date.now() - new Date(startedAtIso).getTime());
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function startRepairTimer(orderId, startedAtIso) {
  stopRepairTimer();
  _timerCurrentOrderId = orderId;
  const el = document.getElementById("repair-timer-display");
  if (!el) return;
  const update = () => {
    if (el) el.textContent = formatElapsedTime(startedAtIso);
  };
  update();
  state.repairTimerInterval = setInterval(update, 1000);
}

function stopRepairTimer() {
  if (state.repairTimerInterval) {
    clearInterval(state.repairTimerInterval);
    state.repairTimerInterval = null;
  }
  _timerCurrentOrderId = null;
}

// ─── PHOTO CAPTURE ───────────────────────────────────────────────────────────

async function resizePhotoToBase64(file, maxPx = 1024, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function uploadDiagnosticPhoto(diagnosticId, photoData) {
  return api(`/api/diagnostics/${diagnosticId}/photos`, {
    method: "POST",
    body: JSON.stringify({ photoData }),
    notifyError: true,
  });
}

async function uploadAllDiagnosticPhotos(diagnosticId) {
  const photos = state.diagnosticQuickFlow.photos || [];
  for (const photoData of photos) {
    try {
      await uploadDiagnosticPhoto(diagnosticId, photoData);
    } catch { /* best-effort */ }
  }
}

function renderPhotoPreview() {
  const container = document.getElementById("diagnostic-photo-preview");
  if (!container) return;
  const photos = state.diagnosticQuickFlow.photos || [];
  container.innerHTML = photos
    .map(
      (dataUrl, idx) => `
        <div class="diag-photo-thumb">
          <img src="${dataUrl}" alt="Фото ${idx + 1}" />
          <button class="diag-photo-delete" type="button" data-action="remove-diagnostic-photo" data-idx="${idx}" aria-label="Удалить фото">×</button>
        </div>
      `
    )
    .join("");
}

// ─── REPAIR TEMPLATES ────────────────────────────────────────────────────────

function renderRepairTemplates() {
  const list = document.getElementById("repair-templates-list");
  if (!list) return;
  const templates = state.repairTemplates || [];
  if (!templates.length) {
    list.innerHTML = `<p class="muted">Шаблонов пока нет. Создайте первый после сохранения диагностики.</p>`;
    return;
  }
  list.innerHTML = templates
    .map(
      (t) => `
        <article class="template-card">
          <div class="template-card-body">
            <strong>${escapeHtml(t.name)}</strong>
            <p class="muted">${escapeHtml([t.category, t.fault].filter(Boolean).join(" · ") || "—")}</p>
            <span class="status-pill">${escapeHtml(t.criticality || "—")}</span>
          </div>
          <div class="template-card-actions">
            <button class="ghost-btn" type="button" data-action="apply-template" data-id="${t.id}">Применить</button>
            <button class="danger-btn" type="button" data-action="delete-template" data-id="${t.id}">×</button>
          </div>
        </article>
      `
    )
    .join("");
}

// ─── KNOWLEDGE BASE ──────────────────────────────────────────────────────────

const WENBOX_KB = [
  {
    category: "Электрика",
    icon: "⚡",
    faults: [
      {
        title: "Не включается байк",
        symptoms: ["Тишина при нажатии кнопки", "Дисплей не загорается", "Нет реакции ни на что"],
        causes: ["Разряженная АКБ", "Повреждён предохранитель", "Окисление контактов батареи", "Неисправен контроллер"],
        steps: [
          "Зарядить АКБ полностью (3–4 ч на родном зарядном)",
          "Проверить предохранитель на блоке АКБ — заменить при необходимости",
          "Осмотреть разъём АКБ: окисление, погнутые пины — зачистить / выпрямить",
          "Проверить кнопку включения мультиметром в режиме прозвонки",
          "Проверить главный провод питания от АКБ до контроллера на обрыв",
          "Если всё выше в норме — заменить контроллер",
        ],
        tools: ["Мультиметр", "Отвёртки Phillips T10/T25", "Зарядное устройство"],
        parts: ["Контроллер", "Предохранитель"],
        minutes: 60,
      },
      {
        title: "Ошибка контроллера (мигает код на дисплее)",
        symptoms: ["На дисплее мигает буква E с цифрой", "Байк едет, но с ограничениями", "Байк не едет совсем"],
        causes: ["Обрыв датчика Холла в моторе", "Проблема с фазными проводами", "Перегрев контроллера", "Некорректные данные датчиков"],
        steps: [
          "Считать код ошибки с дисплея",
          "E01/E02 — датчик Холла: снять мотор-колесо, прозвонить датчики",
          "E03 — проблема фаз: проверить разъёмы трёх фазных проводов (зелёный, жёлтый, синий)",
          "E04 — перегрев: дать остыть 15 мин, проверить вентиляцию контроллера",
          "E08 — тормозной датчик замкнут: проверить концевик тормоза",
          "Очистить разъёмы контакторов от влаги/окисления, пересоединить",
        ],
        tools: ["Мультиметр", "Торцевые ключи 8/10 мм", "WD-40"],
        parts: ["Контроллер", "Датчик Холла"],
        minutes: 75,
      },
      {
        title: "Быстро садится батарея",
        symptoms: ["Заряда хватает на 5–10 км вместо 30+", "Падение напряжения под нагрузкой", "BMS отключает батарею"],
        causes: ["Деградация ячеек АКБ", "Неисправен BMS", "Утечка тока в проводке"],
        steps: [
          "Зарядить АКБ до 100%, измерить напряжение (должно быть 54–55 В для 48 В батареи)",
          "Дать нагрузку, наблюдать просадку: >10% — проблема ячеек",
          "Проверить ток холостого хода мультиметром: >50 мА — утечка",
          "Осмотреть разъёмы батареи на нагрев (тепловизором или рукой)",
          "Если BMS сбрасывается — требуется балансировка или замена АКБ",
        ],
        tools: ["Мультиметр", "Зарядное устройство"],
        parts: ["АКБ 48В 13Ач", "BMS плата"],
        minutes: 45,
      },
      {
        title: "Не работает зарядный порт",
        symptoms: ["Зарядное подключено, индикатор не светится", "Порт шатается", "Искры при подключении"],
        causes: ["Повреждён разъём порта", "Обрыв провода зарядки", "Неисправно зарядное устройство"],
        steps: [
          "Проверить зарядное устройство на другом байке или тестовой нагрузке",
          "Осмотреть порт: погнутые пины, трещины корпуса — заменить порт",
          "Прозвонить провода от порта до БМС на целостность",
          "При замене порта использовать термоусадку на всех соединениях",
        ],
        tools: ["Мультиметр", "Паяльник", "Термоусадка"],
        parts: ["Зарядный порт", "Зарядное устройство 54.6В"],
        minutes: 30,
      },
    ],
  },
  {
    category: "Колёса",
    icon: "🔵",
    faults: [
      {
        title: "Прокол / спускает колесо",
        symptoms: ["Колесо мягкое", "Видно повреждение покрышки", "Байк тянет в сторону"],
        causes: ["Прокол камеры", "Боковой порез покрышки", "Износ ниппеля"],
        steps: [
          "Снять колесо: открутить ось (гайки 15 мм), отсоединить тормозной суппорт",
          "Для мотор-колеса: аккуратно уложить, не натягивать фазные провода",
          "Снять покрышку монтажками, вынуть камеру",
          "Найти прокол: надуть камеру, опустить в воду — смотреть пузыри",
          "Заклеить или заменить камеру, установить обратно",
          "Проверить покрышку изнутри — извлечь источник прокола",
          "Накачать до 40–45 PSI",
        ],
        tools: ["Монтажки (2 шт.)", "Ключ 15 мм", "Насос с манометром", "Ванночка с водой"],
        parts: ["Камера 10\"", "Покрышка 10×2.5"],
        minutes: 25,
      },
      {
        title: "Люфт колеса (переднего или заднего)",
        symptoms: ["Колесо качается поперёк при проверке рукой", "Скрежет при движении", "Нестабильное управление"],
        causes: ["Износ подшипников ступицы", "Слабо затянута ось", "Деформация оси"],
        steps: [
          "Снять колесо, проверить затяжку оси (гайки 15 мм) — подтянуть до 30–35 Нм",
          "Если люфт остался — снять ступицу, проверить подшипники (6004 2RS)",
          "Извлечь старые подшипники съёмником или выколоткой",
          "Запрессовать новые подшипники (слегка смазать литолом)",
          "Собрать, проверить на люфт",
        ],
        tools: ["Ключи 15 мм", "Съёмник подшипников", "Молоток и выколотка", "Литол"],
        parts: ["Подшипник 6004 2RS (2 шт)"],
        minutes: 40,
      },
      {
        title: "Износ покрышки / боковой порез",
        symptoms: ["Видна нить корда", "Боковая грыжа", "Продольный порез боковины"],
        causes: ["Естественный износ", "Езда по бордюрам", "Перегруз байка"],
        steps: [
          "Снять колесо",
          "Полная замена покрышки — монтажками снять старую",
          "Установить новую, начиная со стороны вентиля",
          "Проверить, что борт покрышки сел равномерно по ободу",
          "Накачать до 45 PSI, осмотреть на биение",
        ],
        tools: ["Монтажки (2 шт.)", "Насос с манометром"],
        parts: ["Покрышка 10×2.5"],
        minutes: 20,
      },
    ],
  },
  {
    category: "Тормоза",
    icon: "🛑",
    faults: [
      {
        title: "Не тормозит (передний или задний)",
        symptoms: ["Слабый отклик на ручку тормоза", "Тормозной путь сильно увеличен", "Ручка проваливается"],
        causes: ["Стёрты тормозные колодки", "Замасленный тормозной диск", "Воздух в гидравлике (если гидравлика)", "Разрегулирован трос"],
        steps: [
          "Осмотреть колодки через смотровое окно суппорта — толщина >1 мм?",
          "Если <1 мм — заменить колодки",
          "Протереть диск изопропиловым спиртом",
          "Для механики: отрегулировать трос — подтянуть до появления упора в ручке",
          "Проверить натяжение троса на ходу",
        ],
        tools: ["Шестигранник 5 мм", "Отвёртка", "Изопропиловый спирт"],
        parts: ["Тормозные колодки (комплект)", "Тормозной трос"],
        minutes: 20,
      },
      {
        title: "Скрип тормоза",
        symptoms: ["Пронзительный скрип при торможении", "Вибрация на ручке тормоза"],
        causes: ["Загрязнены колодки или диск", "Колодки задубели", "Неправильный монтаж суппорта"],
        steps: [
          "Снять колодки, зашлифовать наждачкой P120 крест-накрест",
          "Протереть диск спиртом, проверить биение диска (норма <0.3 мм)",
          "Проверить крепёж суппорта — должен быть затянут без люфта",
          "Установить колодки, притормозить 10–15 раз с малой скорости",
        ],
        tools: ["Наждачная бумага P120", "Шестигранник 5 мм", "Линейка"],
        parts: ["Тормозные колодки"],
        minutes: 15,
      },
      {
        title: "Кривой тормозной диск (трение об суппорт)",
        symptoms: ["Периодический скрежет без нажатия тормоза", "Диск бьёт о колодки при вращении"],
        causes: ["Деформация диска от удара/перегрева", "Ненадлежащая затяжка болтов диска"],
        steps: [
          "Проверить болты крепления диска (Torx T25) — затянуть до 6–8 Нм",
          "Измерить биение диска: вращать колесо, поднести маркер 0.3 мм от диска",
          "Лёгкое биение (<0.5 мм): выправить специальным ключом-рычагом",
          "Сильное биение (>0.5 мм) или трещины — замена диска",
        ],
        tools: ["Torx T25", "Линейка / индикатор", "Ключ для правки диска"],
        parts: ["Тормозной диск 140 мм"],
        minutes: 30,
      },
      {
        title: "Закисший суппорт",
        symptoms: ["Один тормоз греется при езде", "Байк замедляется самостоятельно", "Колодки истираются быстро"],
        causes: ["Залипание поршня суппорта", "Загрязнение направляющих"],
        steps: [
          "Снять суппорт, очистить от грязи",
          "Выдавить поршень (использовать старую колодку + отвёртку)",
          "Очистить поршень и цилиндр тормозной жидкостью DOT4",
          "Смазать направляющие специальной смазкой для суппортов",
          "Установить обратно, проверить на зажим",
        ],
        tools: ["Ключ 8 мм", "Шприц", "Тормозная жидкость DOT4", "Смазка суппортов"],
        parts: ["Ремкомплект суппорта", "Тормозные колодки"],
        minutes: 45,
      },
    ],
  },
  {
    category: "Руль",
    icon: "🔄",
    faults: [
      {
        title: "Люфт рулевой колонки",
        symptoms: ["Руль качается вперёд-назад при нажатии", "Стук при торможении", "Нестабильное управление"],
        causes: ["Износ рулевого подшипника", "Слабо затянута гайка рулевой колонки"],
        steps: [
          "Проверить затяжку центральной гайки рулевой колонки (ключ 32 мм)",
          "Если не помогло — снять руль и проверить подшипник",
          "Извлечь старый подшипник (6000 2RS или рулевой конус)",
          "Смазать новый подшипник, установить",
          "Затянуть гайку колонки: руль должен поворачиваться без люфта и без тугих точек",
        ],
        tools: ["Ключ 32 мм", "Молоток и выколотка", "Литол"],
        parts: ["Подшипник рулевой 6000 2RS"],
        minutes: 45,
      },
      {
        title: "Руль стоит криво (не по центру)",
        symptoms: ["При движении прямо руль повёрнут на несколько градусов", "Байк уводит в сторону"],
        causes: ["Руль сдвинулся после удара", "Слабо затянут зажим руля"],
        steps: [
          "Остановиться на ровной поверхности, выставить переднее колесо прямо",
          "Ослабить болты хомута руля (шестигранник 5 мм)",
          "Выровнять руль по колесу — проверить симметрию ручек",
          "Затянуть болты крест-накрест до 8–10 Нм",
        ],
        tools: ["Шестигранник 5 мм"],
        parts: [],
        minutes: 10,
      },
      {
        title: "Тугой поворот руля",
        symptoms: ["Руль поворачивается с большим усилием", "Тугие точки при повороте"],
        causes: ["Перетянута гайка рулевой колонки", "Повреждён рулевой подшипник", "Изогнута вилка"],
        steps: [
          "Ослабить центральную гайку рулевой колонки на пол-оборота",
          "Проверить плавность поворота — добиться свободного хода без люфта",
          "Если тугие точки остались — снять руль, осмотреть шарики рулевого",
          "Заменить подшипник при наличии повреждений шариков или беговых дорожек",
        ],
        tools: ["Ключ 32 мм", "Литол"],
        parts: ["Подшипник рулевой"],
        minutes: 30,
      },
    ],
  },
  {
    category: "Мотор",
    icon: "⚙️",
    faults: [
      {
        title: "Не тянет мотор / слабая тяга",
        symptoms: ["Медленно едет", "Не берёт горки", "Перегревается при нагрузке"],
        causes: ["Неисправен контроллер", "Деградация АКБ", "Загрязнены фазные контакты", "Перегрев обмотки"],
        steps: [
          "Проверить напряжение АКБ под нагрузкой: должно быть >42 В",
          "Проверить фазные разъёмы (3 провода на моторе): надёжный контакт",
          "Осмотреть вентиляцию контроллера — очистить от грязи",
          "Дать байку остыть 20 мин, повторить тест",
          "Если всё выше в норме — диагностика контроллера или замена",
        ],
        tools: ["Мультиметр", "Баллончик со сжатым воздухом"],
        parts: ["Контроллер 48В 20А"],
        minutes: 60,
      },
      {
        title: "Посторонний шум мотора (скрежет, гул)",
        symptoms: ["Металлический скрежет при езде", "Гул на скоростях >15 км/ч", "Вибрация от заднего колеса"],
        causes: ["Износ подшипников мотора", "Попадание воды/грязи в мотор", "Повреждена обмотка"],
        steps: [
          "Снять мотор-колесо, прокрутить вручную — ощутить шероховатость?",
          "Снять крышку мотора (болты 6×М4)",
          "Осмотреть подшипники (6201 2RS) — замутнение, ржавчина → замена",
          "Продуть полость мотора, протереть магниты и обмотку",
          "Заменить подшипники, нанести немного смазки",
        ],
        tools: ["Ключ М4", "Выколотка", "Молоток", "Смазка моторных подшипников"],
        parts: ["Подшипник 6201 2RS (2 шт)"],
        minutes: 90,
      },
      {
        title: "Рывки при разгоне",
        symptoms: ["Мотор дёргает при старте", "Неравномерное ускорение"],
        causes: ["Неисправен один из датчиков Холла", "Плохой контакт фазного провода"],
        steps: [
          "Проверить разъём датчиков Холла (5-пиновый разъём) — плотность контакта",
          "Измерить напряжение на каждом датчике при вращении: должно меняться 0 → 5 В",
          "Неисправный датчик (застывшее напряжение) — замена",
          "Проверить фазные провода на целостность у разъёма",
        ],
        tools: ["Мультиметр"],
        parts: ["Датчик Холла 5 В"],
        minutes: 50,
      },
    ],
  },
  {
    category: "Пластик",
    icon: "🔧",
    faults: [
      {
        title: "Трещина / скол корпуса",
        symptoms: ["Видимая трещина на пластиковой детали", "Отломан кусок пластика"],
        causes: ["Удар при падении", "Вибрационная усталость", "УФ-деградация пластика"],
        steps: [
          "Оценить размер трещины: <3 см — можно заклеить; >3 см — замена",
          "Зачистить место трещины наждачкой P80",
          "Нанести пластиковый клей или эпоксидку с обратной стороны",
          "Прижать, держать 5 мин, дать 24 ч на полимеризацию",
          "Снаружи зашпаклевать, зашкурить P240, покрасить",
        ],
        tools: ["Наждачка P80/P240", "Клей для пластика / эпоксидка", "Шпаклёвка"],
        parts: ["Нужная деталь пластика", "Крепёж пластика"],
        minutes: 30,
      },
      {
        title: "Оторван крепёж / болтается деталь",
        symptoms: ["Деталь хлопает на ходу", "Видно сломанный «ус» или отверстие без крепежа"],
        causes: ["Вибрация сломала замок", "Потерян саморез/болт"],
        steps: [
          "Найти подходящий крепёж из ЗИП-комплекта",
          "Если сломан «ус» — установить стяжку-хомут или алюминиевую скобу",
          "Затянуть без фанатизма — пластик лопнет при перетяжке",
        ],
        tools: ["Отвёртка", "Кусачки", "Пластиковые хомуты"],
        parts: ["Крепёж пластика (комплект саморезов М3×8)"],
        minutes: 10,
      },
      {
        title: "Порез / разрыв сиденья",
        symptoms: ["Видимый порез дерматина", "Вылезает поролон"],
        causes: ["Острый предмет", "Вандализм"],
        steps: [
          "Небольшой порез (<5 см): нанести клей для кожи/ПВХ, прижать прищепками",
          "Большой разрыв: замена чехла сиденья — снять болты крепления сиденья (4×М6)",
          "Установить новый чехол, натянуть равномерно, зафиксировать",
        ],
        tools: ["Ключ М6", "Клей для ПВХ", "Степлер"],
        parts: ["Чехол сиденья Wenbox U2"],
        minutes: 20,
      },
    ],
  },
];

function renderKnowledgeBase() {
  const container = document.getElementById("kb-content");
  if (!container) return;

  const search = String((document.getElementById("kb-search")?.value || state.kbSearch || "")).toLowerCase().trim();
  const activeCategory = state.kbActiveCategory || "";

  if (!activeCategory) {
    container.innerHTML = WENBOX_KB.map(
      (cat) => `
        <button class="kb-category-card" type="button" data-action="kb-open-category" data-category="${escapeHtml(cat.category)}">
          <span class="kb-cat-icon">${cat.icon}</span>
          <strong>${escapeHtml(cat.category)}</strong>
          <span class="muted">${cat.faults.length} поломок</span>
        </button>
      `
    ).join("");
    return;
  }

  const catData = WENBOX_KB.find((c) => c.category === activeCategory);
  if (!catData) { container.innerHTML = ""; return; }

  const faults = search
    ? catData.faults.filter((f) =>
        f.title.toLowerCase().includes(search) ||
        f.symptoms.some((s) => s.toLowerCase().includes(search))
      )
    : catData.faults;

  container.innerHTML = `
    <button class="ghost-btn kb-back-btn" type="button" data-action="kb-back">← ${escapeHtml(catData.category)}</button>
    ${faults.length === 0 ? '<p class="muted">Ничего не найдено</p>' : ""}
    ${faults
      .map(
        (f, idx) => `
          <details class="kb-fault-card" ${search ? "open" : ""}>
            <summary>
              <strong>${escapeHtml(f.title)}</strong>
              <span class="kb-time-badge">${f.minutes} мин</span>
            </summary>
            <div class="kb-fault-body">
              <div class="kb-section">
                <span class="kb-label">Симптомы</span>
                <ul>${f.symptoms.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
              </div>
              <div class="kb-section">
                <span class="kb-label">Причины</span>
                <ul>${f.causes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
              </div>
              <div class="kb-section">
                <span class="kb-label">Пошаговый ремонт</span>
                <ol>${f.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
              </div>
              <div class="kb-section kb-row">
                <div>
                  <span class="kb-label">Инструменты</span>
                  <p class="muted">${escapeHtml(f.tools.join(", ") || "—")}</p>
                </div>
                <div>
                  <span class="kb-label">Запчасти</span>
                  <p class="muted">${escapeHtml(f.parts.join(", ") || "Не требуются")}</p>
                </div>
              </div>
            </div>
          </details>
        `
      )
      .join("")}
  `;
}

// ─── WORK ORDER DETAIL WITH TIMER ────────────────────────────────────────────

// ─── HELP BUTTONS IN MODALS ──────────────────────────────────────────────────

document.getElementById("diagnostic-help-btn")?.addEventListener("click", () => {
  document.getElementById("diagnostic-overlay")?.classList.add("hidden");
  navigateTo("knowledge-base");
});

document.getElementById("repair-help-btn")?.addEventListener("click", () => {
  document.getElementById("work-order-overlay")?.classList.add("hidden");
  navigateTo("knowledge-base");
});

function render() {
  const isAuthorized = Boolean(state.user);
  loginOverlay.classList.toggle("hidden", isAuthorized);
  document.body.classList.toggle("is-auth-locked", !isAuthorized);
  if (globalSearch) globalSearch.value = state.search;
  if (statusFilter) statusFilter.value = state.statusFilter;
  if (settingsForm) {
    settingsForm.elements.totalBikes.value = state.kpi.totalBikes || "";
    settingsForm.elements.targetRate.value = state.kpi.targetRate || "";
    if (settingsForm.elements.mechanicFocus) {
      settingsForm.elements.mechanicFocus.value = state.kpi.mechanicFocus || "оперативка";
    }
  }
  renderRoleContent();
  renderTelegramTransport();
  renderSectionHeader();
  renderMechanicDayFocus();
  renderSections();
  renderStatusChips();
  renderMetrics();
  renderTimeline();
  renderAlerts();
  renderBikeStatuses();
  renderEventsFeed();
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
  renderTeamChat();
  markChatAsRead();
  renderChatUnreadBadges();
  renderProfile();
  renderBikeFormStatusOptions();
  renderRepairTemplates();
  renderKnowledgeBase();
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
    state.teamChat = payload.teamChat || [];
    state.telegramTransport = payload.telegramTransport || { state: "disabled", label: "Telegram: off" };
    state.ownerNotifications = payload.ownerNotifications || [];
    if (state.issueChecklist.pendingWorkOrderId) {
      const pendingOrder = state.workOrders.find((item) => String(item.id) === String(state.issueChecklist.pendingWorkOrderId));
      if (!pendingOrder || pendingOrder.status !== "проверка") {
        state.issueChecklist.pendingWorkOrderId = "";
        state.issueChecklist.completedAt = "";
      }
    }
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

async function doLogout() {
  try {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    state.user = null;
    render();
  }
}

logoutButton.addEventListener("click", doLogout);

document.getElementById("profile-logout-btn")?.addEventListener("click", doLogout);
document.getElementById("profile-switch-account-btn")?.addEventListener("click", async () => {
  await doLogout();
  setTimeout(() => {
    document.getElementById("login-username")?.focus();
  }, 100);
});

document.getElementById("switch-account-button")?.addEventListener("click", async () => {
  await doLogout();
  // Focus the login username field for quick re-login
  setTimeout(() => {
    document.getElementById("login-username")?.focus();
  }, 100);
});

function openPasswordModal() {
  passwordError.classList.add("hidden");
  passwordMessage.classList.add("hidden");
  passwordForm.reset();
  accountOverlay.classList.remove("hidden");
}

accountButton.addEventListener("click", openPasswordModal);

profileOpenPasswordButton?.addEventListener("click", openPasswordModal);

currentUser?.addEventListener("click", () => {
  state.activeSection = "profile";
  closeMobileMenu();
  render();
});

topbarRolePill?.addEventListener("click", () => {
  if (!state.user) return;
  state.activeSection = "profile";
  closeMobileMenu();
  render();
});

openChatButton?.addEventListener("click", () => {
  state.activeSection = "chat";
  closeMobileMenu();
  render();
  teamChatList?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
  setInventoryCategoryInForm("");
  if (inventoryDeleteInModal) inventoryDeleteInModal.classList.add("hidden");
  inventoryCategoryEditor?.classList.add("hidden");
  inventoryTransferOptions?.classList.add("hidden");
  if (inventoryTransferOptions) inventoryTransferOptions.innerHTML = "";
  const inventoryModalTitle = inventoryOverlay?.querySelector("h2");
  if (inventoryModalTitle) inventoryModalTitle.textContent = "Добавить запчасть";
  inventoryOverlay.classList.remove("hidden");
});

closeInventoryModalButton?.addEventListener("click", () => {
  inventoryOverlay.classList.add("hidden");
  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
  setInventoryCategoryInForm("");
  if (inventoryDeleteInModal) inventoryDeleteInModal.classList.add("hidden");
  inventoryCategoryEditor?.classList.add("hidden");
  inventoryTransferOptions?.classList.add("hidden");
  if (inventoryTransferOptions) inventoryTransferOptions.innerHTML = "";
});

inventoryOverlay?.addEventListener("click", (event) => {
  if (event.target.closest(".modal-card")) return;
  inventoryOverlay.classList.add("hidden");
  inventoryForm.reset();
  delete inventoryForm.dataset.editId;
  setInventoryCategoryInForm("");
  if (inventoryDeleteInModal) inventoryDeleteInModal.classList.add("hidden");
  inventoryCategoryEditor?.classList.add("hidden");
  inventoryTransferOptions?.classList.add("hidden");
  if (inventoryTransferOptions) inventoryTransferOptions.innerHTML = "";
});

inventoryTransferToggle?.addEventListener("click", () => {
  if (!inventoryTransferOptions) return;
  inventoryTransferOptions.classList.toggle("hidden");
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
  const viewPanel = document.getElementById("diagnostic-view-panel");
  const wizard = document.getElementById("diagnostic-quick-wizard");
  if (viewPanel) { viewPanel.classList.add("hidden"); viewPanel.innerHTML = ""; }
  if (wizard) wizard.classList.remove("hidden");
  if (diagnosticModalTitle) diagnosticModalTitle.textContent = "Новая диагностика";
  resetDiagnosticFlow();
});
closeWorkOrderModalButton?.addEventListener("click", () => {
  workOrderOverlay?.classList.add("hidden");
  stopRepairTimer();
});
closeDashboardJumpModalButton?.addEventListener("click", () => {
  dashboardJumpOverlay?.classList.add("hidden");
});
dashboardJumpOverlay?.addEventListener("click", (event) => {
  if (event.target.closest(".modal-card")) return;
  dashboardJumpOverlay.classList.add("hidden");
});

mobileMenuToggle?.addEventListener("click", () => {
  toggleMobileMenu();
});

mobileNavOverlay?.addEventListener("click", () => {
  closeMobileMenu();
});

diagnosticQuickBack?.addEventListener("click", () => {
  state.diagnosticQuickFlow.step = Math.max(1, state.diagnosticQuickFlow.step - 1);
  showDiagnosticQuickErrors([]);
  syncDiagnosticWizard();
});

diagnosticQuickOptions?.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="diagnostic-quick-option"]');
  if (!button) return;
  const value = button.dataset.value || "";
  const currentStep = state.diagnosticQuickFlow.step;
  const cfg = DIAGNOSTIC_QUICK_STEPS[currentStep];
  if (!cfg) return;
  if (cfg.multi) {
    const current = new Set(state.diagnosticQuickFlow[cfg.key] || []);
    if (current.has(value)) {
      current.delete(value);
    } else if (current.size < (cfg.max || 50)) {
      current.add(value);
    }
    state.diagnosticQuickFlow[cfg.key] = Array.from(current);
    if (cfg.key === "categories") {
      state.diagnosticQuickFlow.faults = [];
      state.diagnosticQuickFlow.selectedParts = [];
      state.diagnosticQuickFlow.selectedPartsCategory = "";
      state.diagnosticQuickFlow.criticality = "";
      state.diagnosticQuickFlow.decision = "";
      state.diagnosticQuickFlow.queueReason = "";
    }
    if (cfg.key === "faults") {
      state.diagnosticQuickFlow.selectedParts = [];
      state.diagnosticQuickFlow.selectedPartsCategory = "";
      state.diagnosticQuickFlow.decision = "";
      state.diagnosticQuickFlow.queueReason = "";
    }
  } else {
    state.diagnosticQuickFlow[cfg.key] = value;
  }
  showDiagnosticQuickErrors([]);
  if (!cfg.multi && currentStep < DIAGNOSTIC_QUICK_TOTAL_STEPS) {
    state.diagnosticQuickFlow.step = Math.min(DIAGNOSTIC_QUICK_TOTAL_STEPS, currentStep + 1);
  }
  syncDiagnosticWizard();
});

diagnosticQuickSummaryCard?.addEventListener("click", (event) => {
  const decisionButton = event.target.closest('[data-action="diagnostic-decision"]');
  if (decisionButton) {
    state.diagnosticQuickFlow.decision = decisionButton.dataset.decision || "";
    if (state.diagnosticQuickFlow.decision !== "queue") {
      state.diagnosticQuickFlow.queueReason = "";
    }
    showDiagnosticQuickErrors([]);
    syncDiagnosticWizard();
    return;
  }
  const button = event.target.closest('[data-action="diagnostic-quick-part"]');
  const categoryButton = event.target.closest('[data-action="diagnostic-quick-part-category"]');
  if (categoryButton) {
    state.diagnosticQuickFlow.selectedPartsCategory = String(categoryButton.dataset.category || "").trim();
    showDiagnosticQuickErrors([]);
    syncDiagnosticWizard();
    return;
  }
  const categoryBackButton = event.target.closest('[data-action="diagnostic-quick-part-category-back"]');
  if (categoryBackButton) {
    state.diagnosticQuickFlow.selectedPartsCategory = "";
    showDiagnosticQuickErrors([]);
    syncDiagnosticWizard();
    return;
  }
  if (!button) return;
  const partName = String(button.dataset.part || "").trim();
  if (!partName) return;
  const current = new Set(state.diagnosticQuickFlow.selectedParts || []);
  if (current.has(partName)) current.delete(partName);
  else current.add(partName);
  state.diagnosticQuickFlow.selectedParts = Array.from(current);
  showDiagnosticQuickErrors([]);
  syncDiagnosticWizard();
});

diagnosticQuickSummaryCard?.addEventListener("input", (event) => {
  const textarea = event.target.closest("#diagnostic-queue-reason");
  if (!textarea) return;
  state.diagnosticQuickFlow.queueReason = textarea.value || "";
  // Do not re-render on every keystroke: it recreates textarea and drops mobile keyboard focus.
  showDiagnosticQuickErrors([]);
});

diagnosticQuickNext?.addEventListener("click", () => {
  diagnosticForm.dataset.afterSubmit = "";
  if (!canGoNextQuickStep()) {
    const bikeCode = updateBikeCodeHiddenInput("diagnostic");
    const mechanicName = String(state.user?.full_name || "").trim();
    showDiagnosticQuickErrors(getDiagnosticSubmitErrors(bikeCode, mechanicName));
    return;
  }
  if (state.diagnosticQuickFlow.step < DIAGNOSTIC_QUICK_TOTAL_STEPS) {
    state.diagnosticQuickFlow.step += 1;
    showDiagnosticQuickErrors([]);
    syncDiagnosticWizard();
    return;
  }
  diagnosticForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});

diagnosticQuickSaveOpen?.addEventListener("click", () => {
  const bikeCode = updateBikeCodeHiddenInput("diagnostic");
  const mechanicName = String(state.user?.full_name || "").trim();
  if (state.diagnosticQuickFlow.decision !== "take_repair") {
    showDiagnosticQuickErrors([
      "Для этой кнопки выбери вариант «Взять в ремонт».",
      ...getDiagnosticSubmitErrors(bikeCode, mechanicName),
    ]);
    return;
  }
  const validationErrors = getDiagnosticSubmitErrors(bikeCode, mechanicName);
  if (validationErrors.length) {
    showDiagnosticQuickErrors(validationErrors);
    return;
  }
  showDiagnosticQuickErrors([]);
  diagnosticForm.dataset.afterSubmit = "open-repairs";
  diagnosticForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});

diagnosticQuickDelete?.addEventListener("click", async () => {
  const editingId = String(diagnosticForm?.dataset?.editId || "").trim();
  if (!editingId) return;
  if (!window.confirm("Удалить эту диагностическую запись?")) return;
  try {
    await api(`/api/diagnostics/${editingId}`, { method: "DELETE", headers: {}, notifyError: true });
    diagnosticOverlay.classList.add("hidden");
    resetDiagnosticFlow();
    await bootstrap();
  } catch {
    // Ошибка уже показана через notifyError в api()
  }
});

refreshButton?.addEventListener("click", async () => {
  await bootstrap();
});

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    closeAllModals();
    navigateTo(button.dataset.section);
    closeMobileMenu();
    render();
  });
});

document.querySelectorAll(".mobile-tab").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.action === "start-diagnostic") {
      closeAllModals();
      resetDiagnosticFlow();
      state.activeSection = "diagnostics";
      openDiagnosticOverlay();
      closeMobileMenu();
      render();
      return;
    }
    closeAllModals();
    navigateTo(button.dataset.section);
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

issueChecklistStatus?.addEventListener("click", async () => {
  const items = getIssueChecklistItems();
  const isComplete = items.every((item) => Boolean(state.issueChecklist.checked[item.id]));
  if (!isComplete || !state.issueChecklist.pendingWorkOrderId) return;

  try {
    await api(`/api/work-orders/${state.issueChecklist.pendingWorkOrderId}/transition`, {
      method: "POST",
      body: JSON.stringify({ action: "complete_checklist" }),
      notifyError: true,
    });

    state.issueChecklist.completedAt = new Date().toLocaleString("ru-RU");
    state.issueChecklist.pendingWorkOrderId = "";
    saveIssueChecklistDraft();
    await bootstrap();
    state.activeSection = "repairs";
    render();
  } catch {
    // Ошибка уже показана через notifyError в api()
  }
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
    closeAllModals();
  }
});

globalSearch?.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderRepairsTable();
});

bikeSearchInput?.addEventListener("input", (event) => {
  state.bikeSearch = event.target.value;
  renderBikes();
});

inventorySearchInput?.addEventListener("input", (event) => {
  state.inventorySearch = event.target.value;
  renderInventory();
});

statusFilter?.addEventListener("change", (event) => {
  state.statusFilter = event.target.value;
  renderStatusChips();
  renderRepairsTable();
});

document.querySelectorAll("[data-status-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.statusFilter;
    if (statusFilter) statusFilter.value = state.statusFilter;
    renderStatusChips();
    renderRepairsTable();
  });
});

// bike status chips are handled in the main click handler below

repairForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!repairForm) return;

  const formData = new FormData(repairForm);
  const editingId = repairForm.dataset.editId;
  const bikeCode = updateBikeCodeHiddenInput("repair");

  if (!isValidBikeCode(bikeCode)) {
    repairForm.reportValidity();
    return;
  }

  try {
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
      notifyError: true,
    });

    repairForm.reset();
    resetBikeCodeValue("repair");
    delete repairForm.dataset.editId;
    repairOverlay.classList.add("hidden");
    state.repairDraftFromDiagnostic = null;
    state.activeSection = "repairs";
    await bootstrap();
  } catch {
    // Ошибка уже показана через notifyError в api()
  }
});

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(inventoryForm);
  const editingId = inventoryForm.dataset.editId;
  const submitButton = inventoryForm.querySelector('button[type="submit"]');
  const originalSubmitLabel = submitButton ? submitButton.textContent : "";

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Сохраняем...";
    }
    await api(editingId ? `/api/inventory/${editingId}` : "/api/inventory", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify({
        name: String(formData.get("name")).trim(),
        stock: Number(formData.get("stock")),
        category: normalizeInventoryCategoryKey(formData.get("category")),
      }),
      notifyError: true,
    });

    inventoryForm.reset();
    delete inventoryForm.dataset.editId;
    setInventoryCategoryInForm("");
    if (inventoryDeleteInModal) inventoryDeleteInModal.classList.add("hidden");
    inventoryCategoryEditor?.classList.add("hidden");
    inventoryTransferOptions?.classList.add("hidden");
    if (inventoryTransferOptions) inventoryTransferOptions.innerHTML = "";
    inventoryOverlay.classList.add("hidden");
    state.activeSection = "inventory";
    await bootstrap();
  } catch {
    // Ошибка уже показана через notifyError в api()
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitLabel || "Сохранить позицию";
    }
  }
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

  try {
    await api(editingId ? `/api/bikes/${editingId}` : "/api/bikes", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify({
        code: bikeCode,
        model: String(formData.get("model")).trim() || "Wenbox U2",
        status: String(formData.get("status")).trim(),
        notes: String(formData.get("notes")).trim(),
      }),
      notifyError: true,
    });

    bikeForm.reset();
    resetBikeCodeValue("bike");
    delete bikeForm.dataset.editId;
    bikeOverlay?.classList.add("hidden");
    state.activeSection = "bikes";
    await bootstrap();
  } catch {
    // Ошибка уже показана через notifyError в api()
  }
});

diagnosticForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bikeCode = updateBikeCodeHiddenInput("diagnostic");
  const mechanicName = String(state.user?.full_name || "").trim();
  diagnosticForm.elements.bike.value = bikeCode;
  diagnosticForm.elements.mechanicName.value = mechanicName;
  diagnosticForm.elements.date.value = new Date().toISOString().slice(0, 10);
  const cats = state.diagnosticQuickFlow.categories || [];
  diagnosticForm.elements.category.value = cats.length
    ? cats.join(", ")
    : (state.diagnosticQuickFlow.category || "");
  diagnosticForm.elements.fault.value = buildQuickFaultTitle();
  diagnosticForm.elements.symptoms.value = buildQuickSymptomsText();
  diagnosticForm.elements.conclusion.value = buildQuickConclusionText();
  diagnosticForm.elements.requiredParts.value = getQuickRequiredPartsText();

  const formData = new FormData(diagnosticForm);
  const editingId = diagnosticForm.dataset.editId;
  const afterSubmitAction = diagnosticForm.dataset.afterSubmit || "";
  const validationErrors = getDiagnosticSubmitErrors(bikeCode, mechanicName);

  if (validationErrors.length) {
    showDiagnosticQuickErrors(validationErrors);
    diagnosticForm.reportValidity();
    return;
  }
  showDiagnosticQuickErrors([]);

  // Validate photo requirement when taking for repair
  if (!editingId && state.diagnosticQuickFlow.decision === "take_repair" && !(state.diagnosticQuickFlow.photos || []).length) {
    showDiagnosticQuickErrors(["Сделай хотя бы 1 фото байка при взятии в ремонт — это обязательный фотоконтроль."]);
    return;
  }

  try {
    const diagMinutes = state.diagnosticStartedAt && !editingId
      ? Math.max(1, Math.round((Date.now() - state.diagnosticStartedAt) / 60000))
      : 0;

    const response = await api(editingId ? `/api/diagnostics/${editingId}` : "/api/diagnostics", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify({
        date: formData.get("date") || new Date().toISOString().slice(0, 10),
        bike: bikeCode,
        mechanicName,
        category: String(formData.get("category")).trim(),
        fault: String(formData.get("fault")).trim(),
        symptoms: String(formData.get("symptoms")).trim(),
        conclusion: String(formData.get("conclusion")).trim(),
        severity: getQuickSeverity(),
        recommendation:
          state.diagnosticQuickFlow.decision === "queue"
            ? `Поставить в очередь: ${String(state.diagnosticQuickFlow.queueReason || "").trim()}`
            : "Взять в ремонт",
        required_parts_text: String(formData.get("requiredParts")).trim(),
        diagnosticMinutes: diagMinutes,
      }),
      notifyError: true,
    });

    // Upload photos for new diagnostics
    if (!editingId && (state.diagnosticQuickFlow.photos || []).length) {
      const diagnosticId = response?.id || response?.diagnosticId;
      if (diagnosticId) {
        await uploadAllDiagnosticPhotos(diagnosticId);
      }
    }

    resetDiagnosticFlow();
    diagnosticOverlay.classList.add("hidden");
    state.activeSection = afterSubmitAction === "open-repairs" ? "repairs" : "diagnostics";
    diagnosticForm.dataset.afterSubmit = "";
    await bootstrap();
  } catch {
    // Ошибка уже показана через notifyError в api()
  }
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
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          totalBikes: Number(formData.get("totalBikes")),
          targetRate: Number(formData.get("targetRate")),
          mechanicFocus: String(formData.get("mechanicFocus") || "").trim(),
        }),
        notifyError: true,
      });
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  });
}

if (ownerPriorityForm) {
  ownerPriorityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(ownerPriorityForm);
    try {
      await api("/api/owner/assign-priority", {
        method: "POST",
        body: JSON.stringify({
          bikeCode: String(formData.get("bikeCode") || "").trim().toUpperCase(),
          priority: String(formData.get("priority") || "обычный").trim(),
          ownerNote: String(formData.get("ownerNote") || "").trim(),
        }),
        notifyError: true,
      });
      ownerPriorityForm.reset();
      if (ownerPriorityForm.elements.priority) ownerPriorityForm.elements.priority.value = "обычный";
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  });
}

if (teamChatForm) {
  teamChatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(teamChatForm);
    const message = String(formData.get("message") || "").trim();
    if (!message) return;
    const submitBtn = teamChatForm.querySelector('button[type="submit"]');
    try {
      if (submitBtn) submitBtn.disabled = true;
      await api("/api/team-chat", {
        method: "POST",
        body: JSON.stringify({ message }),
        notifyError: true,
      });
      teamChatForm.reset();
      await refreshTeamChat();
    } catch {
      // Ошибка уже показана через notifyError в api()
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileMessage.classList.add("hidden");

    const formData = new FormData(profileForm);
    try {
      const payload = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: String(formData.get("fullName")).trim(),
          position: String(formData.get("position")).trim(),
          phone: String(formData.get("phone")).trim(),
          telegram: String(formData.get("telegram")).trim(),
          notes: String(formData.get("notes")).trim(),
        }),
        notifyError: true,
      });

      profileMessage.textContent = payload.message;
      profileMessage.classList.remove("hidden");
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  });
}

document.addEventListener("click", async (event) => {
  const queueChip = event.target.closest("[data-queue-filter]");
  if (queueChip) {
    state.queueFilter = queueChip.dataset.queueFilter || "all";
    renderWorkOrders();
    return;
  }

  const bikeChip = event.target.closest("[data-bike-status-filter]");
  if (bikeChip) {
    state.bikeStatusFilter = bikeChip.dataset.bikeStatusFilter;
    renderBikes();
    return;
  }

  const dashboardPeriodTarget = event.target.closest("[data-dashboard-period]");
  if (dashboardPeriodTarget) {
    state.dashboardPeriod = dashboardPeriodTarget.dataset.dashboardPeriod;
    renderMetrics();
    return;
  }

  const dashboardJumpTarget = event.target.closest("[data-dashboard-jump]");
  if (dashboardJumpTarget) {
    const jump = dashboardJumpTarget.dataset.dashboardJump;
    openDashboardJumpModal(jump);
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
    try {
      await api(`/api/repairs/${id}`, { method: "DELETE", headers: {}, notifyError: true });
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  }

  if (action === "open-inventory-item") {
    const item = state.inventory.find((entry) => String(entry.id) === id);
    if (!item) return;
    const inventoryModalTitle = inventoryOverlay?.querySelector("h2");
    if (inventoryModalTitle) inventoryModalTitle.textContent = "Редактировать запчасть";
    inventoryForm.dataset.editId = id;
    inventoryForm.elements.name.value = item.name;
    inventoryForm.elements.stock.value = item.stock;
    const categoryKey = resolveInventoryCategory(item);
    setInventoryCategoryInForm(categoryKey);
    inventoryCategoryEditor?.classList.remove("hidden");
    inventoryTransferOptions?.classList.add("hidden");
    renderInventoryTransferOptions(categoryKey);
    if (inventoryDeleteInModal) inventoryDeleteInModal.classList.remove("hidden");
    inventoryOverlay.classList.remove("hidden");
    return;
  }

  if (action === "inventory-transfer-select") {
    const editingId = inventoryForm.dataset.editId;
    if (!editingId) return;
    const nextCategory = normalizeInventoryCategoryKey(target.dataset.category);
    const currentCategory = normalizeInventoryCategoryKey(inventoryForm.elements.category.value);
    if (!nextCategory || nextCategory === currentCategory) return;
    const name = String(inventoryForm.elements.name.value || "").trim();
    const stock = Number(inventoryForm.elements.stock.value || 0);
    if (!name) return;
    try {
      await api(`/api/inventory/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          stock,
          category: nextCategory,
        }),
        notifyError: true,
      });
      setInventoryCategoryInForm(nextCategory);
      renderInventoryTransferOptions(nextCategory);
      inventoryOverlay?.classList.add("hidden");
      inventoryForm.reset();
      delete inventoryForm.dataset.editId;
      inventoryCategoryEditor?.classList.add("hidden");
      inventoryTransferOptions?.classList.add("hidden");
      if (inventoryDeleteInModal) inventoryDeleteInModal.classList.add("hidden");
      if (inventoryTransferOptions) inventoryTransferOptions.innerHTML = "";
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
    return;
  }

  if (action === "open-inventory-group") {
    state.inventoryActiveGroup = target.dataset.group || "";
    renderInventory();
    return;
  }

  if (action === "close-inventory-group") {
    state.inventoryActiveGroup = "";
    renderInventory();
    return;
  }

  if (action === "delete-inventory-item") {
    if (!window.confirm("Удалить эту запчасть со склада?")) return;
    try {
      await api(`/api/inventory/${id}`, { method: "DELETE", headers: {}, notifyError: true });
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  }

  if (action === "view-diagnostic") {
    const item = (state.diagnostics || []).find((entry) => String(entry.id) === id);
    if (!item) return;
    openDiagnosticViewForOwner(item);
    return;
  }

  if (action === "edit-diagnostic") {
    const item = state.diagnostics.find((entry) => String(entry.id) === id);
    if (!item) return;
    resetDiagnosticFlow();
    diagnosticForm.dataset.editId = id;
    diagnosticForm.elements.date.value = item.date;
    loadDiagnosticIntoFlow(item);
    setBikeCodeValue("diagnostic", item.bike);
    openDiagnosticOverlay();
  }

  if (action === "edit-work-order-diagnostic") {
    const order = state.workOrders.find((entry) => String(entry.id) === id);
    if (!order || !order.diagnostic_id) {
      notify("Для этой заявки не найдена диагностика");
      return;
    }
    const diagnostic = state.diagnostics.find((entry) => String(entry.id) === String(order.diagnostic_id));
    if (!diagnostic) {
      notify("Диагностическая запись не найдена");
      return;
    }
    resetDiagnosticFlow();
    diagnosticForm.dataset.editId = String(diagnostic.id);
    diagnosticForm.elements.date.value = diagnostic.date;
    loadDiagnosticIntoFlow(diagnostic);
    setBikeCodeValue("diagnostic", diagnostic.bike);
    openDiagnosticOverlay();
    return;
  }

  if (action === "edit-work-order-repair") {
    const order = state.workOrders.find((entry) => String(entry.id) === id);
    if (!order || !repairForm) return;
    const inventoryParts = (order.parts || [])
      .map((part) => `${part.part_name} x${part.qty_required}`)
      .join(", ");
    const fallbackParts = String(order.required_parts_text || "").trim() || "-";
    const mappedStatus =
      order.status === "в ремонте"
        ? "В ремонте"
        : order.status === "проверка" || order.status === "готов"
          ? "Готов"
          : "Ожидает запчасти";
    state.repairDraftFromDiagnostic = null;
    delete repairForm.dataset.editId;
    repairForm.elements.date.value = String(order.intake_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    setBikeCodeValue("repair", order.bike_code || "");
    repairForm.elements.issue.value = order.fault || order.issue || "";
    repairForm.elements.work.value = order.planned_work && order.planned_work !== "-" ? order.planned_work : "Работы уточняются";
    repairForm.elements.partsUsed.value = "-";
    repairForm.elements.neededParts.value = inventoryParts || fallbackParts;
    repairForm.elements.status.value = mappedStatus;
    repairOverlay.classList.remove("hidden");
    return;
  }

  if (action === "delete-diagnostic") {
    if (!window.confirm("Удалить эту диагностическую запись?")) return;
    try {
      await api(`/api/diagnostics/${id}`, { method: "DELETE", headers: {}, notifyError: true });
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
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

  if (action === "open-dashboard-order") {
    const order = (state.workOrders || []).find((o) => String(o.id) === id);
    if (!order) return;
    dashboardJumpOverlay?.classList.add("hidden");
    openWorkOrderDetail(order);
    return;
  }

  if (action === "open-dashboard-diag") {
    const item = (state.diagnostics || []).find((d) => String(d.id) === id);
    if (!item) return;
    dashboardJumpOverlay?.classList.add("hidden");
    resetDiagnosticFlow();
    diagnosticForm.dataset.editId = id;
    diagnosticForm.elements.date.value = item.date;
    loadDiagnosticIntoFlow(item);
    setBikeCodeValue("diagnostic", item.bike || "");
    syncDiagnosticWizard();
    diagnosticOverlay?.classList.remove("hidden");
    return;
  }

  if (action === "open-dashboard-bike") {
    const bike = state.bikes.find((entry) => String(entry.id) === id);
    if (!bike || !bikeForm) return;
    dashboardJumpOverlay?.classList.add("hidden");
    bikeForm.dataset.editId = String(bike.id);
    if (bikeModalTitle) bikeModalTitle.textContent = "Редактирование байка";
    setBikeCodeValue("bike", bike.code);
    bikeForm.elements.model.value = bike.model || "Wenbox U2";
    bikeForm.elements.status.value = bike.status || (getRole() === "owner" ? "в аренде" : "на диагностике");
    bikeForm.elements.notes.value = bike.notes || "";
    bikeOverlay?.classList.remove("hidden");
    return;
  }

  if (action === "save-bike-status") {
    const bike = state.bikes.find((entry) => String(entry.id) === id);
    const statusSelect = document.querySelector(`[data-bike-status-id="${id}"]`);
    if (!bike || !statusSelect) return;
    try {
      await api(`/api/bikes/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          code: bike.code,
          model: bike.model || "Wenbox U2",
          status: String(statusSelect.value).trim(),
          notes: bike.notes || "",
        }),
        notifyError: true,
      });
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  }

  if (action === "delete-bike") {
    if (!window.confirm("Удалить этот байк из парка? Связанные активные заявки по нему тоже будут удалены.")) return;
    try {
      await api(`/api/bikes/${id}`, { method: "DELETE", headers: {}, notifyError: true });
      await bootstrap();
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
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
    try {
      await api(`/api/work-orders/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action: actionMap[action] }),
        notifyError: true,
      });
      await bootstrap();
      if (action === "work-order-ready") {
        const movedOrder = state.workOrders.find((entry) => String(entry.id) === String(id));
        if (movedOrder && movedOrder.status === "проверка") {
          startIssueChecklistForOrder(movedOrder);
        }
      }
    } catch {
      // Ошибка уже показана через notifyError в api()
    }
  }

  if (action === "start-diagnostic-category") {
    resetDiagnosticFlow();
    state.diagnosticQuickFlow.category = target.dataset.category || "";
    state.diagnosticQuickFlow.step = state.diagnosticQuickFlow.category ? 2 : 1;
    openDiagnosticOverlay();
  }

  // Templates
  if (action === "apply-template") {
    const template = (state.repairTemplates || []).find((t) => String(t.id) === id);
    if (!template) return;
    resetDiagnosticFlow();
    state.diagnosticQuickFlow.category = template.category || "";
    state.diagnosticQuickFlow.fault = template.fault || "";
    state.diagnosticQuickFlow.criticality = template.criticality || "";
    state.diagnosticQuickFlow.step = 4;
    openDiagnosticOverlay();
    notify("Шаблон применён — проверь данные и сохрани");
    return;
  }
  if (action === "delete-template") {
    if (!window.confirm("Удалить этот шаблон?")) return;
    try {
      await api(`/api/repair-templates/${id}`, { method: "DELETE", notifyError: true });
      await bootstrap();
    } catch { /* shown */ }
    return;
  }

  // Knowledge base navigation
  if (action === "kb-open-category") {
    state.kbActiveCategory = target.dataset.category || "";
    renderKnowledgeBase();
    return;
  }
  if (action === "kb-back") {
    state.kbActiveCategory = "";
    renderKnowledgeBase();
    return;
  }

  // Photo actions
  if (action === "remove-diagnostic-photo") {
    const idx = parseInt(target.dataset.idx, 10);
    if (!isNaN(idx)) {
      state.diagnosticQuickFlow.photos.splice(idx, 1);
      renderPhotoPreview();
    }
    return;
  }
});

inventoryDeleteInModal?.addEventListener("click", async () => {
  const editingId = String(inventoryForm.dataset.editId || "").trim();
  if (!editingId) return;
  if (!window.confirm("Удалить эту запчасть со склада?")) return;
  try {
    await api(`/api/inventory/${editingId}`, { method: "DELETE", headers: {}, notifyError: true });
    inventoryOverlay?.classList.add("hidden");
    inventoryForm.reset();
    delete inventoryForm.dataset.editId;
    setInventoryCategoryInForm("");
    inventoryCategoryEditor?.classList.add("hidden");
    inventoryTransferOptions?.classList.add("hidden");
    if (inventoryTransferOptions) inventoryTransferOptions.innerHTML = "";
    inventoryDeleteInModal.classList.add("hidden");
    await bootstrap();
  } catch {
    // Ошибка уже показана через notifyError в api()
  }
});

// ─── RECEIVE PARTS MODAL ────────────────────────────────────────────────────

const receivePartsOverlay = document.getElementById("receive-parts-overlay");
const receivePartsList = document.getElementById("receive-parts-list");
const receivePartsSearch = document.getElementById("receive-parts-search");
const receivePartsLowOnly = document.getElementById("receive-parts-low-only");
const receivePartsCount = document.getElementById("receive-parts-count");
const receivePartsSubmit = document.getElementById("receive-parts-submit");
const receivePartsNote = document.getElementById("receive-parts-note");

let _receivePartsQtys = {};

function renderReceivePartsList() {
  if (!receivePartsList) return;
  const search = (receivePartsSearch?.value || "").toLowerCase().trim();
  const lowOnly = receivePartsLowOnly?.checked || false;
  let items = [...(state.inventory || [])];

  if (lowOnly) items = items.filter((it) => (it.stock || 0) <= (it.min || 1));
  if (search) items = items.filter((it) => (it.name || "").toLowerCase().includes(search));

  // Sort: low stock first, then alphabetical
  items.sort((a, b) => {
    const aLow = (a.stock || 0) <= (a.min || 1) ? 0 : 1;
    const bLow = (b.stock || 0) <= (b.min || 1) ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return (a.name || "").localeCompare(b.name || "", "ru");
  });

  if (!items.length) {
    receivePartsList.innerHTML = `<p class="muted receive-parts-empty">Позиции не найдены</p>`;
    return;
  }

  receivePartsList.innerHTML = items
    .map((it) => {
      const qty = _receivePartsQtys[it.name] || 0;
      const isLow = (it.stock || 0) <= (it.min || 1);
      return `
        <div class="receive-row ${qty > 0 ? "receive-row-active" : ""} ${isLow ? "receive-row-low" : ""}" data-name="${escapeHtml(it.name)}">
          <div class="receive-row-info">
            <span class="receive-row-name">${escapeHtml(it.name)}</span>
            <span class="receive-row-stock ${isLow ? "receive-row-stock-low" : ""}">на складе: ${it.stock || 0} шт.</span>
          </div>
          <div class="receive-row-controls">
            <button class="receive-qty-btn" type="button" data-action="receive-decrement" data-name="${escapeHtml(it.name)}">−</button>
            <input
              class="receive-qty-input"
              type="number"
              min="0"
              max="999"
              value="${qty}"
              inputmode="numeric"
              data-name="${escapeHtml(it.name)}"
              aria-label="Количество для ${escapeHtml(it.name)}"
            />
            <button class="receive-qty-btn receive-qty-btn-plus" type="button" data-action="receive-increment" data-name="${escapeHtml(it.name)}">+</button>
          </div>
        </div>
      `;
    })
    .join("");

  updateReceivePartsCount();
}

function updateReceivePartsCount() {
  const total = Object.values(_receivePartsQtys).filter((v) => v > 0).length;
  if (receivePartsCount) receivePartsCount.textContent = `${total} позиц${total === 1 ? "ия" : total < 5 ? "ии" : "ий"} выбрано`;
  if (receivePartsSubmit) receivePartsSubmit.disabled = total === 0;
}

function openReceivePartsModal() {
  _receivePartsQtys = {};
  if (receivePartsSearch) receivePartsSearch.value = "";
  if (receivePartsLowOnly) receivePartsLowOnly.checked = true;
  if (receivePartsNote) receivePartsNote.value = "";
  renderReceivePartsList();
  receivePartsOverlay?.classList.remove("hidden");
}

document.getElementById("open-receive-parts-modal")?.addEventListener("click", openReceivePartsModal);
document.getElementById("close-receive-parts-modal")?.addEventListener("click", () => receivePartsOverlay?.classList.add("hidden"));

receivePartsSearch?.addEventListener("input", renderReceivePartsList);
receivePartsLowOnly?.addEventListener("change", renderReceivePartsList);

receivePartsList?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const name = btn.dataset.name;
  const action = btn.dataset.action;
  if (!name) return;

  if (action === "receive-increment") {
    _receivePartsQtys[name] = (_receivePartsQtys[name] || 0) + 1;
  } else if (action === "receive-decrement") {
    _receivePartsQtys[name] = Math.max(0, (_receivePartsQtys[name] || 0) - 1);
    if (_receivePartsQtys[name] === 0) delete _receivePartsQtys[name];
  }
  renderReceivePartsList();
});

receivePartsList?.addEventListener("input", (event) => {
  const input = event.target.closest(".receive-qty-input");
  if (!input) return;
  const name = input.dataset.name;
  const val = Math.max(0, Math.min(999, parseInt(input.value, 10) || 0));
  if (val > 0) {
    _receivePartsQtys[name] = val;
  } else {
    delete _receivePartsQtys[name];
  }
  input.closest(".receive-row").classList.toggle("receive-row-active", val > 0);
  updateReceivePartsCount();
});

receivePartsSubmit?.addEventListener("click", async () => {
  const items = Object.entries(_receivePartsQtys)
    .filter(([, qty]) => qty > 0)
    .map(([name, addedQty]) => ({ name, addedQty }));
  if (!items.length) return;

  receivePartsSubmit.disabled = true;
  receivePartsSubmit.textContent = "Принимаем…";

  try {
    const result = await api("/api/inventory/receive", {
      method: "POST",
      body: JSON.stringify({ items, supplierNote: receivePartsNote?.value?.trim() || "" }),
      notifyError: true,
    });
    receivePartsOverlay?.classList.add("hidden");
    notify(`Принято ${result.acceptedCount || items.length} позиций`);
    await bootstrap();
  } catch {
    receivePartsSubmit.disabled = false;
    receivePartsSubmit.textContent = "Принять";
  }
});

// Pause repair flow
const pauseRepairOverlay = document.getElementById("pause-repair-overlay");
const pauseReasonInput = document.getElementById("pause-reason-input");
const confirmPauseBtn = document.getElementById("confirm-pause-repair");
let _pauseTargetOrderId = null;

document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action='open-pause-repair']");
  if (!btn) return;
  const timerBlock = document.getElementById("repair-timer-block");
  _pauseTargetOrderId = timerBlock?.dataset.orderId || btn.dataset.orderId || null;
  if (!_pauseTargetOrderId) return;
  if (pauseReasonInput) pauseReasonInput.value = "";
  pauseRepairOverlay?.classList.remove("hidden");
});

document.getElementById("close-pause-repair-modal")?.addEventListener("click", () => {
  pauseRepairOverlay?.classList.add("hidden");
  _pauseTargetOrderId = null;
});

confirmPauseBtn?.addEventListener("click", async () => {
  if (!_pauseTargetOrderId) return;
  confirmPauseBtn.disabled = true;
  confirmPauseBtn.textContent = "Сохраняю…";
  try {
    await api(`/api/work-orders/${_pauseTargetOrderId}/transition`, {
      method: "POST",
      body: JSON.stringify({ action: "pause_repair", pauseReason: pauseReasonInput?.value?.trim() || "" }),
      notifyError: true,
    });
    pauseRepairOverlay?.classList.add("hidden");
    workOrderOverlay?.classList.add("hidden");
    stopRepairTimer();
    _pauseTargetOrderId = null;
    notify("Ремонт приостановлен, байк возвращён в очередь");
    await bootstrap();
  } catch {
    confirmPauseBtn.disabled = false;
    confirmPauseBtn.textContent = "⏸ Подтвердить паузу";
  }
});

// Resume repair
document.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action='resume-repair-btn']");
  if (!btn) return;
  const block = document.getElementById("pause-repair-block");
  const orderId = block?.dataset.orderId;
  if (!orderId) return;
  try {
    await api(`/api/work-orders/${orderId}/transition`, {
      method: "POST",
      body: JSON.stringify({ action: "resume_repair" }),
      notifyError: true,
    });
    workOrderOverlay?.classList.add("hidden");
    notify("Байк возвращён в очередь — можно начать ремонт снова");
    await bootstrap();
  } catch { /* shown */ }
});

// Timer save button
document.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action='save-repair-time']");
  if (!btn) return;
  const block = document.getElementById("repair-timer-block");
  if (!block) return;
  const orderId = block.dataset.orderId;
  const startedAt = block.dataset.startedAt;
  if (!orderId || !startedAt) return;
  const elapsed = Math.round(Math.max(0, Date.now() - new Date(startedAt).getTime()) / 60000);
  try {
    await api(`/api/work-orders/${orderId}/actual-time`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes: elapsed }),
      notifyError: true,
    });
    const actualEl = block.querySelector(".repair-timer-actual");
    if (actualEl) {
      actualEl.textContent = `Сохранено: ${elapsed} мин`;
      actualEl.classList.remove("hidden");
    }
    notify(`Время записано: ${elapsed} мин`);
  } catch { /* shown */ }
});

// Photo capture input — delegated because the input is rendered dynamically
document.addEventListener("change", async (event) => {
  const input = event.target.closest("#diagnostic-photo-input");
  if (!input) return;
  const files = Array.from(input.files || []);
  for (const file of files) {
    const dataUrl = await resizePhotoToBase64(file);
    if (dataUrl) {
      state.diagnosticQuickFlow.photos.push(dataUrl);
    }
  }
  input.value = "";
  renderPhotoPreview();
});

// Save as template after diagnostic submit
document.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action='save-as-template']");
  if (!btn) return;
  const name = window.prompt("Название шаблона:", state.diagnosticQuickFlow.fault || state.diagnosticQuickFlow.category || "Новый шаблон");
  if (!name) return;
  try {
    await api("/api/repair-templates", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        category: state.diagnosticQuickFlow.category || "",
        fault: state.diagnosticQuickFlow.fault || "",
        criticality: state.diagnosticQuickFlow.criticality || "",
        requiredPartsText: (state.diagnosticQuickFlow.selectedParts || []).join(", "),
      }),
      notifyError: true,
    });
    notify("Шаблон сохранён");
    await bootstrap();
  } catch { /* shown */ }
});

// KB search
document.getElementById("kb-search")?.addEventListener("input", (event) => {
  state.kbSearch = event.target.value;
  renderKnowledgeBase();
});

// Add kbActiveCategory and kbSearch to state
if (!("kbActiveCategory" in state)) state.kbActiveCategory = "";
if (!("kbSearch" in state)) state.kbSearch = "";

syncBikeCodeBuilders();
window.setInterval(refreshRepairTimers, 1000);
window.setInterval(refreshTeamChat, TEAM_CHAT_POLL_INTERVAL_MS);
loadIssueChecklistDraft();
bootstrap();
