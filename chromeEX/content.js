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
// 2. 카카오 주소 검색 모달 (CSP 문제 없는 인라인 검색)
// =======================================================
let targetInputTarget = "";

function openSearchModal(targetId) {
  targetInputTarget = targetId;
  const modal = document.getElementById("wit-search-popup");
  document.getElementById("wit-search-query").value = "";
  document.getElementById("wit-search-results").innerHTML = "<div style='color:#9ca3af; text-align:center; padding:20px;'>도로명, 건물명, 지번을 입력 후 검색하세요.</div>";
  modal.style.display = "flex";
  document.getElementById("wit-search-query").focus();
}

async function executeSearch() {
  const q = document.getElementById("wit-search-query").value.trim();
  if (!q) return;

  const resultContainer = document.getElementById("wit-search-results");
  resultContainer.innerHTML = "<div style='text-align:center; padding:15px; color:#6b7280;'>검색 중...</div>";

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/search-address?query=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      resultContainer.innerHTML = "<div style='text-align:center; padding:15px; color:#ef4444;'>검색 결과가 없습니다.</div>";
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
    resultContainer.innerHTML = "<div style='text-align:center; padding:15px; color:#ef4444;'>검색 서버(FastAPI) 연결 실패</div>";
  }
}

// =======================================================
// 3. FastAPI 백엔드 (ODsay 대중교통 경로 호출)
// =======================================================
async function fetchODsayTransit(startAddr, endAddr) {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_address: startAddr, end_address: endAddr })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("FastAPI 통신 실패, 기본값 사용:", err);
  }
  return { time: 35, cost: 1500 };
}

// =======================================================
// 4. 모달 UI 주입
// =======================================================
function initModals() {
  if (document.getElementById("wit-detail-modal")) return;

  const modalsHTML = `
    <!-- 주소 설정 모달 -->
    <div id="wit-address-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999990; justify-content:center; align-items:center; backdrop-filter: blur(2px);">
      <div style="background:#ffffff; border:2px solid #111827; border-radius:18px; width:90%; max-width:440px; padding:24px; box-shadow:0 20px 25px rgba(0,0,0,0.25); font-family:-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e5e7eb; padding-bottom:8px; margin-bottom:14px;">
          <span style="font-weight:900; color:#f59e0b; font-size:16px;">WiT</span>
          <h2 style="font-size:16px; font-weight:800; color:#111827; margin:0;">내 기준 주소지 설정</h2>
          <button id="wit-addr-close-btn" style="background:none; border:none; font-size:22px; font-weight:bold; cursor:pointer; color:#9ca3af; line-height:1;">×</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; font-size:12px;">
          <div>
            <label style="display:block; font-weight:bold; color:#374151; margin-bottom:4px;">집 주소 <span style="color:#ef4444;">*</span></label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="wit-input-home" placeholder="주소 검색 버튼을 눌러주세요" style="flex:1; border:1.5px solid #111827; border-radius:8px; padding:8px 10px; font-size:12px; outline:none;" />
              <button type="button" id="wit-search-home-btn" style="background:#111827; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-weight:bold; font-size:11px; cursor:pointer;">주소 검색</button>
            </div>
          </div>

          <div>
            <label style="display:block; font-weight:bold; color:#374151; margin-bottom:4px;">학교 주소 <span style="color:#ef4444;">*</span></label>
            <div style="display:flex; gap:6px;">
              <input type="text" id="wit-input-school" placeholder="주소 검색 버튼을 눌러주세요" style="flex:1; border:1.5px solid #111827; border-radius:8px; padding:8px 10px; font-size:12px; outline:none;" />
              <button type="button" id="wit-search-school-btn" style="background:#111827; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-weight:bold; font-size:11px; cursor:pointer;">주소 검색</button>
            </div>
          </div>

          <div style="border-top:1px solid #f3f4f6; padding-top:10px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:bold; color:#4b5563;">평소 출발 위치</span>
              <select id="wit-select-start" style="border:1.5px solid #111827; border-radius:6px; padding:4px 8px; font-weight:bold; background:#fff;">
                <option value="집" selected>집</option>
                <option value="학교">학교</option>
              </select>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:bold; color:#4b5563;">평소 도착 위치</span>
              <select id="wit-select-end" style="border:1.5px solid #111827; border-radius:6px; padding:4px 8px; font-weight:bold; background:#fff;">
                <option value="집">집</option>
                <option value="학교" selected>학교</option>
              </select>
            </div>
          </div>

          <div style="text-align:right; margin-top:8px;">
            <button id="wit-addr-save-btn" style="border:2px solid #111827; background:#111827; color:#fff; padding:8px 24px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer;">등록하고 계산하기</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 주소 검색 팝업창 -->
    <div id="wit-search-popup" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:99999999; justify-content:center; align-items:center;">
      <div style="background:#fff; border-radius:14px; width:90%; max-width:400px; height:450px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 25px rgba(0,0,0,0.3);">
        <div style="padding:12px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; background:#fafafa;">
          <span style="font-weight:bold; font-size:14px; color:#111827;">주소 검색</span>
          <button id="wit-search-close-btn" style="background:none; border:none; font-size:20px; font-weight:bold; cursor:pointer; color:#6b7280;">×</button>
        </div>
        <div style="padding:10px; display:flex; gap:6px; border-bottom:1px solid #f3f4f6;">
          <input type="text" id="wit-search-query" placeholder="예: 반포대로 58, 고려대학교" style="flex:1; border:1px solid #d1d5db; border-radius:6px; padding:6px 10px; font-size:12px; outline:none;" />
          <button id="wit-search-do-btn" style="background:#2563eb; color:#fff; border:none; border-radius:6px; padding:6px 14px; font-size:12px; font-weight:bold; cursor:pointer;">검색</button>
        </div>
        <div id="wit-search-results" style="flex:1; overflow-y:auto; padding:8px;"></div>
      </div>
    </div>

    <!-- 체감 시급 상세 분석 모달 -->
    <div id="wit-detail-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999990; justify-content:center; align-items:center; backdrop-filter: blur(2px);">
      <div style="background:#ffffff; border:2px solid #111827; border-radius:18px; width:90%; max-width:400px; padding:22px; box-shadow:0 20px 25px rgba(0,0,0,0.25); font-family:-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e5e7eb; padding-bottom:8px; margin-bottom:14px;">
          <span style="font-weight:900; color:#f59e0b; font-size:16px;">WiT</span>
          <button id="wit-detail-close-btn" style="background:none; border:none; font-size:22px; font-weight:bold; cursor:pointer; line-height:1; color:#9ca3af;">×</button>
        </div>

        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #f3f4f6;">
          <div style="font-size:16px; font-weight:800; color:#111827;">
            공고 시급 : <span id="wit-modal-posted" style="color:#2563eb;">0원</span>
          </div>
        </div>

        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px; font-size:12px; margin-bottom:14px; line-height:1.8;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#4b5563;">출발지(<span id="wit-modal-start-label">집</span>) ➔ 근무지 :</span>
            <span style="font-weight:bold; color:#111827;"><span id="wit-modal-time-to">...</span>분 (<span id="wit-modal-cost-to">...</span>원)</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#4b5563;">근무지 ➔ 도착지(<span id="wit-modal-end-label">학교</span>) :</span>
            <span style="font-weight:bold; color:#111827;"><span id="wit-modal-time-from">...</span>분 (<span id="wit-modal-cost-from">...</span>원)</span>
          </div>
          <div style="font-size:10px; color:#6b7280; text-align:right; margin-top:4px;">* ODsay 대중교통 실시간 API 연동</div>
        </div>

        <div id="wit-modal-box" style="border:2px solid #111827; background:#fffbeb; border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="font-size:11px; font-weight:bold; color:#4b5563;">내 동선 반영 체감 시급</div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px;">
            <div style="font-size:24px; font-weight:900; color:#111827;"><span id="wit-modal-realwage">0</span>원</div>
            <div id="wit-modal-droprate" style="font-size:11px; font-weight:bold; padding:3px 8px; border-radius:999px; border:1px solid transparent;">-0%p ↓</div>
          </div>
        </div>

        <p id="wit-modal-time-notice" role="note" style="display:none; font-size:12px; line-height:1.6; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px; margin:0 0 12px 0;"></p>

        <p style="font-size:10px; color:#9ca3af; margin:0 0 12px 0;">* 체감 시급 = (임금 - 왕복교통비) ÷ (근무시간 + 이동시간)</p>

        <div style="text-align:right;">
          <button id="wit-detail-confirm-btn" style="border:1.5px solid #111827; background:#fff; padding:6px 18px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer;">닫기</button>
        </div>
      </div>
    </div>

    <!-- 우측 하단 플로팅 버튼 -->
    <button id="wit-floating-addr-btn" style="position:fixed; bottom:20px; right:20px; z-index:999999; background:#111827; color:#fff; border:none; border-radius:999px; padding:10px 16px; font-size:12px; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.25); cursor:pointer; display:flex; align-items:center; gap:6px;">
      <span id="wit-floating-text">📍 내 주소지 설정</span>
    </button>
  `;
  document.body.insertAdjacentHTML("beforeend", modalsHTML);

  document.getElementById("wit-detail-close-btn").onclick = () => document.getElementById("wit-detail-modal").style.display = "none";
  document.getElementById("wit-detail-confirm-btn").onclick = () => document.getElementById("wit-detail-modal").style.display = "none";
  document.getElementById("wit-addr-close-btn").onclick = () => document.getElementById("wit-address-modal").style.display = "none";
  document.getElementById("wit-floating-addr-btn").onclick = openAddressModal;
  document.getElementById("wit-search-close-btn").onclick = () => document.getElementById("wit-search-popup").style.display = "none";

  document.getElementById("wit-search-home-btn").onclick = () => openSearchModal("wit-input-home");
  document.getElementById("wit-search-school-btn").onclick = () => openSearchModal("wit-input-school");
  document.getElementById("wit-search-do-btn").onclick = executeSearch;
  document.getElementById("wit-search-query").onkeydown = (e) => { if (e.key === "Enter") executeSearch(); };

  document.getElementById("wit-addr-save-btn").onclick = () => {
    const homeVal = document.getElementById("wit-input-home").value.trim();
    const schoolVal = document.getElementById("wit-input-school").value.trim();

    if (!homeVal || !schoolVal) {
      alert("집 주소와 학교 주소를 모두 입력해주세요.");
      return;
    }

    saveUserData({
      home: homeVal,
      school: schoolVal,
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
// 5. 공고 탐색 및 뱃지 부착
// =======================================================
function extractCleanAddress(cardText) {
  const matched = cardText.match(/([가-힣]+(?:시|도)?\s*[가-힣]+(?:구|군)\s*[가-힣0-9]+(?:동|읍|면|로|길)?)/);
  if (matched && matched[0]) return matched[0].trim();
  return "서울 중구 광희동";
}


// 시급: 공고 근무시간을 사용합니다. 시간 미기재·시간 협의이면 4시간.
// 일급: 공고 근무시간과 관계없이 8시간을 사용합니다.
function getWorkTimeBasis(cardText, isDaily) {
  if (isDaily) {
    return {
      hours: 8,
      notice: "해당 계산 결과는 일급을 8시간 기준으로 계산한 결과입니다."
    };
  }

  const fallback = {
    hours: 4,
    notice: "공고에 근무시간이 명시되어 있지 않거나 근무시간 협의가 가능하여, 해당 계산 결과는 4시간을 기준으로 계산된 결과입니다."
  };
  const needsCheck = {
    hours: null,
    notice: "공고의 근무시간을 하나로 확인할 수 없습니다. 여러 시간대 또는 시간 표기를 확인해 주세요."
  };
  const text = String(cardText || "").replace(/\u00a0/g, " ");

  // '근무시간' 항목이 있으면 그 항목을 우선 사용합니다.
  // 급여·근무요일 등에 붙은 '협의 가능'을 근무시간 협의로 오인하지 않습니다.
  const labeled = text.match(/근무\s*시간\s*[:：]?\s*([\s\S]*?)(?=근무\s*(?:요일|기간|지역|장소|주소)|급여|복리후생|지원조건|모집조건|상세모집내용|$)/);
  let timeText = labeled ? labeled[1].trim() : text;
  if (/(?:근무\s*)?시간\s*[:：]?\s*(?:협의|미정|추후)/.test(text)) return fallback;
  if (labeled && /협의|미정|추후/.test(timeText)) return fallback;

  // 예: 09:00~18:00, 9:00 - 18:00, 09시~18시, 9시 30분~18시.
  const rangePattern = /(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)\s*(?:~|～|〜|∼|－|–|—|-|부터)\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분)?)\s*(?:까지)?/g;
  const ranges = [...timeText.matchAll(rangePattern)];
  if (!ranges.length) {
    // 시작·종료 시각 대신 '일 6시간' 또는 '근무시간: 6시간'인 공고.
    const duration = labeled
      ? timeText.match(/^\s*(?:(?:하루|일)\s*)?(\d+(?:\.\d+)?)\s*시간(?:\s*(\d{1,2})\s*분)?\s*(?:근무)?\s*$/)
      : text.match(/(?:하루|일)\s*(\d+(?:\.\d+)?)\s*시간(?:\s*(\d{1,2})\s*분)?/);
    if (duration) {
      const nearby = timeText.slice(duration.index, duration.index + duration[0].length + 25).split(/\n|급여|근무요일|근무기간/)[0];
      if (/협의|미정|추후/.test(nearby)) return fallback;
      const minutes = Number(duration[2] || 0);
      const hours = Number(duration[1]) + minutes / 60;
      if (minutes < 60 && hours > 0 && hours <= 24) return { hours, notice: "" };
    }
    if (/\d\s*(?:시|시간|:)/.test(timeText)) return needsCheck;
    return fallback;
  }

  // 복수 시간대가 서로 다르면 한 근무시간으로 확정할 수 없습니다.
  // 이 경우 임의로 4시간을 적용하지 않고 확인을 요청합니다.
  const durations = [];
  for (const match of ranges) {
    const startHour = Number(match[1]);
    const startMinute = Number(match[2] || match[3] || 0);
    const endHour = Number(match[4]);
    const endMinute = Number(match[5] || match[6] || 0);
    if (startHour > 23 || endHour > 24 || startMinute > 59 || endMinute > 59 || (endHour === 24 && endMinute !== 0)) return needsCheck;
    let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (minutes < 0) minutes += 24 * 60; // 예: 22:00~06:00 → 8시간
    if (minutes <= 0) return needsCheck;
    const after = timeText.slice(match.index + match[0].length);
    const nearby = after.split(/\n|급여|근무요일|근무기간|근무지역/)[0];
    if (/협의|미정|추후/.test(nearby)) return fallback;
    durations.push(minutes / 60);
  }
  if (durations.some(hours => hours !== durations[0])) return needsCheck;
  return { hours: durations[0], notice: "" };
}

function injectWageBadges() {
  initModals();

  const user = getUserData();
  const floatingText = document.getElementById("wit-floating-text");

  if (!user || !user.home || !user.school) {
    if (floatingText) floatingText.innerText = "⚠️ 주소를 먼저 등록하세요";
    return;
  } else {
    if (floatingText) floatingText.innerText = "📍 내 주소지 설정 완료";
  }

  const startAddr = user.startPos === "집" ? user.home : user.school;
  const endAddr = user.endPos === "집" ? user.home : user.school;

  const candidates = document.querySelectorAll("span, em, strong, b, td, a, div");

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (el.children.length > 1) continue;
    if (el.dataset.witDone === "true" || el.classList.contains("wit-real-badge")) continue;

    const text = el.innerText ? el.innerText.trim() : "";
    if (text.includes("월") || text.includes("연") || text.includes("건별")) continue;

    const hasHourly = text.includes("시") || text.includes("시급");
    const hasDaily = text.includes("일") || text.includes("일급");
    if ((!hasHourly && !hasDaily) || !text.includes("원") || !/[0-9]/.test(text)) continue;

    const numOnly = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (!numOnly || numOnly < 9000 || numOnly > 350000) continue;

    if (el.parentElement && el.parentElement.querySelector(".wit-real-badge")) {
      el.dataset.witDone = "true";
      continue;
    }

    el.dataset.witDone = "true";

    const card = el.closest("li, tr, .item, .box, div[class*='item'], div[class*='card']");
    const workAddr = extractCleanAddress(card?.innerText || "");

    // 1. 근무시간 및 기본 급여 계산
    // 급여 유형은 공고 표기를 따릅니다. 금액만으로 일급으로 바꾸지 않습니다.
    const isDaily = hasDaily && !hasHourly;
    const workTimeBasis = getWorkTimeBasis(card?.innerText || "", isDaily);
    const workHours = workTimeBasis.hours;
    const totalEarned = isDaily ? numOnly : (numOnly * workHours);
    const baseHourly = isDaily ? numOnly / workHours : numOnly;

    // 2. 초기 뱃지 생성 (API 로딩 중 표시할 임시 뱃지)
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "wit-real-badge";
    badge.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      margin-left: 6px !important;
      padding: 2px 6px !important;
      background-color: #f3f4f6 !important;
      border: 1px solid #d1d5db !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
      color: #6b7280 !important;
      cursor: pointer !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
    `;
    badge.innerHTML = `<span>계산중...</span>`;
    el.insertAdjacentElement("afterend", badge);

    if (workHours === null) {
      badge.textContent = "근무시간 확인 필요";
      badge.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert(workTimeBasis.notice);
      };
      continue;
    }

    // 3. 💡 ODsay API 실시간 호출 후 (시급*근무시간 - 교통비) / (이동시간 + 근무시간) 공식 적용
    (async () => {
      // API 경로 호출 (출발지 -> 근무지, 근무지 -> 도착지)
      const toTransit = await fetchODsayTransit(startAddr, workAddr);
      const fromTransit = await fetchODsayTransit(workAddr, endAddr);

      // API 반환값: 왕복 총 이동시간(시간 단위) 및 왕복 총 교통비(원)
      const totalHours = (toTransit.time + fromTransit.time) / 60;
      const totalCost = toTransit.cost + fromTransit.cost;

      // 💡 요청하신 계산 공식 적용
      const realWage = Math.round((totalEarned - totalCost) / (workHours + totalHours));
      const dropRate = (((baseHourly - realWage) / baseHourly) * 100).toFixed(1);
      const theme = getColorTheme(dropRate);

      // 뱃지 내용 및 색상 업데이트
      badge.innerHTML = `<span>${realWage.toLocaleString()}원</span> <span style="font-size:9px; text-decoration:underline; font-weight:normal;">(체감시급)</span>`;
      badge.style.backgroundColor = theme.bg;
      badge.style.borderColor = theme.border;
      badge.style.color = theme.text;

      // 모달 클릭 이벤트 연결 (이미 계산된 API 데이터 그대로 전달)
      badge.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const modal = document.getElementById("wit-detail-modal");
        modal.style.display = "flex";

        document.getElementById("wit-modal-posted").innerText = `${baseHourly.toLocaleString()}원`;
        document.getElementById("wit-modal-start-label").innerText = user.startPos;
        document.getElementById("wit-modal-end-label").innerText = user.endPos;

        document.getElementById("wit-modal-time-to").innerText = toTransit.time;
        document.getElementById("wit-modal-cost-to").innerText = toTransit.cost.toLocaleString();
        document.getElementById("wit-modal-time-from").innerText = fromTransit.time;
        document.getElementById("wit-modal-cost-from").innerText = fromTransit.cost.toLocaleString();

        const timeNotice = document.getElementById("wit-modal-time-notice");
        timeNotice.textContent = workTimeBasis.notice;
        timeNotice.style.display = workTimeBasis.notice ? "block" : "none";

        document.getElementById("wit-modal-realwage").innerText = realWage.toLocaleString();
        const dropBadge = document.getElementById("wit-modal-droprate");
        dropBadge.innerText = `실제 시급보다 -${dropRate}%p ↓`;

        const box = document.getElementById("wit-modal-box");
        box.style.backgroundColor = theme.bg;
        box.style.borderColor = theme.border;
        dropBadge.style.color = theme.text;
        dropBadge.style.backgroundColor = theme.bg;
        dropBadge.style.borderColor = theme.border;
      };
    })();

    el.insertAdjacentElement("afterend", badge);
  }
}

initModals();
injectWageBadges();

if (!sessionStorage.getItem("wit_session_opened")) {
  setTimeout(() => openAddressModal(), 300);
}

setInterval(() => injectWageBadges(), 800);
