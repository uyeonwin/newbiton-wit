// =======================================================
// 0. 기본 설정
// =======================================================
const BATCH_SIZE = 5;

// =======================================================
// 1. 주소지 및 상태 관리
// =======================================================
function getUserData() {
  const saved = localStorage.getItem("wit_user_address");
  return saved ? JSON.parse(saved) : null;
}

function saveUserData(data) {
  localStorage.setItem("wit_user_address", JSON.stringify(data));
}

function getColorTheme(dropRate) {
  const rate = parseFloat(dropRate);
  if (rate > 30) return { border: "#ef4444", bg: "#fef2f2", text: "#b91c1c" };
  if (rate >= 20) return { border: "#f97316", bg: "#fff7ed", text: "#c2410c" };
  if (rate >= 10) return { border: "#eab308", bg: "#fefce8", text: "#854d0e" };
  return { border: "#10b981", bg: "#ecfdf5", text: "#047857" };
}

// =======================================================
// 2. 화면 근처 요소 확인
// =======================================================
function isNearViewport(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (rect.bottom >= -150 && rect.top <= window.innerHeight + 300);
}

// =======================================================
// 3. 카카오 주소 검색 모달
// =======================================================
let targetInputTarget = "";

function openSearchModal(targetId) {
  targetInputTarget = targetId;
  const modal = document.getElementById("wit-search-popup");
  document.getElementById("wit-search-query").value = "";
  document.getElementById("wit-search-results").innerHTML = `
    <div style="color:#9ca3af; text-align:center; padding:20px;">도로명, 건물명, 지번을 입력 후 검색하세요.</div>
  `;
  modal.style.display = "flex";
  document.getElementById("wit-search-query").focus();
}

async function executeSearch() {
  const q = document.getElementById("wit-search-query").value.trim();
  if (!q) return;

  const resultContainer = document.getElementById("wit-search-results");
  resultContainer.innerHTML = `<div style="text-align:center; padding:15px; color:#6b7280;">검색 중...</div>`;

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/search-address?query=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      resultContainer.innerHTML = `<div style="text-align:center; padding:15px; color:#ef4444;">검색 결과가 없습니다.</div>`;
      return;
    }

    resultContainer.innerHTML = data.results.map(item => `
      <div class="wit-search-item" style="padding:10px; border-bottom:1px solid #f3f4f6; cursor:pointer; text-align:left;" data-addr="${item.address_name}">
        <div style="font-weight:bold; color:#111827; font-size:13px;">${item.place_name}</div>
        <div style="font-size:11px; color:#6b7280;">${item.address_name}</div>
      </div>
    `).join("");

    resultContainer.querySelectorAll(".wit-search-item").forEach(el => {
      el.onclick = () => {
        const selectedAddr = el.getAttribute("data-addr");
        if (targetInputTarget) {
          document.getElementById(targetInputTarget).value = selectedAddr;
        }
        document.getElementById("wit-search-popup").style.display = "none";
      };
    });
  } catch (err) {
    console.error("[WiT] 주소 검색 실패:", err);
    resultContainer.innerHTML = `<div style="text-align:center; padding:15px; color:#ef4444;">검색 서버(FastAPI) 연결 실패</div>`;
  }
}

// =======================================================
// 4. 백엔드 ODsay 통신
// =======================================================
async function fetchODsayTransit(startAddr, endAddr) {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_address: startAddr, end_address: endAddr })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("FastAPI 통신 실패, 기본값 사용:", err);
    return { time: 35, cost: 1500 };
  }
}

// =======================================================
// 5. 모달 UI 주입
// =======================================================
function initModals() {
  if (document.getElementById("wit-detail-modal")) return;

  const modalsHTML = `
    <!-- 주소 설정 모달 -->
    <div id="wit-address-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999990; justify-content:center; align-items:center; backdrop-filter:blur(2px);">
      <div style="background:#ffffff; border:2px solid #111827; border-radius:18px; width:90%; max-width:440px; padding:24px; box-shadow:0 20px 25px rgba(0,0,0,0.25); font-family:-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e5e7eb; padding-bottom:8px; margin-bottom:14px;">
          <span style="font-weight:900; color:#f59e0b; font-size:16px;">WiT</span>
          <h2 style="font-size:16px; font-weight:800; color:#111827; margin:0;">내 기준 주소지 설정</h2>
          <button id="wit-addr-close-btn" style="background:none; border:none; font-size:22px; font-weight:bold; cursor:pointer; color:#9ca3af;">×</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; font-size:12px;">
          <div>
            <label style="display:block; font-weight:bold; color:#374151; margin-bottom:4px;">집 주소 *</label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="wit-input-home" placeholder="주소 검색 버튼을 눌러주세요" style="flex:1; border:1.5px solid #111827; border-radius:8px; padding:8px 10px; font-size:12px;" />
              <button id="wit-search-home-btn" style="background:#111827; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-weight:bold; cursor:pointer;">주소 검색</button>
            </div>
          </div>

          <div>
            <label style="display:block; font-weight:bold; color:#374151; margin-bottom:4px;">학교 주소 *</label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="wit-input-school" placeholder="주소 검색 버튼을 눌러주세요" style="flex:1; border:1.5px solid #111827; border-radius:8px; padding:8px 10px; font-size:12px;" />
              <button id="wit-search-school-btn" style="background:#111827; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-weight:bold; cursor:pointer;">주소 검색</button>
            </div>
          </div>

          <div style="border-top:1px solid #f3f4f6; padding-top:10px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between;">
              <span>평소 출발 위치</span>
              <select id="wit-select-start"><option value="집" selected>집</option><option value="학교">학교</option></select>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>평소 도착 위치</span>
              <select id="wit-select-end"><option value="집">집</option><option value="학교" selected>학교</option></select>
            </div>
          </div>

          <button id="wit-addr-save-btn" style="background:#111827; color:#fff; border:none; border-radius:8px; padding:10px; font-weight:bold; cursor:pointer;">등록하고 계산하기</button>
        </div>
      </div>
    </div>

    <!-- 주소 검색 팝업 -->
    <div id="wit-search-popup" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:99999999; justify-content:center; align-items:center;">
      <div style="background:#fff; border-radius:14px; width:90%; max-width:400px; height:450px; display:flex; flex-direction:column;">
        <div style="padding:12px; display:flex; justify-content:space-between; border-bottom:1px solid #ddd;">
          <strong>주소 검색</strong>
          <button id="wit-search-close-btn" style="background:none; border:none; font-size:20px; cursor:pointer;">×</button>
        </div>
        <div style="padding:10px; display:flex; gap:6px;">
          <input id="wit-search-query" placeholder="예: 고려대학교" style="flex:1; padding:8px;" />
          <button id="wit-search-do-btn" style="background:#2563eb; color:#fff; border:none; border-radius:6px; padding:6px 14px; font-weight:bold; cursor:pointer;">검색</button>
        </div>
        <div id="wit-search-results" style="flex:1; overflow-y:auto; padding:8px;"></div>
      </div>
    </div>

    <!-- 신규 디자인 상세 분석 모달 -->
    <div id="wit-detail-modal" class="wit-modal-backdrop" style="display:none;">
      <div class="wit-modal-card">
        <div class="wit-modal-header">
          <div class="wit-brand-logo">WiT</div>
          <button id="wit-detail-close-btn" class="wit-close-btn">×</button>
        </div>

        <div class="wit-posted-wage-box">
          <span class="wit-label">공고 시급</span>
          <span id="wit-modal-posted" class="wit-value">0원</span>
        </div>

        <div class="wit-route-container">
          <div class="wit-route-row">
            <span class="wit-route-label">출발지(<span id="wit-modal-start-label"></span>) ➔ 근무지</span>
            <span class="wit-route-value"><strong id="wit-modal-time-to">0</strong>분 / <strong id="wit-modal-cost-to">0</strong>원</span>
          </div>
          <div class="wit-route-row">
            <span class="wit-route-label">근무지 ➔ 도착지(<span id="wit-modal-end-label"></span>)</span>
            <span class="wit-route-value"><strong id="wit-modal-time-from">0</strong>분 / <strong id="wit-modal-cost-from">0</strong>원</span>
          </div>
        </div>

        <div id="wit-modal-box" class="wit-result-box">
          <div class="wit-result-title">내 동선 반영 체감 시급</div>
          <div class="wit-result-body">
            <div class="wit-result-price"><span id="wit-modal-realwage">0</span><span class="wit-unit">원</span></div>
            <div id="wit-modal-droprate" class="wit-badge-rate">-0%</div>
          </div>
        </div>

        <p id="wit-modal-time-notice" class="wit-notice-box" style="display:none;"></p>
        <div class="wit-formula-text">* 체감 시급 = (총 임금 - 왕복 교통비) ÷ (근무시간 + 이동시간)</div>

        <div class="wit-modal-footer">
          <button id="wit-detail-confirm-btn" class="wit-btn-primary">확인</button>
        </div>
      </div>
    </div>

    <!-- 플로팅 버튼 -->
    <button id="wit-floating-addr-btn" style="position:fixed; bottom:20px; right:20px; z-index:999999; background:#111827; color:#fff; border:none; border-radius:999px; padding:10px 16px; font-weight:bold; cursor:pointer;">
      <span id="wit-floating-text">📍 내 주소지 설정</span>
    </button>
  `;

  document.body.insertAdjacentHTML("beforeend", modalsHTML);

  document.getElementById("wit-detail-close-btn").onclick = () => document.getElementById("wit-detail-modal").style.display = "none";
  document.getElementById("wit-detail-confirm-btn").onclick = () => document.getElementById("wit-detail-modal").style.display = "none";
  document.getElementById("wit-addr-close-btn").onclick = () => document.getElementById("wit-address-modal").style.display = "none";
  document.getElementById("wit-search-close-btn").onclick = () => document.getElementById("wit-search-popup").style.display = "none";
  document.getElementById("wit-floating-addr-btn").onclick = openAddressModal;
  document.getElementById("wit-search-home-btn").onclick = () => openSearchModal("wit-input-home");
  document.getElementById("wit-search-school-btn").onclick = () => openSearchModal("wit-input-school");
  document.getElementById("wit-search-do-btn").onclick = executeSearch;
  document.getElementById("wit-search-query").onkeydown = e => { if (e.key === "Enter") executeSearch(); };

  document.getElementById("wit-addr-save-btn").onclick = () => {
    const home = document.getElementById("wit-input-home").value.trim();
    const school = document.getElementById("wit-input-school").value.trim();

    if (!home || !school) {
      alert("집 주소와 학교 주소를 모두 입력해주세요.");
      return;
    }

    saveUserData({
      home,
      school,
      startPos: document.getElementById("wit-select-start").value,
      endPos: document.getElementById("wit-select-end").value
    });

    sessionStorage.setItem("wit_session_opened", "true");
    document.getElementById("wit-address-modal").style.display = "none";

    document.querySelectorAll(".wit-real-badge").forEach(b => b.remove());
    document.querySelectorAll("[data-wit-done]").forEach(el => el.removeAttribute("data-wit-done"));
    injectWageBadges();
  };
}

function openAddressModal() {
  const current = getUserData();
  document.getElementById("wit-input-home").value = current ? current.home : "";
  document.getElementById("wit-input-school").value = current ? current.school : "";
  document.getElementById("wit-select-start").value = current ? current.startPos : "집";
  document.getElementById("wit-select-end").value = current ? current.endPos : "학교";
  document.getElementById("wit-address-modal").style.display = "flex";
}

// =======================================================
// 6. 주소 추출
// =======================================================
function extractCleanAddress(cardText) {
  const matched = cardText.match(/([가-힣]+(?:시|도)?\s*[가-힣]+(?:구|군)\s*[가-힣0-9]+(?:동|읍|면|로|길)?)/);
  if (matched && matched[0]) return matched[0].trim();
  return "서울 중구 광희동";
}

// =======================================================
// 7. 근무시간 계산
// =======================================================
function getWorkTimeBasis(cardText, isDaily) {
  if (isDaily) {
    return { hours: 8, notice: "해당 계산 결과는 일급을 8시간 기준으로 계산한 결과입니다." };
  }
  const fallback = { hours: 4, notice: "공고에 근무시간이 명시되어 있지 않거나 근무시간 협의가 가능하여 4시간 기준으로 계산했습니다." };
  const needsCheck = { hours: null, notice: "공고의 근무시간을 하나로 확인할 수 없습니다." };

  const text = String(cardText || "").replace(/\u00a0/g, " ");
  const labeled = text.match(/근무\s*시간\s*[:：]?\s*([\s\S]*?)(?=근무\s*(?:요일|기간|지역|장소|주소)|급여|복리후생|지원조건|모집조건|상세모집내용|$)/);
  const timeText = labeled ? labeled[1].trim() : text;

  if (/(?:근무\s*)?시간\s*[:：]?\s*(?:협의|미정|추후)/.test(text)) return fallback;

  const rangePattern = /(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)\s*(?:~|～|〜|∼|－|–|—|-|부터)\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)\s*(?:까지)?/g;
  const ranges = [...timeText.matchAll(rangePattern)];
  if (!ranges.length) return fallback;

  const durations = [];
  for (const match of ranges) {
    const startHour = Number(match[1]);
    const startMinute = Number(match[2] || match[3] || 0);
    const endHour = Number(match[4]);
    const endMinute = Number(match[5] || match[6] || 0);

    if (startHour > 23 || endHour > 24 || startMinute > 59 || endMinute > 59) return needsCheck;
    let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (minutes < 0) minutes += 24 * 60;
    if (minutes <= 0) return needsCheck;

    durations.push(minutes / 60);
  }

  if (durations.some(h => h !== durations[0])) return needsCheck;
  return { hours: durations[0], notice: "" };
}

// =======================================================
// 8. 체감 시급 계산 및 모달 오픈
// =======================================================
async function calculateRealWage(badge, { startAddr, endAddr, workAddr, totalEarned, workHours, baseHourly, workTimeBasis, user }) {
  try {
    const [toTransit, fromTransit] = await Promise.all([
      fetchODsayTransit(startAddr, workAddr),
      fetchODsayTransit(workAddr, endAddr)
    ]);

    const totalTravelHours = (toTransit.time + fromTransit.time) / 60;
    const totalCost = toTransit.cost + fromTransit.cost;
    const realWage = Math.round((totalEarned - totalCost) / (workHours + totalTravelHours));
    const dropRate = (((baseHourly - realWage) / baseHourly) * 100).toFixed(1);
    const theme = getColorTheme(dropRate);

    badge.innerHTML = `<span>${realWage.toLocaleString()}원</span> <span style="font-size:9px; text-decoration:underline; font-weight:normal;">(체감시급)</span>`;
    badge.style.backgroundColor = theme.bg;
    badge.style.borderColor = theme.border;
    badge.style.color = theme.text;

    badge.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      const modal = document.getElementById("wit-detail-modal");
      modal.querySelectorAll(".wit-real-badge").forEach(b => b.remove());
      modal.style.display = "flex";

      document.getElementById("wit-modal-posted").innerText = `${Math.round(baseHourly).toLocaleString()}원`;
      document.getElementById("wit-modal-start-label").innerText = user.startPos;
      document.getElementById("wit-modal-end-label").innerText = user.endPos;

      document.getElementById("wit-modal-time-to").innerText = toTransit.time;
      document.getElementById("wit-modal-cost-to").innerText = toTransit.cost.toLocaleString();
      document.getElementById("wit-modal-time-from").innerText = fromTransit.time;
      document.getElementById("wit-modal-cost-from").innerText = fromTransit.cost.toLocaleString();

      document.getElementById("wit-modal-realwage").innerText = realWage.toLocaleString();
      
      const drop = document.getElementById("wit-modal-droprate");
      drop.innerText = `공고 시급 대비 -${dropRate}%`;
      drop.style.color = theme.text;
      drop.style.backgroundColor = theme.bg;
      drop.style.borderColor = theme.border;

      const box = document.getElementById("wit-modal-box");
      box.style.backgroundColor = theme.bg;
      box.style.borderColor = theme.border;

      const notice = document.getElementById("wit-modal-time-notice");
      notice.innerText = workTimeBasis.notice;
      notice.style.display = workTimeBasis.notice ? "block" : "none";
    };
  } catch (err) {
    console.error("[WiT] 계산 실패:", err);
    badge.innerText = "계산 실패";
  }
}

// =======================================================
// 9. 공고 탐색
// =======================================================
function injectWageBadges() {
  initModals();

  const user = getUserData();
  const floatingText = document.getElementById("wit-floating-text");

  if (!user || !user.home || !user.school) {
    if (floatingText) floatingText.innerText = "⚠️ 주소를 먼저 등록하세요";
    return;
  }
  if (floatingText) floatingText.innerText = "📍 내 주소지 설정 완료";

  const startAddr = user.startPos === "집" ? user.home : user.school;
  const endAddr = user.endPos === "집" ? user.home : user.school;
  const candidates = document.querySelectorAll("span, em, strong, b, td, a, div");

  let processedThisBatch = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (processedThisBatch >= BATCH_SIZE) break;

    const el = candidates[i];

    if (el.closest("#wit-detail-modal, #wit-address-modal, #wit-search-popup")) continue;
    if (el.children.length > 1) continue;
    if (el.dataset.witDone === "true" || el.classList.contains("wit-real-badge")) continue;

    const text = el.innerText ? el.innerText.trim() : "";
    if (text.includes("월") || text.includes("연") || text.includes("건별")) continue;

    const hasHourly = text.includes("시") || text.includes("시급");
    const hasDaily = text.includes("일") || text.includes("일급");
    if ((!hasHourly && !hasDaily) || !text.includes("원") || !/[0-9]/.test(text)) continue;

    const numOnly = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (!numOnly || numOnly < 9000 || numOnly > 350000) continue;

    const card = el.closest("li, tr, .item, .box, div[class*='item'], div[class*='card']") || el;
    if (!isNearViewport(card)) continue;

    if (el.parentElement && el.parentElement.querySelector(".wit-real-badge")) {
      el.dataset.witDone = "true";
      continue;
    }

    el.dataset.witDone = "true";
    const cardText = card.innerText || "";
    const workAddr = extractCleanAddress(cardText);
    const isDaily = hasDaily && !hasHourly;
    const workTimeBasis = getWorkTimeBasis(cardText, isDaily);
    const workHours = workTimeBasis.hours;

    if (workHours === null) {
      const badge = document.createElement("button");
      badge.className = "wit-real-badge";
      badge.innerText = "근무시간 확인 필요";
      badge.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        alert(workTimeBasis.notice);
      };
      el.insertAdjacentElement("afterend", badge);
      processedThisBatch++;
      continue;
    }

    const totalEarned = isDaily ? numOnly : numOnly * workHours;
    const baseHourly = isDaily ? numOnly / workHours : numOnly;

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "wit-real-badge";
    badge.style.cssText = `
      display:inline-flex !important;
      align-items:center !important;
      gap:3px !important;
      margin-left:6px !important;
      padding:2px 6px !important;
      background:#f3f4f6 !important;
      border:1px solid #d1d5db !important;
      border-radius:4px !important;
      font-size:11px !important;
      font-weight:800 !important;
      color:#6b7280 !important;
      cursor:pointer !important;
      white-space:nowrap !important;
    `;
    badge.innerHTML = "<span>계산중...</span>";

    el.insertAdjacentElement("afterend", badge);
    processedThisBatch++;

    calculateRealWage(badge, {
      startAddr,
      endAddr,
      workAddr,
      totalEarned,
      workHours,
      baseHourly,
      workTimeBasis,
      user
    });
  }
}

// =======================================================
// 10. 초기화 및 이벤트 등록
// =======================================================
initModals();
injectWageBadges();

if (!sessionStorage.getItem("wit_session_opened")) {
  setTimeout(() => openAddressModal(), 300);
}

let scrollTimer = null;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => injectWageBadges(), 250);
}, { passive: true });

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => injectWageBadges(), 300);
});