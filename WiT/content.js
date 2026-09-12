// =======================================================
// 0. 기본 설정
// =======================================================
const BATCH_SIZE = 5;
const VIEWPORT_PRELOAD_PX = 360;

let searchTarget = null;
let pendingHome = null;
let pendingSchool = null;
let scanRunning = false;
let scrollTimer = null;
let resizeTimer = null;

// =======================================================
// 1. Chrome storage / background 통신
// =======================================================
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function getUserData() {
  return new Promise(resolve => {
    chrome.storage.local.get(["witUser"], result => {
      resolve(result.witUser || null);
    });
  });
}

async function saveUserData(data) {
  return new Promise(resolve => {
    chrome.storage.local.set({ witUser: data }, resolve);
  });
}

async function searchLocation(query) {
  const response = await sendMessage({
    type: "WIT_SEARCH_ADDRESS",
    query
  });

  if (!response?.ok) {
    throw new Error(response?.error || "주소 검색 실패");
  }

  return response.data?.results || [];
}

async function fetchRoute(start, end) {
  const response = await sendMessage({
    type: "WIT_ROUTE",
    payload: { start, end }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "ODsay 경로 계산 실패");
  }

  return response.data;
}

// =======================================================
// 2. 공통 UI
// =======================================================
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  document.querySelector(".wit-toast")?.remove();

  const toast = document.createElement("div");
  toast.className = "wit-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2200);
}

function setOverlayVisible(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.toggle("wit-hidden", !visible);
}

function getColorTheme(dropRate) {
  const rate = Number(dropRate);

  if (rate > 30) {
    return {
      border: "#ef4444",
      bg: "#fef2f2",
      text: "#b91c1c"
    };
  }

  if (rate >= 20) {
    return {
      border: "#f97316",
      bg: "#fff7ed",
      text: "#c2410c"
    };
  }

  if (rate >= 10) {
    return {
      border: "#eab308",
      bg: "#fefce8",
      text: "#854d0e"
    };
  }

  return {
    border: "#10b981",
    bg: "#ecfdf5",
    text: "#047857"
  };
}

// =======================================================
// 3. 모달 UI 생성
// =======================================================
function initUi() {
  if (document.getElementById("wit-address-modal")) return;

  const html = `
    <div id="wit-address-modal" class="wit-overlay wit-hidden">
      <div class="wit-panel">
        <div class="wit-panel-header">
          <div class="wit-brand-row">
            <div class="wit-logo">WiT</div>
            <div>
              <h2 class="wit-title">내 기준 주소지 설정</h2>
              <p class="wit-subtitle">한 번 저장하면 알바 공고마다 자동으로 비교해요.</p>
            </div>
          </div>
          <button id="wit-address-close" class="wit-icon-button" type="button">×</button>
        </div>

        <div class="wit-panel-body">
          <div class="wit-field">
            <label class="wit-label">집 주소 <span class="wit-required">*</span></label>
            <div class="wit-input-row">
              <input id="wit-home-input" class="wit-input" type="text" readonly
                placeholder="주소/장소를 검색해 선택하세요">
              <button id="wit-home-search" class="wit-secondary-button" type="button">주소 검색</button>
            </div>
          </div>

          <div class="wit-field">
            <label class="wit-label">학교 주소 <span class="wit-required">*</span></label>
            <div class="wit-input-row">
              <input id="wit-school-input" class="wit-input" type="text" readonly
                placeholder="학교명 또는 주소를 검색하세요">
              <button id="wit-school-search" class="wit-secondary-button" type="button">주소 검색</button>
            </div>
          </div>

          <div class="wit-route-setting">
            <div>
              <label>알바 가기 전</label>
              <select id="wit-start-select" class="wit-select">
                <option value="home">집</option>
                <option value="school">학교</option>
              </select>
            </div>

            <div class="wit-route-arrow">→</div>

            <div>
              <label>알바 끝난 후</label>
              <select id="wit-end-select" class="wit-select">
                <option value="home">집</option>
                <option value="school">학교</option>
              </select>
            </div>
          </div>

          <p class="wit-helper">
            WiT은 선택한 출발지 → 근무지 → 도착지의 실제 ODsay 대중교통 시간·요금·거리를 체감 시급에 반영합니다.
          </p>

          <button id="wit-address-save" class="wit-primary-button" type="button">
            저장하고 계산하기
          </button>
        </div>
      </div>
    </div>

    <div id="wit-search-modal" class="wit-overlay wit-hidden">
      <div class="wit-panel wit-panel-small">
        <div class="wit-panel-header">
          <div class="wit-brand-row">
            <div class="wit-logo">WiT</div>
            <div>
              <h2 class="wit-title">주소 · 장소 검색</h2>
              <p class="wit-subtitle">도로명, 지번, 학교명 모두 검색할 수 있어요.</p>
            </div>
          </div>
          <button id="wit-search-close" class="wit-icon-button" type="button">×</button>
        </div>

        <div class="wit-search-bar">
          <input id="wit-search-input" class="wit-search-input" type="text"
            placeholder="예: 고려대학교, 반포대로 58">
          <button id="wit-search-button" class="wit-secondary-button" type="button">검색</button>
        </div>

        <div id="wit-search-results" class="wit-search-results">
          <div class="wit-search-empty">
            주소나 장소 이름을 입력한 뒤 검색해 주세요.
          </div>
        </div>
      </div>
    </div>

    <div id="wit-detail-modal" class="wit-overlay wit-hidden">
      <div class="wit-panel">
        <div class="wit-panel-header">
          <div class="wit-brand-row">
            <div class="wit-logo">WiT</div>
            <div>
              <h2 class="wit-title">이 알바, Worth It?</h2>
              <p class="wit-subtitle">표시 시급이 아니라 내 하루에 남는 실제 가치를 봐요.</p>
            </div>
          </div>
          <button id="wit-detail-close" class="wit-icon-button" type="button">×</button>
        </div>

        <div class="wit-panel-body">
          <div class="wit-wage-summary">
            <div class="wit-summary-label">공고 기준 시급</div>
            <div id="wit-detail-posted" class="wit-posted-wage">0원</div>
            <div id="wit-detail-work-address" class="wit-work-address"></div>
          </div>

          <div class="wit-route-card">
            <div class="wit-route-row">
              <div id="wit-route-to-label" class="wit-route-label">출발지 → 근무지</div>
              <div class="wit-route-values">
                <span>시간 <strong id="wit-route-to-time">-</strong></span>
                <span>거리 <strong id="wit-route-to-distance">-</strong></span>
                <span>교통비 <strong id="wit-route-to-cost">-</strong></span>
              </div>
            </div>

            <div class="wit-route-row">
              <div id="wit-route-from-label" class="wit-route-label">근무지 → 도착지</div>
              <div class="wit-route-values">
                <span>시간 <strong id="wit-route-from-time">-</strong></span>
                <span>거리 <strong id="wit-route-from-distance">-</strong></span>
                <span>교통비 <strong id="wit-route-from-cost">-</strong></span>
              </div>
            </div>
          </div>

          <div id="wit-real-card" class="wit-real-card">
            <div class="wit-real-title">내 동선 반영 체감 시급</div>
            <div class="wit-real-main">
              <div id="wit-detail-real-wage" class="wit-real-wage">0원</div>
              <div id="wit-detail-drop" class="wit-drop">-</div>
            </div>
          </div>

          <div id="wit-detail-notice" class="wit-notice wit-hidden"></div>

          <p class="wit-formula">
            체감 시급 = (예상 임금 − 두 이동 구간의 교통비) ÷ (근무시간 + 두 이동 구간의 이동시간)
          </p>
        </div>
      </div>
    </div>

    <button id="wit-floating-button" class="wit-floating-button" type="button">
      📍 내 주소 설정
    </button>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  document.getElementById("wit-address-close").onclick =
    () => setOverlayVisible("wit-address-modal", false);

  document.getElementById("wit-search-close").onclick =
    () => setOverlayVisible("wit-search-modal", false);

  document.getElementById("wit-detail-close").onclick =
    () => setOverlayVisible("wit-detail-modal", false);

  document.getElementById("wit-floating-button").onclick =
    openAddressModal;

  document.getElementById("wit-home-search").onclick =
    () => openSearchModal("home");

  document.getElementById("wit-school-search").onclick =
    () => openSearchModal("school");

  document.getElementById("wit-search-button").onclick =
    executeSearch;

  document.getElementById("wit-search-input").addEventListener("keydown", e => {
    if (e.key === "Enter") executeSearch();
  });

  document.getElementById("wit-address-save").onclick =
    saveAddressSettings;
}

// =======================================================
// 4. 주소 검색 / 저장
// =======================================================
async function openAddressModal() {
  const user = await getUserData();

  pendingHome = user?.home ? { ...user.home } : null;
  pendingSchool = user?.school ? { ...user.school } : null;

  document.getElementById("wit-home-input").value =
    pendingHome?.address || "";

  document.getElementById("wit-school-input").value =
    pendingSchool?.address || "";

  document.getElementById("wit-start-select").value =
    user?.startPos || "school";

  document.getElementById("wit-end-select").value =
    user?.endPos || "home";

  setOverlayVisible("wit-address-modal", true);
}

function openSearchModal(target) {
  searchTarget = target;

  const input = document.getElementById("wit-search-input");
  const results = document.getElementById("wit-search-results");

  input.value = "";
  results.innerHTML = `
    <div class="wit-search-empty">
      주소나 장소 이름을 입력한 뒤 검색해 주세요.
    </div>
  `;

  setOverlayVisible("wit-search-modal", true);
  setTimeout(() => input.focus(), 30);
}

async function executeSearch() {
  const input = document.getElementById("wit-search-input");
  const resultsBox = document.getElementById("wit-search-results");
  const query = input.value.trim();

  if (!query) return;

  resultsBox.innerHTML = `
    <div class="wit-search-empty">검색 중...</div>
  `;

  try {
    const results = await searchLocation(query);

    if (!results.length) {
      resultsBox.innerHTML = `
        <div class="wit-search-empty">
          검색 결과가 없습니다.<br>
          도로명·지번·장소명을 조금 다르게 입력해 보세요.
        </div>
      `;
      return;
    }

    resultsBox.innerHTML = "";

    results.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wit-search-item";

      button.innerHTML = `
        <div class="wit-search-name">
          ${escapeHtml(item.place_name || item.address_name)}
        </div>
        <div class="wit-search-address">
          ${escapeHtml(item.address_name)}
        </div>
      `;

      button.onclick = () => {
        const selected = {
          address: item.address_name,
          placeName: item.place_name || "",
          x: Number(item.x),
          y: Number(item.y)
        };

        if (searchTarget === "home") {
          pendingHome = selected;
          document.getElementById("wit-home-input").value =
            selected.address;
        } else {
          pendingSchool = selected;
          document.getElementById("wit-school-input").value =
            selected.address;
        }

        setOverlayVisible("wit-search-modal", false);
      };

      resultsBox.appendChild(button);
    });

  } catch (error) {
    console.error("[WiT] 주소 검색 실패:", error);

    resultsBox.innerHTML = `
      <div class="wit-search-empty">
        주소 검색에 연결하지 못했습니다.<br>
        backend 서버가 켜져 있는지 확인해 주세요.<br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

async function saveAddressSettings() {
  if (!pendingHome?.x || !pendingHome?.y) {
    showToast("집 주소를 검색해서 선택해 주세요.");
    return;
  }

  if (!pendingSchool?.x || !pendingSchool?.y) {
    showToast("학교 주소를 검색해서 선택해 주세요.");
    return;
  }

  const data = {
    home: pendingHome,
    school: pendingSchool,
    startPos: document.getElementById("wit-start-select").value,
    endPos: document.getElementById("wit-end-select").value
  };

  await saveUserData(data);

  setOverlayVisible("wit-address-modal", false);
  sessionStorage.setItem("witSettingsOpened", "1");

  resetAllBadges();
  showToast("주소 설정 완료 · 실제 대중교통 경로를 계산합니다.");
  injectWageBadges();
}

// =======================================================
// 5. 알바 공고 정보 읽기
// =======================================================
function parseSalaryText(text) {
  const clean = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length > 90) return null;
  if (/월급|연봉|건별/.test(clean)) return null;

  let match = clean.match(/(?:시급|시)\s*([0-9][0-9,]*)\s*원?/);
  if (match) {
    const amount = Number(match[1].replaceAll(",", ""));
    if (amount >= 9000 && amount <= 100000) {
      return { type: "hourly", amount };
    }
  }

  match = clean.match(/(?:일급|일)\s*([0-9][0-9,]*)\s*원?/);
  if (match) {
    const amount = Number(match[1].replaceAll(",", ""));
    if (amount >= 30000 && amount <= 500000) {
      return { type: "daily", amount };
    }
  }

  return null;
}

function findCard(el) {
  let node = el;

  for (let depth = 0; depth < 9 && node && node !== document.body; depth++) {
    const rect = node.getBoundingClientRect();
    const text = (node.innerText || "").trim();

    const looksLikeCard =
      rect.width >= 260 &&
      rect.height >= 70 &&
      rect.height <= 520 &&
      text.length >= 15 &&
      text.length <= 1000 &&
      !!extractCleanAddress(text);

    if (looksLikeCard) {
      return node;
    }

    node = node.parentElement;
  }

  return (
    el.closest("li, tr, article, section, div[class*='item'], div[class*='card']") ||
    el.parentElement?.parentElement ||
    el.parentElement ||
    el
  );
}

function extractCleanAddress(cardText) {
  const text = String(cardText || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

  const patterns = [
    // 1. 도로명/지번 상세 주소 (동/가/로/길 + 번지수)
    /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:\s+[가-힣]+(?:시|군|구))?\s+[가-힣]+(?:구|군)?\s+[가-힣0-9]+(?:동|읍|면|가|로|길)(?:\s+\d+(?:-\d+)?)?/,
    
    // 2. 간단 지역명 (예: "서울 강남구", "경기 성남시 분당구")
    /(?:서울|부산|대구|인천|광주|대전|울산|세종)\s+[가-힣]+(?:구|군)/,
    /(?:경기|강원|충북|충남|전북|전남|경북|경남|제주)\s+[가-힣]+(?:시|군)(?:\s+[가-힣]+구)?/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].trim();
  }

  return null;
}

function getWorkTimeBasis(cardText, salaryType) {
  if (salaryType === "daily") {
    return {
      hours: 8,
      notice: "일급 공고는 8시간 근무 기준으로 체감 시급을 계산했습니다."
    };
  }

  const text = String(cardText || "").replace(/\u00a0/g, " ");

  if (/근무\s*시간\s*[:：]?\s*(?:협의|미정|추후)/.test(text)) {
    return {
      hours: 4,
      notice: "근무시간이 협의/미정으로 표시되어 4시간 근무 기준으로 계산했습니다."
    };
  }

  const rangePattern =
    /(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)\s*(?:~|～|〜|∼|－|–|—|-|부터)\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)\s*(?:까지)?/g;

  const ranges = [...text.matchAll(rangePattern)];

  if (ranges.length === 1) {
    const m = ranges[0];

    const sh = Number(m[1]);
    const sm = Number(m[2] || m[3] || 0);
    const eh = Number(m[4]);
    const em = Number(m[5] || m[6] || 0);

    if (
      sh <= 23 &&
      eh <= 24 &&
      sm <= 59 &&
      em <= 59
    ) {
      let minutes = eh * 60 + em - (sh * 60 + sm);

      if (minutes < 0) minutes += 24 * 60;

      if (minutes > 0 && minutes <= 24 * 60) {
        return {
          hours: minutes / 60,
          notice: ""
        };
      }
    }
  }

  const duration = text.match(
    /(?:하루|일|근무시간\s*[:：]?)\s*(\d+(?:\.\d+)?)\s*시간/
  );

  if (duration) {
    const hours = Number(duration[1]);

    if (hours > 0 && hours <= 24) {
      return { hours, notice: "" };
    }
  }

  return {
    hours: 4,
    notice: "목록 공고에서 정확한 근무시간을 찾지 못해 4시간 근무 기준으로 계산했습니다."
  };
}

function isNearViewport(card) {
  const rect = card.getBoundingClientRect();

  return (
    rect.bottom >= -120 &&
    rect.top <= window.innerHeight + VIEWPORT_PRELOAD_PX
  );
}

function collectCandidates() {
  const nodes = document.querySelectorAll(
    "span, em, strong, b, td, a, div"
  );

  const output = [];
  const seenCards = new Set();

  for (const el of nodes) {
    if (el.classList?.contains("wit-real-badge")) continue;

    const text = el.innerText?.trim() || "";
    const salary = parseSalaryText(text);

    if (!salary) continue;

    const childAlreadyContainsSalary =
      [...(el.children || [])].some(child => {
        const childText = child.innerText?.trim() || "";
        return !!parseSalaryText(childText);
      });

    if (childAlreadyContainsSalary) continue;

    const card = findCard(el);

    if (!card || seenCards.has(card)) continue;
    if (!isNearViewport(card)) continue;
    if (card.dataset.witDone === "true") continue;

    seenCards.add(card);
    output.push({ el, card, salary });
  }

  return output;
}

// =======================================================
// 6. 체감 시급 계산
// =======================================================
function makeLocation(savedLocation) {
  return {
    address: savedLocation.address,
    x: Number(savedLocation.x),
    y: Number(savedLocation.y)
  };
}

function createBadge(el) {
  el.setAttribute("data-wit-wage-source", "true");
  el.setAttribute("data-wit-real-wage", "체감시급 계산 중...");
  el.style.setProperty("--wit-real-color", "#6b7280");

  return el;
}

function setBadgeError(badge, message) {
  badge.setAttribute("data-wit-real-wage", "체감시급 · 경로 확인 필요");
  badge.style.setProperty("--wit-real-color", "#b43d3d");
  badge.title = message;

  badge.addEventListener("click", e => {
    console.error("[WiT] 경로 계산 실패:", message);
  }, { once: true });
}

function openDetail({
  user,
  workAddr,
  baseHourly,
  realWage,
  dropRate,
  toRoute,
  fromRoute,
  notice,
  theme
}) {
  const startLabel = user.startPos === "home" ? "집" : "학교";
  const endLabel = user.endPos === "home" ? "집" : "학교";

  document.getElementById("wit-detail-posted").textContent =
    `${Math.round(baseHourly).toLocaleString()}원`;

  document.getElementById("wit-detail-work-address").textContent =
    `근무지 기준: ${workAddr}`;

  document.getElementById("wit-route-to-label").textContent =
    `${startLabel} → 근무지`;

  document.getElementById("wit-route-from-label").textContent =
    `근무지 → ${endLabel}`;

  document.getElementById("wit-route-to-time").textContent =
    `${toRoute.time}분`;

  document.getElementById("wit-route-to-distance").textContent =
    `${toRoute.distance_km}km`;

  document.getElementById("wit-route-to-cost").textContent =
    `${toRoute.cost.toLocaleString()}원`;

  document.getElementById("wit-route-from-time").textContent =
    `${fromRoute.time}분`;

  document.getElementById("wit-route-from-distance").textContent =
    `${fromRoute.distance_km}km`;

  document.getElementById("wit-route-from-cost").textContent =
    `${fromRoute.cost.toLocaleString()}원`;

  document.getElementById("wit-detail-real-wage").textContent =
    `${realWage.toLocaleString()}원`;

  const dropEl = document.getElementById("wit-detail-drop");
  dropEl.textContent = `공고 시급 대비 -${dropRate}%`;
  dropEl.style.background = theme.bg;
  dropEl.style.color = theme.text;
  dropEl.style.border = `1px solid ${theme.border}`;

  const card = document.getElementById("wit-real-card");
  card.style.background = theme.bg;
  card.style.borderColor = theme.border;

  const noticeEl = document.getElementById("wit-detail-notice");

  if (notice) {
    noticeEl.textContent = notice;
    noticeEl.classList.remove("wit-hidden");
  } else {
    noticeEl.textContent = "";
    noticeEl.classList.add("wit-hidden");
  }

  setOverlayVisible("wit-detail-modal", true);
}

async function calculateCandidate(candidate, user) {
  const { el, card, salary } = candidate;
  const cardText = card.innerText || "";
  const workAddr = extractCleanAddress(cardText);

  const badge = createBadge(el);

  if (!workAddr) {
    setBadgeError(
      badge,
      "이 목록 카드에서 근무지 주소를 찾지 못했습니다. 상세 공고에서 더 정확한 근무지 주소가 보이는지 확인해 주세요."
    );
    return;
  }

  const workTime = getWorkTimeBasis(cardText, salary.type);
  const workHours = workTime.hours;

  const totalEarned =
    salary.type === "daily"
      ? salary.amount
      : salary.amount * workHours;

  const baseHourly =
    salary.type === "daily"
      ? salary.amount / workHours
      : salary.amount;

  const startSaved = user.startPos === "home" ? user.home : user.school;
  const endSaved = user.endPos === "home" ? user.home : user.school;

  try {
    const [toRoute, fromRoute] = await Promise.all([
      fetchRoute(
        makeLocation(startSaved),
        { address: workAddr }
      ),
      fetchRoute(
        { address: workAddr },
        makeLocation(endSaved)
      )
    ]);

    const commuteHours = (Number(toRoute.time) + Number(fromRoute.time)) / 60;
    const totalCost = Number(toRoute.cost) + Number(fromRoute.cost);
    const denominator = Number(workHours) + commuteHours;

    if (denominator <= 0) {
      throw new Error("근무시간과 이동시간 계산값이 올바르지 않습니다.");
    }

    const realWage = Math.max(
      0,
      Math.round((totalEarned - totalCost) / denominator)
    );

    const dropRate = Math.max(
      0,
      ((baseHourly - realWage) / baseHourly) * 100
    ).toFixed(1);

    const theme = getColorTheme(dropRate);

    badge.setAttribute(
      "data-wit-real-wage",
      `체감시급 ${realWage.toLocaleString()}원`
    );
    badge.style.setProperty("--wit-real-color", theme.text);

    badge.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      openDetail({
        user,
        workAddr,
        baseHourly,
        realWage,
        dropRate,
        toRoute,
        fromRoute,
        notice: workTime.notice,
        theme
      });
    };

  } catch (error) {
    console.error("[WiT] 실제 ODsay 경로 계산 실패:", error);

    setBadgeError(
      badge,
      `실제 대중교통 경로 계산에 실패했습니다.\n\n${error.message}`
    );
  }
}

// =======================================================
// 7. 한 화면에 최대 5개씩 → 스크롤하면 다음 5개
// =======================================================
async function injectWageBadges() {
  if (scanRunning) return;
  scanRunning = true;

  try {
    const user = await getUserData();

    const floating = document.getElementById("wit-floating-button");

    if (!user?.home?.x || !user?.school?.x) {
      if (floating) floating.textContent = "⚠️ 내 주소 설정";

      if (!sessionStorage.getItem("witSettingsOpened")) {
        sessionStorage.setItem("witSettingsOpened", "1");
        setTimeout(openAddressModal, 250);
      }

      return;
    }

    if (floating) floating.textContent = "📍 내 주소 설정 완료";

    const batch = collectCandidates().slice(0, BATCH_SIZE);

    if (!batch.length) return;

    batch.forEach(({ card }) => {
      card.dataset.witDone = "true";
    });

    batch.forEach(candidate => {
      calculateCandidate(candidate, user);
    });

  } finally {
    scanRunning = false;
  }
}

function resetAllBadges() {
  document.querySelectorAll("[data-wit-wage-source='true']").forEach(el => {
    el.removeAttribute("data-wit-wage-source");
    el.removeAttribute("data-wit-real-wage");
    el.style.removeProperty("--wit-real-color");
    el.onclick = null;
  });

  document.querySelectorAll("[data-wit-done]").forEach(el => {
    delete el.dataset.witDone;
  });
}

// =======================================================
// 8. 실행 / 스크롤 감지
// =======================================================
initUi();
injectWageBadges();

window.addEventListener(
  "scroll",
  () => {
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
      injectWageBadges();
    }, 220);
  },
  { passive: true }
);

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    injectWageBadges();
  }, 300);
});

let witMutationTimer = null;

const witObserver = new MutationObserver(() => {
  clearTimeout(witMutationTimer);
  witMutationTimer = setTimeout(() => {
    injectWageBadges();
  }, 250);
});

witObserver.observe(document.body, {
  childList: true,
  subtree: true
});