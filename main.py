import re
import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# 크롬 확장 프로그램과의 통신 허용 (CORS 설정)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 발급받으신 API 키
ODSAY_API_KEY = "n1njdnYBuCCoOhj6hUt0xLO1xRoLlIMxsJC2SGcA5wY"
KAKAO_REST_KEY = "7448cc7b652c7a1c4150697898980eb2"

class RouteRequest(BaseModel):
    start_address: str
    end_address: str

def normalize_address(addr: str) -> str:
    """서울시 -> 서울특별시 등 카카오 API 인식용 주소 정규화"""
    addr = re.sub(r"^서울시\b", "서울특별시", addr.strip())
    addr = re.sub(r"^부산시\b", "부산광역시", addr)
    addr = re.sub(r"^인천시\b", "인천광역시", addr)
    addr = re.sub(r"^대구시\b", "대구광역시", addr)
    addr = re.sub(r"^대전시\b", "대전광역시", addr)
    addr = re.sub(r"^광주시\b", "광주광역시", addr)
    addr = re.sub(r"^울산시\b", "울산광역시", addr)
    return addr

# 1. 주소 검색 엔드포인트 (키워드/도로명 통합)
@app.get("/api/search-address")
async def search_address(query: str = Query(..., description="검색할 주소/키워드")):
    clean_query = normalize_address(query)
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_KEY}"}
    results = []

    async with httpx.AsyncClient(timeout=5.0) as client:
        # 1. 키워드 검색 (고려대학교, 역삼역, OO빌딩 등)
        res_k = await client.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            headers=headers,
            params={"query": clean_query}
        )
        if res_k.status_code == 200:
            for d in res_k.json().get("documents", []):
                addr = d.get("road_address_name") or d.get("address_name")
                place = d.get("place_name", "")
                if addr:
                    results.append({"place_name": place, "address_name": addr})

        # 2. 키워드 결과가 없으면 일반 주소 검색 시도 (도로명/지번)
        if not results:
            res_a = await client.get(
                "https://dapi.kakao.com/v2/local/search/address.json",
                headers=headers,
                params={"query": clean_query}
            )
            if res_a.status_code == 200:
                for d in res_a.json().get("documents", []):
                    road = d.get("road_address")
                    jibun = d.get("address")
                    addr_name = road.get("address_name") if road else (jibun.get("address_name") if jibun else d.get("address_name"))
                    building = road.get("building_name") if road and road.get("building_name") else ""
                    display_name = f"{addr_name} ({building})" if building else addr_name
                    results.append({"place_name": display_name, "address_name": addr_name})

    return {"results": results[:7]}


# 2. 주소 -> WGS84 좌표(경도 sx, 위도 sy) 변환 함수
async def get_coords(address: str, client: httpx.AsyncClient):
    clean_addr = normalize_address(address)
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_KEY}"}

    url_a = "https://dapi.kakao.com/v2/local/search/address.json"
    res_a = await client.get(url_a, headers=headers, params={"query": clean_addr})
    if res_a.status_code == 200:
        docs = res_a.json().get("documents", [])
        if docs:
            return float(docs[0]["x"]), float(docs[0]["y"])

    url_k = "https://dapi.kakao.com/v2/local/search/keyword.json"
    res_k = await client.get(url_k, headers=headers, params={"query": clean_addr})
    if res_k.status_code == 200:
        docs = res_k.json().get("documents", [])
        if docs:
            return float(docs[0]["x"]), float(docs[0]["y"])

    return None, None

# 3. ODsay 대중교통 경로 검색 엔드포인트
@app.post("/api/route")
async def get_odsay_route(req: RouteRequest):
    async with httpx.AsyncClient(timeout=10.0) as client:
        sx, sy = await get_coords(req.start_address, client)
        ex, ey = await get_coords(req.end_address, client)

        if not sx or not ex:
            return {"time": 35, "cost": 1500, "status": "coord_not_found"}

        odsay_url = "https://api.odsay.com/v1/api/searchPubTransPathT"
        params = {
            "apiKey": ODSAY_API_KEY,
            "SX": sx,
            "SY": sy,
            "EX": ex,
            "EY": ey,
            "OPT": 0
        }

        res = await client.get(odsay_url, params=params)
        if res.status_code == 200:
            odsay_data = res.json()
            if "result" in odsay_data and "path" in odsay_data["result"]:
                best_path = odsay_data["result"]["path"][0]
                total_time = best_path["info"]["totalTime"]
                total_pay = best_path["info"]["payment"]
                return {
                    "time": total_time,
                    "cost": total_pay if total_pay > 0 else 1500,
                    "status": "success"
                }

        return {"time": 30, "cost": 1500, "status": "route_fallback"}
    