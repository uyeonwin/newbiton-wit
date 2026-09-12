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

    const isDaily = hasDaily || numOnly >= 60000;
    const workHours = isDaily ? 8 : 4;
    const totalEarned = isDaily ? numOnly : (numOnly * workHours);
    const baseHourly = isDaily ? Math.round(numOnly / workHours) : numOnly;

    const initialReal = Math.round((totalEarned - 3000) / (workHours + 1.33));
    const initialDrop = (((baseHourly - initialReal) / baseHourly) * 100).toFixed(1);
    const theme = getColorTheme(initialDrop);

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "wit-real-badge";
    badge.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      margin-left: 6px !important;
      padding: 2px 6px !important;
      background-color: ${theme.bg} !important;
      border: 1px solid ${theme.border} !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
      color: ${theme.text} !important;
      cursor: pointer !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
    `;
    badge.innerHTML = `<span>${initialReal.toLocaleString()}원</span> <span style="font-size:9px; text-decoration:underline; font-weight:normal;">(체감시급)</span>`;

    badge.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const modal = document.getElementById("wit-detail-modal");
      modal.style.display = "flex";

      document.getElementById("wit-modal-posted").innerText = `${baseHourly.toLocaleString()}원`;
      document.getElementById("wit-modal-start-label").innerText = user.startPos;
      document.getElementById("wit-modal-end-label").innerText = user.endPos;

      document.getElementById("wit-modal-time-to").innerText = "...";
      document.getElementById("wit-modal-cost-to").innerText = "...";
      document.getElementById("wit-modal-time-from").innerText = "...";
      document.getElementById("wit-modal-cost-from").innerText = "...";

      const toTransit = await fetchODsayTransit(startAddr, workAddr);
      const fromTransit = await fetchODsayTransit(workAddr, endAddr);

      document.getElementById("wit-modal-time-to").innerText = toTransit.time;
      document.getElementById("wit-modal-cost-to").innerText = toTransit.cost.toLocaleString();
      document.getElementById("wit-modal-time-from").innerText = fromTransit.time;
      document.getElementById("wit-modal-cost-from").innerText = fromTransit.cost.toLocaleString();

      const totalHours = (toTransit.time + fromTransit.time) / 60;
      const totalCost = toTransit.cost + fromTransit.cost;
      const exactReal = Math.round((totalEarned - totalCost) / (workHours + totalHours));
      const exactDrop = (((baseHourly - exactReal) / baseHourly) * 100).toFixed(1);

      document.getElementById("wit-modal-realwage").innerText = exactReal.toLocaleString();
      const dropBadge = document.getElementById("wit-modal-droprate");
      dropBadge.innerText = `실제 시급보다 -${exactDrop}%p ↓`;

      const realTheme = getColorTheme(exactDrop);
      const box = document.getElementById("wit-modal-box");
      box.style.backgroundColor = realTheme.bg;
      box.style.borderColor = realTheme.border;
      dropBadge.style.color = realTheme.text;
      dropBadge.style.backgroundColor = realTheme.bg;
      dropBadge.style.borderColor = realTheme.border;

      badge.innerHTML = `<span>${exactReal.toLocaleString()}원</span> <span style="font-size:9px; text-decoration:underline; font-weight:normal;">(체감시급)</span>`;
      badge.style.backgroundColor = realTheme.bg;
      badge.style.borderColor = realTheme.border;
      badge.style.color = realTheme.text;
    });

    el.insertAdjacentElement("afterend", badge);
  }
}

initModals();
injectWageBadges();

if (!sessionStorage.getItem("wit_session_opened")) {
  setTimeout(() => openAddressModal(), 300);
}

setInterval(() => injectWageBadges(), 800);
